/**
 * GLSL transcribed from the fixed upstream single-file demo
 * (`src/client/vendor/ocean/index.html`, abyssal-ocean
 * `142265f5013b6f27bea4f4f819b832dec75c7bad`).
 *
 * Only the parts the scene needs are kept. Removed relative to upstream, each
 * because its input geometry is gone (see the vendor README for the full list):
 * the island/buoy draws, the sea-bed sampler and shoaling terms, the shoreline
 * foam band, the screen-space reflection march, the underwater view branch and
 * the height readback probe. Everything that shapes the open-water surface —
 * spectrum, IFFT, displacement/Jacobian, foam, sky, refraction, absorption,
 * sky reflection, sun specular — is upstream code with upstream constants.
 */

export const GL_HEAD = `
precision highp float;
precision highp int;
#define PI 3.141592653589793
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
float sat(float x){ return clamp(x, 0.0, 1.0); }
vec3  sat3(vec3 x){ return clamp(x, 0.0, 1.0); }
`;

/**
 * Preetham analytic sky, evaluated per pixel and shared by the sky dome and
 * both the rough and mirror reflection lookups on the water.
 */
export const GL_SKY = `
uniform vec3  uSunDir;
uniform vec3  uBetaR;
uniform vec3  uBetaM;
uniform float uSunE;
uniform float uMieG;
uniform float uSkyGain;
const float RAY_ZENITH = 8.4e3;
const float MIE_ZENITH = 1.25e3;
const float SUN_COS    = 0.9999566769464484;

float rayleighPhase(float c){ return (3.0/(16.0*PI))*(1.0 + c*c); }
float hgPhase(float c, float g){
  float g2 = g*g;
  return (1.0/(4.0*PI))*((1.0-g2)/pow(max(1.0 - 2.0*g*c + g2, 1e-4), 1.5));
}
vec3 skyRadiance(vec3 dir){
  vec3 up = vec3(0.0,1.0,0.0);
  float zen = acos(max(0.0, dot(up, dir)));
  float inv = 1.0/(cos(zen) + 0.15*pow(max(93.885 - degrees(zen), 1e-3), -1.253));
  vec3 Fex = exp(-(uBetaR*(RAY_ZENITH*inv) + uBetaM*(MIE_ZENITH*inv)));
  float ct = dot(dir, uSunDir);
  vec3 bR = uBetaR * rayleighPhase(ct*0.5 + 0.5);
  vec3 bM = uBetaM * hgPhase(ct, uMieG);
  vec3 tot = max(uBetaR + uBetaM, vec3(1e-9));
  vec3 Lin = pow(uSunE*((bR+bM)/tot)*(1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0),
             pow(uSunE*((bR+bM)/tot)*Fex, vec3(0.5)),
             sat(pow(1.0 - dot(up, uSunDir), 5.0)));
  vec3 L0 = 0.1*Fex;
  L0 += (uSunE*19000.0*Fex) * smoothstep(SUN_COS, SUN_COS + 0.000018, ct);
  return min(((Lin + L0)*0.04 + vec3(0.0, 0.0003, 0.00075))*uSkyGain, vec3(600.0));
}
// horizon-band average, used as a cheap "blurred" reflection for rough water
vec3 skyRough(vec3 dir, float r){
  vec3 a = skyRadiance(normalize(mix(dir, vec3(dir.x, abs(dir.y)+0.55, dir.z), sat(r*2.2))));
  return mix(skyRadiance(dir), a, sat(r*3.0));
}
`;

export const GL_NOISE = `
float vhash(vec2 p){
  p = fract(p*vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x*p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(vhash(i), vhash(i+vec2(1,0)), u.x),
             mix(vhash(i+vec2(0,1)), vhash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5;
  }
  return s;
}
`;

export const GL_DEPTH = `
uniform float uNear;
uniform float uFar;
float linearZ(float d){
  float z = d*2.0 - 1.0;
  return (2.0*uNear*uFar)/(uFar + uNear - z*(uFar - uNear));
}
`;

export const QUAD_VERTEX_SHADER = `${GL_HEAD}
in vec3 position;
out vec2 vUv;
void main(){ vUv = position.xy*0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Pass 1: initial spectrum h0(k) for one cascade. */
export const H0_FRAGMENT_SHADER = `${GL_HEAD}
uniform float uN, uL, uWind, uFetch, uDepth, uSwell, uSpread, uShort, uCutLo, uCutHi, uAmp;
uniform vec2  uWindDir;
uniform int   uSeed;
layout(location=0) out vec4 oH0;
const float G = 9.81;

uint pcg(uint v){ uint s = v*747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s)*277803737u; return (w >> 22u) ^ w; }
float rnd(uint s){ return float(pcg(s))*(1.0/4294967296.0); }
vec2 gauss2(int nx, int nz){
  uint h = pcg(uint(nx + 262144)*1973u + uint(nz + 262144)*9277u + uint(uSeed)*26699u);
  float u1 = max(1e-7, rnd(h));
  float u2 = rnd(h ^ 0x9E3779B9u);
  float r  = sqrt(-2.0*log(u1));
  return vec2(r*cos(2.0*PI*u2), r*sin(2.0*PI*u2));
}
float disp(float k){ return sqrt(G*k*tanh(min(k*uDepth, 20.0))); }
float dispD(float k){
  float a  = min(k*uDepth, 20.0);
  float th = tanh(a), ch = cosh(a);
  float w  = max(sqrt(G*k*th), 1e-6);
  return G*(uDepth*k/(ch*ch) + th)/(2.0*w);
}
float jonswap(float w, float wp, float alpha){
  float sg = (w <= wp) ? 0.07 : 0.09;
  float r  = exp(-(w-wp)*(w-wp)/(2.0*sg*sg*wp*wp));
  float iw = 1.0/max(w, 1e-4);
  float p  = wp*iw; p = p*p*p*p;
  return alpha*G*G*pow(iw, 5.0)*exp(-1.25*p)*pow(3.3, r);
}
float tma(float w){
  float wh = w*sqrt(uDepth/G);
  if (wh <= 1.0) return 0.5*wh*wh;
  if (wh <  2.0) return 1.0 - 0.5*(2.0-wh)*(2.0-wh);
  return 1.0;
}
float normFac(float s){
  float s2 = s*s, s3 = s2*s, s4 = s3*s;
  if (s < 5.0) return -0.000564*s4 + 0.00776*s3 - 0.044*s2 + 0.192*s + 0.163;
  return -4.80e-8*s4 + 1.07e-5*s3 - 9.53e-4*s2 + 5.90e-2*s + 3.93e-1;
}
float cos2s(float th, float s){ return normFac(s)*pow(abs(cos(0.5*th)), 2.0*s); }
float spreadPow(float w, float wp){ return (w > wp) ? 9.77*pow(w/wp, -2.5) : 6.97*pow(w/wp, 5.0); }
float dirSpectrum(float th, float w, float wp){
  float s = spreadPow(w, wp) + 16.0*tanh(min(w/wp, 20.0))*uSwell*uSwell;
  float c = cos(th);
  return mix((2.0/PI)*c*c*step(0.0, c), cos2s(th, s), uSpread);
}
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int nx = id.x - int(uN)/2;
  int nz = id.y - int(uN)/2;
  float dk = 2.0*PI/uL;
  vec2  k  = vec2(float(nx), float(nz))*dk;
  float kl = length(k);
  vec2 a = vec2(0.0), b = vec2(0.0);
  if (kl > 1e-6 && kl >= uCutLo && kl < uCutHi){
    float U     = max(uWind, 0.6);
    float F     = max(uFetch, 100.0);
    float wp    = 22.0*pow(G*G/(U*F), 1.0/3.0);
    float alpha = 0.076*pow(U*U/(F*G), 0.22);
    float w     = disp(kl);
    float base  = jonswap(w, wp, alpha)*tma(w)
                * exp(-kl*kl*uShort*uShort)
                * abs(dispD(kl))/kl * dk*dk;
    float thK = atan(k.y, k.x);
    float thW = atan(uWindDir.y, uWindDir.x);
    float dth = thK - thW;
    /* Tessendorf  h0 = (xi_r + i·xi_i)·sqrt(P).  KCAL is calibrated so that
       uAmp = 1 reproduces the Hasselmann fetch-limited law
       Hs = 0.0016·sqrt(gF)/U · U²/g  to within 2% over the whole UI range. */
    const float KCAL = 0.13;
    a = gauss2( nx,  nz)*sqrt(KCAL*max(base*dirSpectrum(dth,      w, wp), 0.0))*uAmp;
    b = gauss2(-nx, -nz)*sqrt(KCAL*max(base*dirSpectrum(dth + PI, w, wp), 0.0))*uAmp;
  }
  oH0 = vec4(a, b.x, -b.y);
}`;

/** Pass 2: time evolution, packing four complex spectra into two MRT slots. */
export const SPECTRUM_FRAGMENT_SHADER = `${GL_HEAD}
uniform sampler2D uH0;
uniform float uN, uL, uTime, uDepth;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec2  k  = (vec2(id) - uN*0.5)*(2.0*PI/uL);
  float kl = length(k);
  if (kl < 1e-6){ o0 = vec4(0.0); o1 = vec4(0.0); return; }
  vec4  h0 = texelFetch(uH0, id, 0);
  float w  = sqrt(9.81*kl*tanh(min(kl*uDepth, 20.0)));
  float c  = cos(w*uTime), s = sin(w*uTime);
  vec2  h  = cmul(h0.xy, vec2(c, s)) + cmul(h0.zw, vec2(c, -s));
  vec2  kn = k/kl;
  // Pack1 = Dx + i·Dz | Pack2 = Dy + i·dDx/dz | Pack3 = dDy/dx + i·dDy/dz | Pack4 = dDx/dx + i·dDz/dz
  o0 = vec4( cmul(h, vec2(kn.y, -kn.x)),        cmul(h, vec2(1.0, k.x*k.y/kl)) );
  o1 = vec4( cmul(h, vec2(-k.y, k.x)),          cmul(h, vec2(k.x*k.x/kl, k.y*k.y/kl)) );
}`;

/** Pass 3: Cooley–Tukey butterfly, both MRT slots at once, one axis per pass. */
export const BUTTERFLY_FRAGMENT_SHADER = `${GL_HEAD}
uniform sampler2D uSrc0, uSrc1, uBf;
uniform int uStage, uDir;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int   ix = (uDir == 0) ? id.x : id.y;
  vec4  bf = texelFetch(uBf, ivec2(uStage, ix), 0);
  ivec2 pa = (uDir == 0) ? ivec2(int(bf.z), id.y) : ivec2(id.x, int(bf.z));
  ivec2 pb = (uDir == 0) ? ivec2(int(bf.w), id.y) : ivec2(id.x, int(bf.w));
  vec2  tw = bf.xy;
  vec4 a0 = texelFetch(uSrc0, pa, 0), b0 = texelFetch(uSrc0, pb, 0);
  vec4 a1 = texelFetch(uSrc1, pa, 0), b1 = texelFetch(uSrc1, pb, 0);
  o0 = vec4(a0.rg + cmul(tw, b0.rg), a0.ba + cmul(tw, b0.ba));
  o1 = vec4(a1.rg + cmul(tw, b1.rg), a1.ba + cmul(tw, b1.ba));
}`;

/** Pass 4: unpack, recentre, build displacement, slopes and the Jacobian. */
export const ASSEMBLY_FRAGMENT_SHADER = `${GL_HEAD}
uniform sampler2D uSrc0, uSrc1;
uniform float uN, uChop;
layout(location=0) out vec4 oDisp;
layout(location=1) out vec4 oDeriv;
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  float perm = (mod(float(id.x + id.y), 2.0) < 0.5) ? 1.0 : -1.0;
  float inv  = perm;               // the butterfly IS the unnormalised centred IDFT
  vec4 A = texelFetch(uSrc0, id, 0)*inv;   // A = (Dx, Dz, Dy, dDx/dz)
  vec4 B = texelFetch(uSrc1, id, 0)*inv;   // B = (dDy/dx, dDy/dz, dDx/dx, dDz/dz)
  float lam  = uChop;
  float dxdx = B.z*lam, dzdz = B.w*lam, dxdz = A.w*lam;
  float J    = (1.0 + dxdx)*(1.0 + dzdz) - dxdz*dxdz;   // < 0 ⇒ surface folds ⇒ breaking
  oDisp  = vec4(A.x*lam, A.z, A.y*lam, J);
  oDeriv = vec4(B.x, B.y, dxdx, dzdz);
}`;

/** Pass 5: temporal foam accumulation — inject from the Jacobian, diffuse, decay. */
export const FOAM_FRAGMENT_SHADER = `${GL_HEAD}
uniform sampler2D uDisp, uPrev;
uniform float uN, uThresh, uStrength, uDecay, uDt;
layout(location=0) out vec4 oFoam;
void main(){
  vec2 uv = gl_FragCoord.xy/uN;
  float J  = texture(uDisp, uv).w;
  float inj = sat((uThresh - J)*uStrength);
  float t = 1.0/uN;
  float p = texture(uPrev, uv).r*0.40
          + (texture(uPrev, uv + vec2( t, 0.0)).r + texture(uPrev, uv + vec2(-t, 0.0)).r
          +  texture(uPrev, uv + vec2(0.0, t)).r + texture(uPrev, uv + vec2(0.0,-t)).r)*0.12
          + (texture(uPrev, uv + vec2( t, t)).r + texture(uPrev, uv + vec2( t,-t)).r
          +  texture(uPrev, uv + vec2(-t, t)).r + texture(uPrev, uv + vec2(-t,-t)).r)*0.03;
  p *= exp(-uDecay*uDt);
  oFoam = vec4(max(p - 0.03*uDt, inj));
}`;

export const SKY_VERTEX_SHADER = `${GL_HEAD}
in vec3 position;
uniform mat4 modelViewMatrix, projectionMatrix, modelMatrix;
out vec3 vW;
void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz;
             gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

export const SKY_FRAGMENT_SHADER = `${GL_HEAD}${GL_SKY}
in vec3 vW;
uniform vec3 uCamPos;
layout(location=0) out vec4 oC;
void main(){ oC = vec4(skyRadiance(normalize(vW - uCamPos)), 1.0); }`;

export const OCEAN_VERTEX_SHADER = `${GL_HEAD}
in vec3 position;
uniform mat4 viewMatrix, projectionMatrix;
uniform vec3 uCamPos;
uniform sampler2D uD0, uD1, uD2;
uniform float uL0, uL1, uL2;
out vec3 vW; out vec3 vDisp; out float vDist; out float vViewZ;
void main(){
  vec3 p = vec3(position.x + uCamPos.x, 0.0, position.z + uCamPos.z);
  float d = length(position.xz);
  float w0 = 1.0 - smoothstep(6000.0, 15000.0, d);
  float w1 = 1.0 - smoothstep(3000.0, 11000.0, d);
  float w2 = 1.0 - smoothstep( 300.0,  1600.0, d);
  vec3 disp = textureLod(uD0, p.xz/uL0, 0.0).xyz*w0
            + textureLod(uD1, p.xz/uL1, 0.0).xyz*w1
            + textureLod(uD2, p.xz/uL2, 0.0).xyz*w2;
  p += disp;
  vW = p; vDisp = disp; vDist = d;
  vec4 mv = viewMatrix*vec4(p, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix*mv;
}`;

export const OCEAN_FRAGMENT_SHADER = `${GL_HEAD}${GL_SKY}${GL_NOISE}${GL_DEPTH}
in vec3 vW; in vec3 vDisp; in float vDist; in float vViewZ;
uniform mat4 viewMatrix, projectionMatrix;
uniform vec3 uCamPos, uSunColor, uAbsorb, uScatter, uSSSColor, uFoamColor;
uniform sampler2D uV0,uV1,uV2,uF0,uF1,uF2,uSceneColor,uSceneDepth;
uniform float uL0,uL1,uL2,uTime,uFoamAmount,
              uSSSStrength,uRefract,uFogDensity,uGlitter;
uniform vec2 uResolution;
layout(location=0) out vec4 oC;

void main(){
  vec3  toEye = uCamPos - vW;
  float dist  = length(toEye);
  vec3  V     = toEye/max(dist, 1e-4);

  /* ---- surface normal from the cascade slope fields ------------------ */
  float n1 = 1.0 - smoothstep(2500.0, 9000.0, dist);
  float n2 = 1.0 - smoothstep( 260.0, 1500.0, dist);
  vec4 dv = texture(uV0, vW.xz/uL0)
          + texture(uV1, vW.xz/uL1)*n1
          + texture(uV2, vW.xz/uL2)*n2;
  vec3 N = normalize(vec3(-dv.x/(1.0 + dv.z), 1.0, -dv.y/(1.0 + dv.w)));
  float facing = dot(V, N);

  /* microfacet roughness rises as we lose cascades to distance --------- */
  float rough = clamp(0.008 + 0.115*(1.0 - n2) + 0.075*(1.0 - n1), 0.006, 0.32);

  /* ---- foam: whitecaps from the Jacobian plus ambient breakup -------- */
  float foam = texture(uF0, vW.xz/uL0).r*0.7
             + texture(uF1, vW.xz/uL1).r*n1
             + texture(uF2, vW.xz/uL2).r*n2*0.85;
  float fn = fbm(vW.xz*0.85 + vec2(uTime*0.04, -uTime*0.03), 4);
  foam = sat(foam*uFoamAmount*(0.45 + 1.05*fn));

  /* ---- refraction, absorption, in-scattering ------------------------- */
  vec2 suv = gl_FragCoord.xy/uResolution;
  float z0 = linearZ(texture(uSceneDepth, suv).r);
  vec2 off = N.xz*uRefract*min(0.09, 3.2/max(vViewZ, 1.0));
  vec2 ruv = clamp(suv + off, vec2(0.0015), vec2(0.9985));
  float zr = linearZ(texture(uSceneDepth, ruv).r);
  if (zr < vViewZ){ ruv = suv; zr = z0; }
  float path = max(zr - vViewZ, 0.0);
  vec3 behind = texture(uSceneColor, ruv).rgb;
  vec3 T = exp(-uAbsorb*min(path, 600.0));
  vec3 inScat = uScatter*(uSunColor*0.30 + skyRadiance(vec3(0.0,1.0,0.0))*0.75);
  vec3 refracted = behind*T + inScat*(vec3(1.0) - T);

  /* ---- subsurface scattering through wave crests --------------------- */
  vec3 rd = refract(-uSunDir, N, 1.0/1.333);
  float sss = pow(sat(dot(V, -rd)), 4.0);
  sss *= sat(vDisp.y*0.5 + 0.30);
  sss *= sat(1.0 - dot(N, uSunDir))*sat(uSunDir.y*4.0);
  vec3 sssCol = uSSSColor*uSunColor*sss*uSSSStrength;

  /* ---- reflection: sky, blurred by the microfacet roughness ---------- */
  vec3 R = reflect(-V, N);
  if (R.y < 0.0) R = normalize(vec3(R.x, -R.y*0.5, R.z));
  vec3 refl = skyRough(R, rough);

  /* ---- sun specular (GGX, widened by solar disc) --------------------- */
  float a  = max(rough, 0.013) + 0.0047; a *= a;
  vec3  H  = normalize(uSunDir + V);
  float nh = sat(dot(N, H)), nv = max(dot(N, V), 1e-3), nl = sat(dot(N, uSunDir));
  float D  = a*a/(PI*pow(nh*nh*(a*a - 1.0) + 1.0, 2.0));
  float kk = a*0.5;
  float G  = (nv/(nv*(1.0-kk)+kk))*(nl/(nl*(1.0-kk)+kk));
  float Fs = 0.02 + 0.98*pow(1.0 - sat(dot(H, V)), 5.0);
  vec3  spec = min(uSunColor*(D*G*Fs)/(4.0*nv)*uGlitter, vec3(600.0));

  /* ---- composite ----------------------------------------------------- */
  float ct = sat(nv);
  float F  = 0.02 + 0.98*pow(1.0 - ct, 5.0);
  F *= (1.0 - foam*0.85);
  vec3 col = mix(refracted + sssCol, refl, F) + spec*(1.0 - foam*0.7);

  vec3 foamLit = uFoamColor*(uSunColor*(0.30 + 0.70*sat(dot(N, uSunDir)))
               + skyRadiance(vec3(0.0,1.0,0.0))*1.25);
  col = mix(col, foamLit, foam);

  /* ---- horizon fog blends water into the sky ------------------------- */
  float f = 1.0 - exp(-dist*dist*uFogDensity*uFogDensity);
  col = mix(col, skyRadiance(-V), sat(f));
  oC = vec4(min(col, vec3(900.0)), 1.0);
}`;

/** Copies the scene colour and depth so the water pass has a depth buffer to test. */
export const BLIT_FRAGMENT_SHADER = `${GL_HEAD}
in vec2 vUv;
uniform sampler2D uColor, uDepth;
layout(location=0) out vec4 oC;
void main(){ oC = texture(uColor, vUv); gl_FragDepth = texture(uDepth, vUv).r; }`;

export const BLOOM_BRIGHT_FRAGMENT_SHADER = `${GL_HEAD}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThresh, uKnee;
layout(location=0) out vec4 oC;
vec3 tap(vec2 o){ return min(texture(uTex, vUv + o*uTexel).rgb, vec3(420.0)); }
void main(){
  vec3 c = (tap(vec2(-1,-1)) + tap(vec2(1,-1)) + tap(vec2(-1,1)) + tap(vec2(1,1)))*0.25;
  float br = max(c.r, max(c.g, c.b));
  float s  = clamp(br - uThresh + uKnee, 0.0, 2.0*uKnee);
  s = s*s/(4.0*uKnee + 1e-4);
  oC = vec4(c*max(s, br - uThresh)/max(br, 1e-4), 1.0);
}`;

export const BLOOM_DOWN_FRAGMENT_SHADER = `${GL_HEAD}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
layout(location=0) out vec4 oC;
vec3 t(vec2 o){ return texture(uTex, vUv + o*uTexel).rgb; }
void main(){
  vec3 c = t(vec2(0,0))*0.125;
  c += (t(vec2(-1,-1)) + t(vec2(1,-1)) + t(vec2(-1,1)) + t(vec2(1,1)))*0.125;
  c += (t(vec2(-2,0)) + t(vec2(2,0)) + t(vec2(0,-2)) + t(vec2(0,2)))*0.0625;
  c += (t(vec2(-2,-2)) + t(vec2(2,-2)) + t(vec2(-2,2)) + t(vec2(2,2)))*0.03125;
  c += (t(vec2(-1,0)) + t(vec2(1,0)) + t(vec2(0,-1)) + t(vec2(0,1)))*0.0625;
  oC = vec4(c, 1.0);
}`;

export const BLOOM_UP_FRAGMENT_SHADER = `${GL_HEAD}
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uRadius;
layout(location=0) out vec4 oC;
vec3 t(vec2 o){ return texture(uTex, vUv + o*uTexel*uRadius).rgb; }
void main(){
  vec3 c = t(vec2(0,0))*0.25;
  c += (t(vec2(-1,0)) + t(vec2(1,0)) + t(vec2(0,-1)) + t(vec2(0,1)))*0.125;
  c += (t(vec2(-1,-1)) + t(vec2(1,-1)) + t(vec2(-1,1)) + t(vec2(1,1)))*0.0625;
  oC = vec4(c, 1.0);
}`;

export const COMPOSITE_FRAGMENT_SHADER = `${GL_HEAD}
in vec2 vUv;
uniform sampler2D uScene, uBloom;
uniform vec2 uTexel;
uniform float uExposure, uBloomStr, uTime, uVignette;
layout(location=0) out vec4 oC;

vec3 aces(vec3 x){
  const mat3 m1 = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
  const mat3 m2 = mat3( 1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  vec3 v = m1*x;
  vec3 a = v*(v + 0.0245786) - 0.000090537;
  vec3 b = v*(0.983729*v + 0.4329510) + 0.238081;
  return sat3(m2*(a/b));
}
vec3 toSRGB(vec3 c){
  return mix(c*12.92, 1.055*pow(max(c, vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main(){
  // tent resolve of the sub-native-resolution buffer
  vec3 col = texture(uScene, vUv).rgb*0.4;
  col += (texture(uScene, vUv + vec2( uTexel.x,  uTexel.y)*0.75).rgb
        + texture(uScene, vUv + vec2(-uTexel.x,  uTexel.y)*0.75).rgb
        + texture(uScene, vUv + vec2( uTexel.x, -uTexel.y)*0.75).rgb
        + texture(uScene, vUv + vec2(-uTexel.x, -uTexel.y)*0.75).rgb)*0.15;

  col += texture(uBloom, vUv).rgb*uBloomStr;
  col *= uExposure;
  col = aces(col);

  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette*dot(q, q)*1.35;
  // fract() keeps the dither stable once the scene has been running for hours
  col += (fract(sin(dot(vUv*vec2(1.0 + fract(uTime)), vec2(12.9898, 78.233)))*43758.5453) - 0.5)*0.0035;
  oC = vec4(toSRGB(max(col, vec3(0.0))), 1.0);
}`;
