import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurface, FULLSCREEN_VERTEX, program, triangle } from '../src/client/algorithms/gl';

const VERTEX_SHADER = 0x8b31;
const FRAGMENT_SHADER = 0x8b30;
const COMPILE_STATUS = 0x8b81;
const LINK_STATUS = 0x8b82;
const TRIANGLES = 0x0004;

type CanvasStub = {
  getContext: (id: string, options?: unknown) => GlStub | null;
  remove: () => void;
};

class ShaderStub {
  source = '';
  deleted = false;
  constructor(readonly type: number) {}
}

class ProgramStub {
  readonly shaders: ShaderStub[] = [];
  deleted = false;
}

class GlStub {
  readonly VERTEX_SHADER = VERTEX_SHADER;
  readonly FRAGMENT_SHADER = FRAGMENT_SHADER;
  readonly COMPILE_STATUS = COMPILE_STATUS;
  readonly LINK_STATUS = LINK_STATUS;
  readonly TRIANGLES = TRIANGLES;
  readonly shaders: ShaderStub[] = [];
  readonly deletedShaders: ShaderStub[] = [];
  readonly programs: ProgramStub[] = [];
  readonly deletedPrograms: ProgramStub[] = [];
  readonly vertexArrays: object[] = [];
  readonly deletedVertexArrays: object[] = [];
  readonly draws: Array<{ mode: number; first: number; count: number }> = [];
  bound: object | null | undefined;
  shaderLog = '';
  programLog = '';
  failCompileOn: number | undefined;
  failLink = false;
  loseContextCalls = 0;
  readonly extensions: string[] = [];

  createShader(type: number) {
    const shader = new ShaderStub(type);
    this.shaders.push(shader);
    return shader;
  }
  shaderSource(shader: ShaderStub, source: string) {
    shader.source = source;
  }
  compileShader() {}
  getShaderParameter(shader: ShaderStub, parameter: number) {
    return parameter === COMPILE_STATUS ? shader.type !== this.failCompileOn : true;
  }
  getShaderInfoLog() {
    return this.shaderLog;
  }
  deleteShader(shader: ShaderStub) {
    shader.deleted = true;
    this.deletedShaders.push(shader);
  }
  createProgram() {
    const built = new ProgramStub();
    this.programs.push(built);
    return built;
  }
  attachShader(built: ProgramStub, shader: ShaderStub) {
    built.shaders.push(shader);
  }
  linkProgram() {}
  getProgramParameter(_built: ProgramStub, parameter: number) {
    return parameter === LINK_STATUS ? !this.failLink : true;
  }
  getProgramInfoLog() {
    return this.programLog;
  }
  deleteProgram(built: ProgramStub) {
    built.deleted = true;
    this.deletedPrograms.push(built);
  }
  createVertexArray() {
    const array = {};
    this.vertexArrays.push(array);
    return array;
  }
  bindVertexArray(array: object | null) {
    this.bound = array;
  }
  deleteVertexArray(array: object) {
    this.deletedVertexArrays.push(array);
  }
  drawArrays(mode: number, first: number, count: number) {
    this.draws.push({ mode, first, count });
  }
  getExtension(name: string) {
    this.extensions.push(name);
    return {
      loseContext: () => {
        this.loseContextCalls++;
      },
    };
  }
}

/** A container that behaves like the caller's layer: append puts the canvas in, remove takes it out. */
class ContainerStub {
  readonly children: unknown[] = [];
  append(child: unknown) {
    this.children.push(child);
  }
  remove(child: unknown) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }
  get length() {
    return this.children.length;
  }
}

function installGl(t: { after: (fn: () => void) => void }) {
  const requests: Array<{ id: string; options?: unknown }> = [];
  const canvases: CanvasStub[] = [];
  let context: GlStub | null = new GlStub();
  let removed = 0;
  const container = new ContainerStub();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const documentStub = {
    createElement(tag: string) {
      assert.equal(tag, 'canvas');
      const canvas: CanvasStub = {
        getContext(id: string, options?: unknown) {
          requests.push({ id, options });
          return context;
        },
        remove() {
          removed++;
          container.remove(canvas);
        },
      };
      canvases.push(canvas);
      return canvas as unknown as HTMLCanvasElement;
    },
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: documentStub,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return {
    container,
    requests,
    canvases,
    get context() {
      return context as GlStub;
    },
    failContext() {
      context = null;
    },
    get removed() {
      return removed;
    },
    surface() {
      return createSurface(container as unknown as HTMLElement);
    },
  };
}

/* ---------- fullscreen vertex ------------------------------------------ */

test('the fullscreen vertex shader is ES 3.00 and derives the triangle from gl_VertexID', () => {
  assert.ok(FULLSCREEN_VERTEX.startsWith('#version 300 es\n'), 'the version line must come first');
  assert.match(FULLSCREEN_VERTEX, /out\s+vec2\s+vUv/, 'scenes read the screen position from vUv');
  assert.match(FULLSCREEN_VERTEX, /vUv\s*=\s*corner/, 'vUv must carry the corner coordinate');
  assert.match(FULLSCREEN_VERTEX, /gl_VertexID/);
  assert.match(FULLSCREEN_VERTEX, /gl_Position/);
  assert.doesNotMatch(FULLSCREEN_VERTEX, /\bin\s+vec/, 'the triangle has no attribute input');
});

test('vertex ids 0, 1 and 2 map to the documented offscreen triangle', () => {
  // Mirrors vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0.
  const positions = [0, 1, 2].map((id) => [((id << 1) & 2) * 2 - 1, (id & 2) * 2 - 1]);
  assert.deepEqual(positions, [
    [-1, -1],
    [3, -1],
    [-1, 3],
  ]);
  assert.match(FULLSCREEN_VERTEX, /\(gl_VertexID\s*<<\s*1\)\s*&\s*2/, 'keeps the x corner term');
  assert.match(FULLSCREEN_VERTEX, /gl_VertexID\s*&\s*2/, 'keeps the y corner term');
});

/* ---------- surface ---------------------------------------------------- */

test('a surface asks for the fixed opaque WebGL2 context and mounts its canvas in the layer', (t) => {
  const harness = installGl(t);
  const surface = harness.surface();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0]!.id, 'webgl2');
  assert.deepEqual(harness.requests[0]!.options, {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  assert.equal(surface.canvas, harness.canvases[0]);
  assert.equal(surface.gl, harness.context as unknown as WebGL2RenderingContext);
  assert.equal(
    harness.container.length,
    1,
    'the scene paints into a canvas that lives in its layer',
  );
});

test('disposing a surface loses the context once and takes the canvas out', (t) => {
  const harness = installGl(t);
  const surface = harness.surface();
  surface.dispose();
  assert.equal(harness.context.loseContextCalls, 1);
  assert.deepEqual(harness.context.extensions, ['WEBGL_lose_context']);
  assert.equal(harness.removed, 1);
  assert.equal(harness.container.length, 0);
  surface.dispose();
  assert.equal(harness.context.loseContextCalls, 1, 'dispose is idempotent');
  assert.equal(harness.container.length, 0);
});

test('a container without WebGL2 support keeps no canvas behind', (t) => {
  const harness = installGl(t);
  harness.failContext();
  assert.throws(() => harness.surface(), /WebGL2 is unavailable/);
  assert.equal(harness.container.length, 0, 'the failed canvas must not stay in the layer');
  assert.equal(harness.removed, 1);
});

/* ---------- program ---------------------------------------------------- */

test('a program compiles both stages, links them and releases the shader objects', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  const linked = program(
    gl as unknown as WebGL2RenderingContext,
    'vertex source',
    'fragment source',
  );
  assert.deepEqual(
    gl.shaders.map((shader) => shader.type),
    [VERTEX_SHADER, FRAGMENT_SHADER],
  );
  assert.deepEqual(
    gl.shaders.map((shader) => shader.source),
    ['vertex source', 'fragment source'],
  );
  assert.equal(gl.programs.length, 1);
  assert.deepEqual(gl.programs[0]!.shaders, gl.shaders, 'both stages are attached before linking');
  assert.equal(linked, gl.programs[0] as unknown as WebGLProgram);
  assert.deepEqual(gl.deletedShaders, gl.shaders, 'the linked program keeps its own copy');
  assert.equal(gl.deletedPrograms.length, 0);
});

test('a failing fragment stage removes the compiled vertex stage too', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  gl.failCompileOn = FRAGMENT_SHADER;
  gl.shaderLog = 'ERROR: 0:12: undefined variable';
  assert.throws(
    () => program(gl as unknown as WebGL2RenderingContext, 'vertex source', 'broken'),
    /Fragment shader failed to compile: ERROR: 0:12: undefined variable/,
  );
  assert.equal(gl.programs.length, 0, 'no program is created for a failed stage');
  assert.deepEqual(
    new Set(gl.deletedShaders.map((shader) => shader.type)),
    new Set([VERTEX_SHADER, FRAGMENT_SHADER]),
    'both partial stages are released',
  );
});

test('a failing vertex stage reports the compile log', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  gl.failCompileOn = VERTEX_SHADER;
  gl.shaderLog = 'ERROR: 0:1: syntax error';
  assert.throws(
    () => program(gl as unknown as WebGL2RenderingContext, 'broken', 'fragment'),
    /Vertex shader failed to compile: ERROR: 0:1: syntax error/,
  );
  assert.deepEqual(
    gl.deletedShaders.map((shader) => shader.type),
    [VERTEX_SHADER],
  );
  assert.equal(gl.programs.length, 0);
});

test('a failing link releases the program and both stages', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  gl.failLink = true;
  gl.programLog = 'ERROR: link mismatch';
  assert.throws(
    () => program(gl as unknown as WebGL2RenderingContext, 'vertex', 'fragment'),
    /Program failed to link: ERROR: link mismatch/,
  );
  assert.deepEqual(gl.deletedPrograms, gl.programs);
  assert.deepEqual(gl.deletedShaders, gl.shaders);
});

/* ---------- triangle --------------------------------------------------- */

test('the fullscreen triangle draws three vertices from a bare vertex array', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  const fullscreen = triangle(gl as unknown as WebGL2RenderingContext);
  assert.equal(gl.vertexArrays.length, 1);
  fullscreen.draw();
  assert.deepEqual(gl.draws, [{ mode: TRIANGLES, first: 0, count: 3 }]);
  assert.equal(gl.bound, null, 'the array is left unbound after the draw');
  fullscreen.dispose();
  assert.deepEqual(gl.deletedVertexArrays, gl.vertexArrays);
});

test('disposing the triangle twice deletes the vertex array once', (t) => {
  const harness = installGl(t);
  const gl = harness.context;
  const fullscreen = triangle(gl as unknown as WebGL2RenderingContext);
  fullscreen.dispose();
  fullscreen.dispose();
  assert.equal(gl.deletedVertexArrays.length, 1);
});
