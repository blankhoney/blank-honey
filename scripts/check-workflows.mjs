import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
assert.equal(ci.permissions.contents, 'read');
assert.ok(ci.jobs.check.steps.some((step) => step.run === 'npm test'));
const file = '.github/workflows/deploy.yml';
if (existsSync(file)) {
  const workflow = parse(readFileSync(file, 'utf8'));
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(workflow.on.workflow_run.branches, ['main']);
  const script = workflow.jobs.deploy.steps[0].run;
  const directory = mkdtempSync(join(tmpdir(), 'workflow-check-'));
  try {
    const output = join(directory, 'arguments');
    writeFileSync(join(directory, 'ssh'), '#!/bin/sh\nprintf "%s\\n" "$@" > "$SSH_ARGUMENTS"\n', {
      mode: 0o700,
    });
    const env = {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      SSH_ARGUMENTS: output,
      DEPLOY_HOST: 'example.invalid',
      DEPLOY_USER: 'deploy',
      DEPLOY_SSH_KEY: 'test-key',
      DEPLOY_KNOWN_HOSTS: 'test-host-key',
      COMMIT: 'a'.repeat(40),
    };
    const run = (values) =>
      spawnSync('bash', ['-c', script], { env: { ...env, ...values }, encoding: 'utf8' });
    assert.equal(run({}).status, 0);
    const args = readFileSync(output, 'utf8').trim().split('\n');
    assert.equal(args.at(-1), `deploy ${env.COMMIT}`);
    assert.ok(args.includes('StrictHostKeyChecking=yes'));
    assert.equal(existsSync(args[args.indexOf('-i') + 1]), false, 'private key must be removed');
    for (const invalid of [
      { COMMIT: 'main; id' },
      { DEPLOY_HOST: '-oProxyCommand=id' },
      { DEPLOY_KNOWN_HOSTS: '' },
    ]) {
      rmSync(output);
      assert.notEqual(run(invalid).status, 0, JSON.stringify(invalid));
      assert.equal(existsSync(output), false, 'invalid input must never reach SSH');
      writeFileSync(output, '');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
console.log('Workflow YAML and restricted SSH command checks passed');
