import { createGLPainter } from './painter-gl.js';
import { create2DPainter } from './painter-2d.js';

export function createPainter(canvas) {
  const gl = createGLPainter(canvas);
  if (gl) return gl;
  return create2DPainter(canvas);
}
