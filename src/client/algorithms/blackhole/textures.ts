/**
 * GPU resources of the black hole scene: the four float tables, the disc noise texture and the
 * texture unit mapping the shader samples them from. Every allocation registers itself before the
 * next one starts, so a failure half way through releases what already exists and the scene keeps
 * its still image instead of leaking a half-built context.
 */

import type { LutSpec } from './lut';
import { LUTS } from './lut';

/** Texture units, shared with the sampler uniforms so binding and shader cannot drift apart. */
export const TEXTURE_UNITS = {
  deflection: 0,
  inverseRadius: 1,
  blackBody: 2,
  doppler: 3,
  noise: 4,
} as const;

export type LutData = {
  deflection: Float32Array;
  inverseRadius: Float32Array;
  doppler: Float32Array;
  blackBody: Float32Array;
};

/** The five uploaded textures. `dispose` releases all of them and is idempotent. */
export type BlackHoleTextures = {
  deflection: WebGLTexture;
  inverseRadius: WebGLTexture;
  doppler: WebGLTexture;
  blackBody: WebGLTexture;
  noise: WebGLTexture;
  dispose(): void;
};

/** Clears errors left over by earlier setup, so the next check reports the new step, not the past. */
export function drainGlErrors(gl: WebGL2RenderingContext): void {
  // Bounded: a lost context reports an error for every call and would loop forever.
  for (let attempt = 0; attempt < 8; attempt++) {
    if (gl.getError() === gl.NO_ERROR) return;
  }
}

/** Fails the scene when a GL call was rejected, which a table in an unsupported format would be. */
export function throwOnGlError(gl: WebGL2RenderingContext, what: string): void {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) throw new Error(`${what}: WebGL error 0x${error.toString(16)}`);
}

function floatTexture(gl: WebGL2RenderingContext, spec: LutSpec, data: Float32Array): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error(`Unable to create the ${spec.file} texture`);
  const threeDimensional = spec.depth > 1;
  const target = threeDimensional ? gl.TEXTURE_3D : gl.TEXTURE_2D;
  gl.bindTexture(target, texture);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const format = spec.channels === 2 ? gl.RG : gl.RGB;
  const internalFormat = spec.channels === 2 ? gl.RG32F : gl.RGB32F;
  if (threeDimensional) {
    gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(
      target,
      0,
      internalFormat,
      spec.width,
      spec.height,
      spec.depth,
      0,
      format,
      gl.FLOAT,
      data,
    );
  } else {
    gl.texImage2D(target, 0, internalFormat, spec.width, spec.height, 0, format, gl.FLOAT, data);
  }
  return texture;
}

/**
 * Decodes the noise PNG. `premultiplyAlpha: 'none'` keeps the red channel exactly as stored. The
 * bytes come from a fetched `ArrayBuffer`, and a `Blob` takes only a non-shared one.
 */
export async function decodeNoiseTexture(bytes: Uint8Array<ArrayBuffer>): Promise<ImageBitmap> {
  const blob = new Blob([bytes], { type: 'image/png' });
  return createImageBitmap(blob, { premultiplyAlpha: 'none' });
}

/**
 * Uploads the tables and the noise image. The decoded bitmap is closed on every path, including a
 * failure part way through, because the upload helper owns it once it is called.
 */
export function createTextures(
  gl: WebGL2RenderingContext,
  data: LutData,
  noise: ImageBitmap,
): BlackHoleTextures {
  const created: WebGLTexture[] = [];
  try {
    drainGlErrors(gl);
    // Registers a texture before the next allocation can fail, so the catch below releases it.
    const keep = (texture: WebGLTexture): WebGLTexture => {
      created.push(texture);
      return texture;
    };
    const deflection = keep(floatTexture(gl, LUTS.deflection, data.deflection));
    const inverseRadius = keep(floatTexture(gl, LUTS.inverseRadius, data.inverseRadius));
    const doppler = keep(floatTexture(gl, LUTS.doppler, data.doppler));
    const blackBody = keep(floatTexture(gl, LUTS.blackBody, data.blackBody));
    const noiseTexture = gl.createTexture();
    if (!noiseTexture) throw new Error('Unable to create the disc noise texture');
    keep(noiseTexture);
    gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
    // Repeat sampling and mipmaps, as upstream configures the same 8-bit pattern.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, noise);
    gl.generateMipmap(gl.TEXTURE_2D);
    throwOnGlError(gl, 'Black hole tables');
    let disposed = false;
    return {
      deflection,
      inverseRadius,
      doppler,
      blackBody,
      noise: noiseTexture,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const texture of created) gl.deleteTexture(texture);
      },
    };
  } catch (error) {
    for (const texture of created) gl.deleteTexture(texture);
    throw error;
  } finally {
    noise.close();
  }
}

/** Binds every table to its unit. Cheap enough to repeat per frame, and immune to state drift. */
export function bindTextures(gl: WebGL2RenderingContext, textures: BlackHoleTextures): void {
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.deflection);
  gl.bindTexture(gl.TEXTURE_2D, textures.deflection);
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.inverseRadius);
  gl.bindTexture(gl.TEXTURE_2D, textures.inverseRadius);
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.blackBody);
  gl.bindTexture(gl.TEXTURE_2D, textures.blackBody);
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.doppler);
  gl.bindTexture(gl.TEXTURE_3D, textures.doppler);
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.noise);
  gl.bindTexture(gl.TEXTURE_2D, textures.noise);
}
