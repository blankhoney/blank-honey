/* Check the GitHub Actions workflows of the tree this script runs in.
 *
 * The same file is carried by the private repository and by the exported public
 * tree, so it only knows the contract both trees keep: the CI workflow's permissions,
 * triggers, checkout, Node version, commands and collector configuration check.
 * A deploy workflow is validated whenever the file exists, so a tree without one
 * (the public tree, whose deployment belongs to the server) is valid too.
 *
 * The checks compare parsed YAML against the fixed values this repository requires;
 * they are not a general workflow or expression interpreter.  What only one tree
 * can satisfy is checked by that tree's own test suite.
 *
 * Every check is an exported function so tests can drive it directly.  The command
 * line runs only when this file is the process entry point.
 *
 * CLI: node scripts/check-workflows.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';

export const CI_PATH = '.github/workflows/ci.yml';
export const DEPLOY_PATH = '.github/workflows/deploy.yml';

/* Commands both trees must keep. */
const CI_COMMANDS = [
  'npm ci',
  'npm run check',
  'npm test',
  'npm run build',
  'docker compose build web worker',
];

/* The collector is validated offline, so a broken configuration fails CI instead of
   the running collector. */
const COLLECTOR_IMAGE = /otel\/opentelemetry-collector-contrib:\d+\.\d+\.\d+ validate/;
const COLLECTOR_HARDENING = ['--rm', '--network none', '--read-only', '--cap-drop ALL'];
const COLLECTOR_CONFIG = '--config=/etc/otel.yaml';

/* The deployed revision comes from the workflow run the deploy follows. */
export const DEPLOY_COMMIT_SOURCE = '${{ github.event.workflow_run.head_sha }}';

/* Every condition the deploy gate must require, and nothing else.  The list is
   compared as a set against the job's ``if`` expression, so dropping, weakening or
   adding a condition fails the check. */
export const REQUIRED_DEPLOY_CONDITIONS = [
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  'github.event.workflow_run.head_repository.full_name == github.repository',
  "vars.CD_ENABLED == 'true'",
];

const DEPLOY_SECRETS = ['DEPLOY_HOST', 'DEPLOY_KNOWN_HOSTS', 'DEPLOY_SSH_KEY', 'DEPLOY_USER'];
const DEPLOY_SSH_OPTIONS = [
  'BatchMode=yes',
  'IdentitiesOnly=yes',
  'StrictHostKeyChecking=yes',
  'ConnectTimeout=15',
  'ServerAliveInterval=30',
  'ServerAliveCountMax=6',
];

/* Synthetic values for the deploy command check.  They are short obvious
   placeholders: a credential scanner must not read a realistic key here. */
const SYNTHETIC_KEY = 'synthetic-deploy-key';
const SYNTHETIC_HOST_KEY = 'synthetic-host-key';
const SYNTHETIC_COMMIT = 'a'.repeat(40);

export class WorkflowCheckError extends Error {}

function fail(message) {
  throw new WorkflowCheckError(message);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function expectDeepEqual(actual, expected, message) {
  if (!isDeepStrictEqual(actual, expected))
    fail(`${message}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
}

/** The steps of one job, checked to be a non-empty list. */
function stepsOf(workflow, name) {
  expect(workflow !== null && typeof workflow === 'object', 'the workflow is not a mapping');
  const jobs = workflow.jobs;
  expect(jobs !== null && typeof jobs === 'object', 'the workflow has no jobs');
  expect(Object.hasOwn(jobs, name), `the workflow has no job "${name}"`);
  const job = jobs[name];
  expect(job !== null && typeof job === 'object', `job "${name}" is not a mapping`);
  const steps = job.steps;
  expect(Array.isArray(steps) && steps.length > 0, `job "${name}" has no steps`);
  return { job, steps };
}

/** The command lines of one step, without blank lines. */
function commandLines(step) {
  if (typeof step.run !== 'string') return [];
  return step.run
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** The command of one step with its line continuations joined. */
function runText(step) {
  return typeof step.run === 'string' ? step.run.replace(/\\\s*\n/g, ' ') : '';
}

function findStep(steps, predicate, description) {
  const matches = steps.filter(predicate);
  expect(matches.length === 1, `expected exactly one ${description}, found ${matches.length}`);
  return matches[0];
}

function requireCommand(steps, command) {
  const matches = steps.filter(
    (step) => step['working-directory'] === undefined && commandLines(step).includes(command),
  );
  expect(
    matches.length === 1,
    `the repository root must run "${command}" exactly once, found ${matches.length}`,
  );
  return matches[0];
}

/** Check the deploy gate requires exactly the recorded conditions. */
export function checkDeployCondition(condition) {
  expect(
    typeof condition === 'string' && condition.trim() !== '',
    'the deploy job needs an if condition',
  );
  const wrapped = /^\$\{\{([\s\S]*)\}\}$/.exec(condition.trim());
  const expression = (wrapped ? wrapped[1] : condition).trim();
  const clauses = expression.split('&&').map((clause) => clause.trim());
  expect(
    !clauses.some((clause) => clause === ''),
    `the deploy gate has an empty condition: ${condition}`,
  );
  expectDeepEqual(
    clauses.sort(),
    [...REQUIRED_DEPLOY_CONDITIONS].sort(),
    'the deploy gate must require exactly these conditions',
  );
}

const FAKE_SSH = `#!/bin/sh
# Record the arguments of one ssh call and the mode of every file argument, so the
# check can see what the step would have run and how it protected the key material.
printf '%s\\n' "$@" > "$SSH_ARGUMENTS"
for argument in "$@"; do
  case "$argument" in
    *=*) candidate=\${argument#*=} ;;
    *) candidate=$argument ;;
  esac
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    printf '%s %s\\n' "$(stat -c %a "$candidate" 2>/dev/null || stat -f %Lp "$candidate" 2>/dev/null)" "$candidate" >> "$SSH_MODES"
  fi
done
exit 0
`;

function readLines(file) {
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '');
}

function readModes(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes(' '))
      .map((line) => {
        const separator = line.indexOf(' ');
        return [line.slice(separator + 1), line.slice(0, separator)];
      }),
  );
}

/** Run one deploy command with a recording ssh on the front of PATH. */
export function runDeployCommand(script, environment) {
  const directory = mkdtempSync(join(tmpdir(), 'workflow-check-'));
  try {
    const argumentsFile = join(directory, 'arguments');
    const modesFile = join(directory, 'modes');
    writeFileSync(join(directory, 'ssh'), FAKE_SSH, { mode: 0o700 });
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH ?? ''}`,
        SSH_ARGUMENTS: argumentsFile,
        SSH_MODES: modesFile,
        ...environment,
      },
    });
    if (result.error) fail(`the deploy command could not run: ${result.error.message}`);
    return {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      arguments: readLines(argumentsFile),
      fileModes: readModes(modesFile),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Check the fixed server command, including the inputs it must refuse. */
export function checkDeployCommand(script) {
  expect(typeof script === 'string' && script.trim() !== '', 'the deploy job must run one command');
  expect(!/(^|\s)set\s+-[a-z]*x/.test(script), 'the deploy command must not turn on shell tracing');

  const valid = {
    DEPLOY_HOST: 'example.invalid',
    DEPLOY_USER: 'deploy',
    DEPLOY_SSH_KEY: SYNTHETIC_KEY,
    DEPLOY_KNOWN_HOSTS: SYNTHETIC_HOST_KEY,
    COMMIT: SYNTHETIC_COMMIT,
  };
  const run = runDeployCommand(script, valid);
  expect(
    run.status === 0,
    `the deploy command must succeed with complete input, exited ${run.status}: ${run.stderr.trim()}`,
  );
  const args = run.arguments;
  expect(args !== null, 'the deploy command must call ssh with complete input');
  expect(
    args.at(-2) === `${valid.DEPLOY_USER}@${valid.DEPLOY_HOST}`,
    `ssh must connect to user@host, found ${JSON.stringify(args.at(-2))}`,
  );
  expect(
    args.at(-1) === `deploy ${valid.COMMIT}`,
    `ssh must run only "deploy <commit>", found ${JSON.stringify(args.at(-1))}`,
  );
  for (const option of DEPLOY_SSH_OPTIONS)
    expect(args.includes(option), `ssh must run with ${option}`);

  const key = args[args.indexOf('-i') + 1];
  expect(args.includes('-i') && key !== undefined, 'ssh must use a temporary identity file');
  const knownHostsOption = args.find((argument) => argument.startsWith('UserKnownHostsFile='));
  expect(
    knownHostsOption !== undefined,
    'ssh must verify the host key against a temporary known_hosts file',
  );
  const knownHosts = knownHostsOption.slice('UserKnownHostsFile='.length);
  for (const [file, label] of [
    [key, 'temporary private key'],
    [knownHosts, 'temporary known_hosts file'],
  ]) {
    expect(
      run.fileModes[file] === '600',
      `the ${label} must be readable only by its owner, found ${run.fileModes[file] ?? 'no mode'}`,
    );
    expect(!existsSync(file), `the ${label} must be removed when the step ends`);
  }
  for (const material of [
    SYNTHETIC_KEY,
    SYNTHETIC_HOST_KEY,
    'DEPLOY_SSH_KEY=',
    'DEPLOY_KNOWN_HOSTS=',
  ])
    for (const [stream, text] of [
      ['stdout', run.stdout],
      ['stderr', run.stderr],
    ])
      expect(
        !text.includes(material),
        `the deploy command must not print ${material} on ${stream}`,
      );

  const rejected = [
    ['a commit with a shell command', { COMMIT: 'main; id' }],
    ['a commit with a substitution', { COMMIT: '$(id)' }],
    ['an uppercase commit', { COMMIT: SYNTHETIC_COMMIT.toUpperCase() }],
    ['a short commit', { COMMIT: SYNTHETIC_COMMIT.slice(1) }],
    ['a missing commit', { COMMIT: '' }],
    ['a host that looks like an option', { DEPLOY_HOST: '-oProxyCommand=id' }],
    ['a host with a space', { DEPLOY_HOST: 'host name' }],
    ['a missing host', { DEPLOY_HOST: '' }],
    ['a user with a shell command', { DEPLOY_USER: 'deploy;id' }],
    ['a user with a space', { DEPLOY_USER: 'Deploy User' }],
    ['a missing key', { DEPLOY_SSH_KEY: '' }],
    ['a missing known_hosts file', { DEPLOY_KNOWN_HOSTS: '' }],
  ];
  for (const [description, override] of rejected) {
    const refused = runDeployCommand(script, { ...valid, ...override });
    expect(refused.status !== 0, `the deploy command must refuse ${description}`);
    expect(refused.arguments === null, `the deploy command must not reach ssh with ${description}`);
  }
}

/** Check the CI workflow of this tree. */
export function checkCiWorkflow(workflow) {
  expect(workflow !== null && typeof workflow === 'object', 'the CI workflow is not a mapping');
  expectDeepEqual(
    workflow.permissions,
    { contents: 'read' },
    'the CI workflow must request exactly contents: read',
  );

  const trigger = workflow.on;
  expect(trigger !== null && typeof trigger === 'object', 'the CI workflow has no triggers');
  expect(
    Array.isArray(trigger.push?.branches) && trigger.push.branches.includes('main'),
    'the CI workflow must run on pushes to main',
  );
  expect(Object.hasOwn(trigger, 'pull_request'), 'the CI workflow must run on pull requests');
  expect(
    trigger.workflow_run === undefined,
    'the CI workflow must not be triggered by another workflow run',
  );

  const concurrency = workflow.concurrency;
  expect(
    concurrency !== null && typeof concurrency === 'object',
    'the CI workflow must define how runs queue',
  );
  expect(typeof concurrency.group === 'string', 'the CI workflow must name a concurrency group');
  expect(
    concurrency['cancel-in-progress'] === true,
    'a superseded CI run on the same ref must be cancelled',
  );

  const { job, steps } = stepsOf(workflow, 'check');
  expect(job.permissions === undefined, 'the CI job must not widen the workflow permissions');
  expect(job.environment === undefined, 'the CI job must not use a deployment environment');

  const checkout = findStep(
    steps,
    (step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'),
    'actions/checkout step',
  );
  expect(
    checkout.with?.['persist-credentials'] === false,
    'the checkout step must set persist-credentials: false',
  );
  const setup = findStep(
    steps,
    (step) => typeof step.uses === 'string' && step.uses.startsWith('actions/setup-node@'),
    'actions/setup-node step',
  );
  expect(
    String(setup.with?.['node-version']) === '24',
    `the setup-node step must select Node 24, found ${JSON.stringify(setup.with?.['node-version'])}`,
  );

  for (const command of CI_COMMANDS) requireCommand(steps, command);
  expect(
    !JSON.stringify(workflow).includes('secrets.'),
    'the CI workflow must not read repository secrets',
  );

  const collector = findStep(
    steps,
    (step) => step['working-directory'] === undefined && COLLECTOR_IMAGE.test(runText(step)),
    'collector configuration validation step',
  );
  const collectorRun = runText(collector);
  for (const hardening of COLLECTOR_HARDENING)
    expect(collectorRun.includes(hardening), `the collector check must run with ${hardening}`);
  expect(
    collectorRun.includes(COLLECTOR_CONFIG),
    `the collector check must pass ${COLLECTOR_CONFIG}`,
  );
}

/** Check the deploy workflow: what may start it, and what it is allowed to do. */
export function checkDeployWorkflow(workflow) {
  expect(workflow !== null && typeof workflow === 'object', 'the deploy workflow is not a mapping');
  expectDeepEqual(
    workflow.permissions,
    {},
    'the deploy workflow must request no token permissions',
  );
  expectDeepEqual(
    workflow.on?.workflow_run,
    { workflows: ['CI'], branches: ['main'], types: ['completed'] },
    'the deploy workflow must follow the completed CI run of main',
  );
  expectDeepEqual(
    workflow.concurrency,
    { group: 'production', 'cancel-in-progress': false },
    'production deploys must stay serial, and an in-flight deploy must never be cancelled',
  );
  expectDeepEqual(
    Object.keys(workflow.jobs ?? {}),
    ['deploy'],
    'the deploy workflow needs one job',
  );

  const { job, steps } = stepsOf(workflow, 'deploy');
  expect(job.environment === 'production', 'the deploy job must use the production environment');
  expect(
    [45, 60].includes(job['timeout-minutes']),
    `the deploy job timeout must be 45 or 60 minutes, found ${JSON.stringify(job['timeout-minutes'])}`,
  );
  expect(job.permissions === undefined, 'the deploy job must not widen the workflow permissions');
  expect(job['runs-on'] === 'ubuntu-latest', 'the deploy job must run on ubuntu-latest');
  for (const step of steps)
    expect(step.uses === undefined, `the deploy job must not call an action: ${step.uses}`);

  checkDeployCondition(job.if);

  const deployStep = findStep(
    steps,
    (step) => step.env?.COMMIT !== undefined,
    'step that receives the deployed commit',
  );
  expect(
    deployStep.env.COMMIT === DEPLOY_COMMIT_SOURCE,
    `the deployed commit must come from ${DEPLOY_COMMIT_SOURCE}, found ${deployStep.env.COMMIT}`,
  );
  expectDeepEqual(
    Object.keys(deployStep.env).sort(),
    ['COMMIT', ...DEPLOY_SECRETS].sort(),
    'the deploy step must receive exactly the four production secrets and the commit',
  );
  for (const step of steps)
    expect(
      step === deployStep || step.env === undefined,
      'only the deploy step may receive the production credentials',
    );
  expect(
    !JSON.stringify(workflow).includes('github.sha'),
    'the deploy workflow must never read github.sha',
  );

  checkDeployCommand(deployStep.run);
}

/** Check this tree's workflows.  Returns whether a deploy workflow was found. */
export function checkWorkflows({ repository = process.cwd() } = {}) {
  const root = resolve(repository);
  const ciFile = join(root, CI_PATH);
  expect(existsSync(ciFile), `this tree has no ${CI_PATH}`);
  checkCiWorkflow(parse(readFileSync(ciFile, 'utf8')));
  if (!existsSync(join(root, DEPLOY_PATH))) return { deploy: false };
  checkDeployWorkflow(parse(readFileSync(join(root, DEPLOY_PATH), 'utf8')));
  return { deploy: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkWorkflows({});
    console.log(
      `Workflow YAML and restricted SSH command checks passed${result.deploy ? '' : ' (this tree has no deploy workflow)'}`,
    );
  } catch (error) {
    console.error(`workflow check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
