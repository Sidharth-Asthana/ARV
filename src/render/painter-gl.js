/* WebGL2 painter: instanced soft discs/ellipses and segments rendered
   additively into a persistence buffer (motion trails), with a
   downsampled bloom pass composited on top. The canvas sits above the
   scenery layers with mix-blend-mode:plus-lighter (dark scenes) or
   normal alpha compositing (light scenes). */

const MAX_DISCS = 80000;
const MAX_SEGS  = 40000;
const DISC_F = 10;   // x,y,rx,ry,rot,r,g,b,a,soft
const SEG_F  = 9;    // x1,y1,x2,y2,w,r,g,b,a

const VS_DISC = `#version 300 es
layout(location=0) in vec2 quad;
layout(location=1) in vec4 posSize;   // x,y,rx,ry
layout(location=2) in float rot;
layout(location=3) in vec4 col;
layout(location=4) in float soft;
uniform vec2 uRes;
out vec2 vUV; out vec4 vCol; out float vSoft;
void main(){
  float c=cos(rot), s=sin(rot);
  vec2 p=quad*posSize.zw*2.2;          // 2.2: room for the soft halo
  p=vec2(p.x*c-p.y*s, p.x*s+p.y*c)+posSize.xy;
  vec2 clip=(p/uRes*2.0-1.0)*vec2(1,-1);
  gl_Position=vec4(clip,0,1);
  vUV=quad*2.2; vCol=col; vSoft=soft;
}`;
const FS_DISC = `#version 300 es
precision mediump float;
in vec2 vUV; in vec4 vCol; in float vSoft;
out vec4 o;
void main(){
  float d=length(vUV);
  float core=smoothstep(1.0,0.55,d);
  float halo=pow(max(0.0,1.0-d/2.2),2.2)*vSoft;
  float i=(core+halo)*vCol.a;
  o=vec4(vCol.rgb*i,i);
}`;

const VS_SEG2 = `#version 300 es
layout(location=0) in vec2 quad;
layout(location=1) in vec4 ab;
layout(location=2) in float w;
layout(location=3) in vec4 col;
uniform vec2 uRes;
out vec2 vP; out vec4 vAB; out vec4 vCol; out float vW;
void main(){
  vec2 d=ab.zw-ab.xy;
  float len=max(length(d),1e-4);
  vec2 dir=d/len, nrm=vec2(-dir.y,dir.x);
  float pad=w*2.5+1.5;
  vec2 p=ab.xy+dir*(quad.x*(len+pad*2.0)-pad)+nrm*quad.y*pad;
  vec2 clip=(p/uRes*2.0-1.0)*vec2(1,-1);
  gl_Position=vec4(clip,0,1);
  vP=p; vAB=ab; vCol=col; vW=w;
}`;
const FS_SEG = `#version 300 es
precision mediump float;
in vec2 vP; in vec4 vAB; in vec4 vCol; in float vW;
out vec4 o;
void main(){
  vec2 pa=vP-vAB.xy, ba=vAB.zw-vAB.xy;
  float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);
  float d=length(pa-ba*h);
  float core=smoothstep(vW,vW*0.45,d);
  float halo=pow(max(0.0,1.0-d/(vW*2.5+1.5)),2.4)*0.55;
  float i=(core+halo)*vCol.a;
  o=vec4(vCol.rgb*i,i);
}`;

const VS_QUAD = `#version 300 es
layout(location=0) in vec2 quad;
out vec2 vUV;
void main(){ vUV=quad*0.5+0.5; gl_Position=vec4(quad,0,1); }`;
const FS_FADE = `#version 300 es
precision mediump float;
in vec2 vUV; uniform sampler2D uTex; uniform float uDecay;
out vec4 o;
void main(){
  vec4 c=texture(uTex,vUV)*uDecay;
  o=max(c-vec4(0.002),vec4(0.0));    // kill lingering ghosts
}`;
const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir;
out vec4 o;
void main(){
  vec4 s=texture(uTex,vUV)*0.227;
  s+=texture(uTex,vUV+uDir*1.384)*0.316; s+=texture(uTex,vUV-uDir*1.384)*0.316;
  s+=texture(uTex,vUV+uDir*3.230)*0.070; s+=texture(uTex,vUV-uDir*3.230)*0.070;
  o=s;
}`;
const FS_COMPOSITE = `#version 300 es
precision mediump float;
in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uBloomK;
out vec4 o;
void main(){
  vec3 c=texture(uScene,vUV).rgb + texture(uBloom,vUV).rgb*uBloomK;
  float a=clamp(max(max(c.r,c.g),c.b)*1.25,0.0,1.0);
  o=vec4(min(c,vec3(1.0)),a);        // premultiplied
}`;

function compile(gl, vsSrc, fsSrc) {
  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function makeFBO(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex, w, h };
}

export function createGLPainter(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  let pDisc, pSeg, pFade, pBlur, pComp;
  try {
    pDisc = compile(gl, VS_DISC, FS_DISC);
    pSeg  = compile(gl, VS_SEG2, FS_SEG);
    pFade = compile(gl, VS_QUAD, FS_FADE);
    pBlur = compile(gl, VS_QUAD, FS_BLUR);
    pComp = compile(gl, VS_QUAD, FS_COMPOSITE);
  } catch (e) { return null; }

  // unit quad
  const quadVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const quad01VBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad01VBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,-1, 1,-1, 0,1, 1,1]), gl.STATIC_DRAW);

  const discData = new Float32Array(MAX_DISCS * DISC_F);
  const segData  = new Float32Array(MAX_SEGS * SEG_F);
  let nDisc = 0, nSeg = 0;
  const discVBO = gl.createBuffer(), segVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discData.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, segVBO);
  gl.bufferData(gl.ARRAY_BUFFER, segData.byteLength, gl.DYNAMIC_DRAW);

  // VAOs
  const discVAO = gl.createVertexArray();
  gl.bindVertexArray(discVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, discVBO);
  const dstr = DISC_F * 4;
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, dstr, 0);  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, dstr, 16); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, dstr, 20); gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, dstr, 36); gl.vertexAttribDivisor(4, 1);

  const segVAO = gl.createVertexArray();
  gl.bindVertexArray(segVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad01VBO);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, segVBO);
  const sstr = SEG_F * 4;
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, sstr, 0);  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, sstr, 16); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, sstr, 20); gl.vertexAttribDivisor(3, 1);
  gl.bindVertexArray(null);

  let W = 0, H = 0, pw = 0, ph = 0;
  let trailA = null, trailB = null, bloomA = null, bloomB = null;
  let decay = 0;              // trail persistence for this frame (0 = off)

  function resize(w, h, dpr, q) {
    W = w; H = h;
    pw = Math.max(2, Math.round(w * dpr * q));
    ph = Math.max(2, Math.round(h * dpr * q));
    canvas.width = pw; canvas.height = ph;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    for (const f of [trailA, trailB, bloomA, bloomB])
      if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    trailA = makeFBO(gl, pw, ph);
    trailB = makeFBO(gl, pw, ph);
    bloomA = makeFBO(gl, pw >> 2, ph >> 2);
    bloomB = makeFBO(gl, pw >> 2, ph >> 2);
    for (const f of [trailA, trailB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  function begin(trailDecay) {
    nDisc = 0; nSeg = 0;
    decay = trailDecay;
  }

  function clear() {   // wipe trail history (mode/scene switches)
    for (const f of [trailA, trailB]) {
      if (!f) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  function disc(x, y, rx, ry, rot, r, g, b, a, soft = .6) {
    if (nDisc >= MAX_DISCS) return;
    const o = nDisc++ * DISC_F;
    discData[o] = x; discData[o + 1] = y; discData[o + 2] = rx; discData[o + 3] = ry;
    discData[o + 4] = rot;
    discData[o + 5] = r; discData[o + 6] = g; discData[o + 7] = b; discData[o + 8] = a;
    discData[o + 9] = soft;
  }
  const dot = (x, y, rad, r, g, b, a, soft = .6) => disc(x, y, rad, rad, 0, r, g, b, a, soft);

  function seg(x1, y1, x2, y2, w, r, g, b, a) {
    if (nSeg >= MAX_SEGS) return;
    const o = nSeg++ * SEG_F;
    segData[o] = x1; segData[o + 1] = y1; segData[o + 2] = x2; segData[o + 3] = y2;
    segData[o + 4] = w;
    segData[o + 5] = r; segData[o + 6] = g; segData[o + 7] = b; segData[o + 8] = a;
  }

  function poly(pts, n, w, r, g, b, a) {
    for (let i = 0; i < n - 1; i++)
      seg(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], w, r, g, b, a);
  }
  function ring(cx, cy, rad, w, r, g, b, a, segs = 64) {
    let px = cx + rad, py = cy;
    for (let i = 1; i <= segs; i++) {
      const an = i / segs * Math.PI * 2;
      const x = cx + Math.cos(an) * rad, y = cy + Math.sin(an) * rad;
      seg(px, py, x, y, w, r, g, b, a);
      px = x; py = y;
    }
  }

  function fsQuad(prog) {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function flush(bloomK) {
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);

    // 1) fade previous trails into trailB
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailB.fb);
    gl.viewport(0, 0, pw, ph);
    gl.disable(gl.BLEND);
    gl.useProgram(pFade);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailA.tex);
    gl.uniform1i(gl.getUniformLocation(pFade, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(pFade, 'uDecay'), decay);
    fsQuad(pFade);

    // 2) draw primitives additively on top
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    if (nDisc) {
      gl.useProgram(pDisc);
      gl.uniform2f(gl.getUniformLocation(pDisc, 'uRes'), W, H);
      gl.bindBuffer(gl.ARRAY_BUFFER, discVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, discData.subarray(0, nDisc * DISC_F));
      gl.bindVertexArray(discVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nDisc);
      gl.bindVertexArray(null);
    }
    if (nSeg) {
      gl.useProgram(pSeg);
      gl.uniform2f(gl.getUniformLocation(pSeg, 'uRes'), W, H);
      gl.bindBuffer(gl.ARRAY_BUFFER, segVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData.subarray(0, nSeg * SEG_F));
      gl.bindVertexArray(segVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSeg);
      gl.bindVertexArray(null);
    }
    gl.disable(gl.BLEND);

    // 3) bloom: downsample + separable blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb);
    gl.viewport(0, 0, bloomA.w, bloomA.h);
    gl.useProgram(pFade);
    gl.bindTexture(gl.TEXTURE_2D, trailB.tex);
    gl.uniform1f(gl.getUniformLocation(pFade, 'uDecay'), 1);
    fsQuad(pFade);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fb);
    gl.useProgram(pBlur);
    gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
    gl.uniform1i(gl.getUniformLocation(pBlur, 'uTex'), 0);
    gl.uniform2f(gl.getUniformLocation(pBlur, 'uDir'), 1 / bloomA.w, 0);
    fsQuad(pBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fb);
    gl.bindTexture(gl.TEXTURE_2D, bloomB.tex);
    gl.uniform2f(gl.getUniformLocation(pBlur, 'uDir'), 0, 1 / bloomA.h);
    fsQuad(pBlur);

    // 4) composite trails + bloom to the canvas (premultiplied)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pComp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailB.tex);
    gl.uniform1i(gl.getUniformLocation(pComp, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
    gl.uniform1i(gl.getUniformLocation(pComp, 'uBloom'), 1);
    gl.uniform1f(gl.getUniformLocation(pComp, 'uBloomK'), bloomK);
    gl.activeTexture(gl.TEXTURE0);
    fsQuad(pComp);

    // swap persistence buffers
    const tmp = trailA; trailA = trailB; trailB = tmp;
  }

  return { kind: 'webgl', resize, begin, clear, dot, disc, seg, poly, ring, flush };
}
