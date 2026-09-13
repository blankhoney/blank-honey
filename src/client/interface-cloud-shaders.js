// Shader geometry from the user-provided acceptance HTML, BHInterfaceCloud.
export const vertexShader = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aTarget;
attribute vec3 aOrigin;
attribute vec4 aTint;
attribute vec4 aInfo;
attribute vec4 aLayout;
attribute vec4 aSeedTint;
attribute vec2 aSeedInfo;
uniform float uMorph;
uniform vec4 uBoxes[64];
uniform float uTime;
uniform float uFlow;
uniform float uLight;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uScroll;
uniform vec2 uViewport;
uniform vec2 uPointer;
uniform vec4 uBarsA;
uniform vec4 uBarsB;
uniform vec4 uBarsC;
varying vec3 vColor;
varying float vAlpha;
float barValue(float id){
  if(id<.5)return uBarsA.x;
  if(id<1.5)return uBarsA.y;
  if(id<2.5)return uBarsA.z;
  if(id<3.5)return uBarsA.w;
  if(id<4.5)return uBarsB.x;
  if(id<5.5)return uBarsB.y;
  if(id<6.5)return uBarsB.z;
  if(id<7.5)return uBarsB.w;
  if(id<8.5)return uBarsC.x;
  if(id<9.5)return uBarsC.y;
  if(id<10.5)return uBarsC.z;
  return uBarsC.w;
}
void main(){
  float order=aInfo.x;
  float f=smoothstep(.06+order*.18,.72+order*.22,uProgress);
  vec4 box=uBoxes[int(aLayout.x)];
  vec2 local=aLayout.yz;
  if(aLayout.w>.5)local*=box.zw;
  vec3 target=vec3(box.xy+local,aTarget.z)+aPosition;
  target.y-=uScroll;
  float focal=max(uViewport.x,uViewport.y)*1.45;
  // Keep the front face on its DOM target; depth belongs to the raised point ink.
  target.xy=(target.xy-uViewport*.5)*(1.-target.z/focal)+uViewport*.5;
  float phase=uTime*.82+target.x*.009+target.y*.006;
  float slow=sin(phase)+.36*sin(uTime*.47-target.x*.005+target.y*.007);
  float idle=smoothstep(.78,1.,uProgress)*(1.-uLight*.45);
  float relief=(aTarget.z<-.1?1.:.26);
  target.z+=slow*2.8*idle*relief;
  target.x+=sin(phase*.83)*.20*idle;
  target.y+=cos(phase*.67)*.16*idle;
  // A small elastic bow accompanies actual layout displacement, never a new scene.
  target.z+=sin(order*6.28+uTime*2.)*uFlow*13.;
  target.x+=sin(order*11.+uTime)*uFlow*1.6;
  float spread=sin(f*3.14159265);
  vec3 p=mix(aOrigin,target,f);
  p.z+=spread*(95.+70.*sin(order*9.));
  p.x+=spread*sin(order*17.+f*2.1)*85.;
  p.y+=spread*cos(order*9.+f*2.)*45.;
  // A raised front face and recessed side walls occupy different depths.
  // A restrained view shift exposes those walls, without moving the DOM targets.
  p.xy+=uPointer*vec2(.50,.35)*(-target.z)*f;
  float targetAlpha=aTint.a;
  if(aInfo.z>=0. && aInfo.w>barValue(aInfo.z))targetAlpha=0.;
  float pointSize=aInfo.y;
  float gather=1.;
  if(uMorph>.5){
    // Existing ink moves straight to destination ink, without a dispersed intermediate pose.
    gather=smoothstep(0.,1.,uProgress);
    p=mix(aOrigin,target+vec3(uPointer*vec2(.50,.35)*(-target.z),0.),gather);
    pointSize=mix(aSeedInfo.x,aInfo.y,gather);
  }
  float perspective=1.-p.z/focal;
  vec2 screen=(p.xy-uViewport*.5)/perspective+uViewport*.5;
  vec2 ndc=screen/uViewport*2.-1.;
  gl_Position=vec4(ndc.x*perspective,-ndc.y*perspective,(-p.z/focal)*perspective,perspective);
  gl_PointSize=clamp(pointSize*uPixelRatio/perspective,.7,7.*uPixelRatio);
  vAlpha=aTint.a*smoothstep(0.,.13,uProgress);
  if(aInfo.z>=0. && aInfo.w>barValue(aInfo.z))vAlpha=0.;
  float acquisition=1.+.18*exp(-pow((f-.87)*13.,2.));
  float breathe=1.+(.045*sin(phase)+.018*cos(phase*.61))*idle;
  vColor=aTint.rgb*acquisition*breathe;
  if(uMorph>.5){
    float appear=smoothstep(.08,.40,uProgress);
    float sourceAlpha=aSeedTint.a;
    // Extra destination samples emerge during migration; surplus source samples
    // retire only during reconstruction. At t=0 every old sample is drawn once.
    if(sourceAlpha<.001)sourceAlpha=targetAlpha*appear;
    vAlpha=mix(sourceAlpha,targetAlpha,gather);
    vColor=mix(aSeedTint.rgb,aTint.rgb*acquisition*breathe,gather);
  }
}
`;

export const fragmentShader = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d=length(gl_PointCoord-vec2(.5));
  if(d>.5||vAlpha<.01)discard;
  float alpha=(1.-smoothstep(.35,.50,d))*vAlpha;
  gl_FragColor=vec4(vColor,alpha);
}
`;
