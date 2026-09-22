/** Minimal WebGL2 helpers shared by the algorithm scenes: one surface, one program, one triangle. */

export type AlgorithmSurface = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  dispose(): void;
};

/**
 * The fullscreen triangle. Three vertex ids cover the viewport; vUv runs over [0, 1] there, so
 * scenes can use it as a screen coordinate without any attribute buffer.
 */
export const FULLSCREEN_VERTEX = `#version 300 es
out vec2 vUv;

void main() {
  // id 0 -> (-1,-1), id 1 -> (3,-1), id 2 -> (-1,3); the offscreen corners extrapolate vUv.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Backing store settings: opaque output, single buffered work, no depth/stencil traffic. */
const contextAttributes: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
};

/**
 * Opens an opaque WebGL2 surface inside the container. The canvas stays there for the scene to
 * fill; a container that cannot give a context keeps no canvas and the caller falls back to stills.
 */
export function createSurface(container: HTMLElement): AlgorithmSurface {
  const canvas = document.createElement('canvas');
  container.append(canvas);
  const gl = canvas.getContext('webgl2', contextAttributes);
  if (!gl) {
    canvas.remove();
    throw new Error('WebGL2 is unavailable');
  }
  let disposed = false;
  return {
    canvas,
    gl,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Drop the context explicitly: an abandoned canvas can hold its GPU memory until collection.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create a WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  // The info log names the failing source line; the caller reports only the error name.
  const log = gl.getShaderInfoLog(shader) ?? '';
  gl.deleteShader(shader);
  const kind = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
  throw new Error(`${kind} shader failed to compile: ${log.trim()}`);
}

/** Compiles and links a program, deleting every partially built object on failure. */
export function program(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertex);
  let fragmentShader: WebGLShader;
  try {
    fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment);
  } catch (error) {
    gl.deleteShader(vertexShader);
    throw error;
  }
  const linked = gl.createProgram();
  if (!linked) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error('Unable to create a WebGL program');
  }
  gl.attachShader(linked, vertexShader);
  gl.attachShader(linked, fragmentShader);
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(linked) ?? '';
    gl.deleteProgram(linked);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`Program failed to link: ${log.trim()}`);
  }
  // The linked program keeps its own copy of the shaders, so the objects can go right away.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return linked;
}

/**
 * A vertex array for the fullscreen triangle. It has no attributes by design: the vertex shader
 * derives its positions and coordinates from gl_VertexID.
 */
export function triangle(gl: WebGL2RenderingContext): { draw(): void; dispose(): void } {
  const array = gl.createVertexArray();
  if (!array) throw new Error('Unable to create a WebGL vertex array');
  let disposed = false;
  return {
    draw() {
      if (disposed) return;
      gl.bindVertexArray(array);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteVertexArray(array);
    },
  };
}
