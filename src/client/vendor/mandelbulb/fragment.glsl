#version 300 es
precision highp float;
out vec4 outColor;
uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_cam;     // yaw, pitch (radians) — driven by the JS orbit control

#define MAX_STEPS 150
#define ITERS 10
#define SHADOW_STEPS 20

float bulbDE(vec3 p, float power, out vec4 trap){
  vec3 w=p; float m=dot(w,w); vec4 tr=vec4(abs(w),m); float dz=1.0;
  for(int i=0;i<ITERS;i++){
    dz=power*pow(m,(power-1.0)*0.5)*dz+1.0;
    float r=length(w);
    float b=power*acos(clamp(w.y/max(r,1e-6),-1.0,1.0));
    float a=power*atan(w.x,w.z);
    w=p+pow(r,power)*vec3(sin(b)*sin(a),cos(b),sin(b)*cos(a));
    tr=min(tr,vec4(abs(w),m)); m=dot(w,w);
    if(m>256.0) break;
  }
  trap=tr; return 0.25*log(m)*sqrt(m)/dz;
}
float map(vec3 p,float power,out vec4 trap){
  float pulse=1.0+0.03*sin(u_time*0.8);
  return bulbDE(p/pulse,power,trap)*pulse;
}
vec3 calcNormal(vec3 p,float power){
  vec4 tr; vec2 e=vec2(1.0,-1.0)*0.0007;
  return normalize(e.xyy*map(p+e.xyy,power,tr)+e.yyx*map(p+e.yyx,power,tr)+
                   e.yxy*map(p+e.yxy,power,tr)+e.xxx*map(p+e.xxx,power,tr));
}
float softShadow(vec3 ro,vec3 rd,float power){
  #if SHADOW_STEPS==0
  return 1.0;
  #else
  float res=1.0,t=0.02; vec4 tr;
  for(int i=0;i<SHADOW_STEPS;i++){
    float h=map(ro+rd*t,power,tr);
    res=min(res,12.0*h/t);
    t+=clamp(h,0.01,0.25);
    if(res<0.004||t>6.0) break;
  }
  return clamp(res,0.0,1.0);
  #endif
}
vec3 palette(float u){ return 0.5+0.5*cos(6.28318*(u+vec3(0.0,0.33,0.67))); }

void main(){
  vec2 uv=(2.0*gl_FragCoord.xy-u_resolution.xy)/u_resolution.y;
  float et=u_time;
  float power=7.5+1.4*sin(et*0.11)+0.9*sin(et*0.063+1.7);
  float yaw   = u_cam.x;
  float pitch = u_cam.y;
  float cp=cos(pitch),sp=sin(pitch);
  vec3 ro=3.2*vec3(cos(yaw)*cp,sp,sin(yaw)*cp);
  vec3 ww=normalize(-ro),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*ww);
  float b=dot(ro,rd),c=dot(ro,ro)-1.6; float disc=b*b-c;
  vec3 col=vec3(0.02,0.02,0.03);
  if(disc>0.0){
    float h=sqrt(disc),tnear=max(-b-h,0.0),tfar=-b+h;
    float t=tnear; vec4 trap=vec4(0.0); bool hit=false; int steps=0;
    for(int i=0;i<MAX_STEPS;i++){
      vec4 tr; float d=map(ro+rd*t,power,tr); trap=tr;
      if(d<0.0004*t){hit=true;break;}
      t+=d; steps=i; if(t>tfar) break;
    }
    if(hit){
      vec3 p=ro+rd*t; vec3 n=calcNormal(p,power);
      float drift=0.5+0.5*sin(u_time*0.05);
      vec3 albedo=vec3(0.02);
      albedo=mix(albedo,mix(vec3(0.10,0.20,0.30),vec3(0.25,0.10,0.30),drift),clamp(trap.y,0.0,1.0));
      albedo=mix(albedo,vec3(0.02,0.10,0.30),clamp(trap.z*trap.z,0.0,1.0));
      albedo=mix(albedo,mix(vec3(0.30,0.10,0.02),vec3(0.05,0.30,0.15),drift),clamp(pow(trap.w,6.0),0.0,1.0));
      vec3 lightDir=normalize(vec3(0.6,0.9,0.4));
      float dif=clamp(dot(n,lightDir),0.0,1.0);
      float sha=softShadow(p+n*0.01,lightDir,power);
      float amb=0.5+0.5*n.y;
      vec3 hal=normalize(lightDir-rd);
      float spe=pow(clamp(dot(n,hal),0.0,1.0),32.0)*dif*sha;
      float rim=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0);
      col=albedo*(0.5*amb+1.9*dif*sha*vec3(1.0,0.95,0.85));
      col+=0.7*spe; col+=rim*0.15*palette(0.6+0.04*sin(u_time*0.13));
      col=1.0-exp(-2.2*col);
    } else {
      float g=float(steps)/float(MAX_STEPS);
      col+=palette(0.58+0.04*sin(u_time*0.13))*g*g*0.5;
    }
  }
  col=pow(col,vec3(0.4545));
  outColor=vec4(col,1.0);
}
