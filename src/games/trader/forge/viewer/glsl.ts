/** GLSL pieces shared by the viewer's shaders. */

/** 3D simplex noise (Ian McEwan, Ashima Arts, MIT licence), fbm, ridged noise, cell noise and hashes. */
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p,int oct){
  float a=0.5,s=0.0;
  for(int i=0;i<10;i++){ if(i>=oct) break; s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s;
}
float ridged(vec3 p,int oct){
  float a=0.5,s=0.0;
  for(int i=0;i<10;i++){ if(i>=oct) break; float n=1.0-abs(snoise(p)); s+=a*n*n; p=p*2.07+vec3(3.1,1.3,7.7); a*=0.5; }
  return s;
}
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){ p=fract(p*vec3(0.1031,0.1030,0.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
// x: distance to the nearest cell point, y: to the second nearest, z: the nearest cell's id (0..1)
vec3 worley(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); float d1=8.0,d2=8.0,id=0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g=vec3(float(x),float(y),float(z));
    vec3 r=g+hash33(i+g)-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; id=hash13(i+g); } else if(d<d2){ d2=d; }
  }
  return vec3(sqrt(d1),sqrt(d2),id);
}
`;

/** Turns a colour round the grey axis (a hue shift that keeps brightness). */
export const HUE = /* glsl */ `
vec3 hueShift(vec3 c,float a){ const vec3 k=vec3(0.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca); }
`;

/** A direction to equirectangular map coordinates (three.js sphere layout), without a seam where u wraps. */
export const DIR_UV = /* glsl */ `
vec2 dirToUv(vec3 d){
  float u=atan(d.z,-d.x+1e-7)*0.15915494;
  float v=1.0-acos(clamp(d.y,-1.0,1.0))*0.31830989;
  float u1=fract(u); float u2=fract(u+0.5)-0.5;
  return vec2(fwidth(u1)<=fwidth(u2)+1e-6?u1:u2,v);
}
vec3 uvToDir(vec2 uv){
  float ph=uv.x*6.2831853; float th=(1.0-uv.y)*3.14159265;
  return vec3(-cos(ph)*sin(th),cos(th),sin(ph)*sin(th));
}
`;

/** Bends a normal by a height value's screen-space slope (bump mapping without tangents, as three.js does). */
export const BUMP = /* glsl */ `
vec3 bumpNormal(vec3 pos,vec3 n,float h,float scale){
  vec2 dh=vec2(dFdx(h),dFdy(h))*scale;
  vec3 sx=dFdx(pos); vec3 sy=dFdy(pos);
  vec3 r1=cross(sy,n); vec3 r2=cross(n,sx);
  float det=dot(sx,r1);
  if(abs(det)<1e-14) return n;
  vec3 grad=sign(det)*(dh.x*r1+dh.y*r2);
  vec3 b=abs(det)*n-grad;
  return dot(b,b)>1e-30?normalize(b):n;
}
`;

/** The suns' light, shared by every lit shader: up to two stars, plus the pulsar's sweeping beams. */
export const LIGHTS = /* glsl */ `
uniform vec3 uLightPos[2];
uniform vec3 uLightCol[2];
uniform int uLightCount;
uniform vec3 uBeamDir;
uniform float uBeamOn;
uniform vec3 uAmbient;
uniform float uTime;
vec3 lightAt(int i,vec3 p){
  vec3 c=uLightCol[i];
  if(uBeamOn>0.5){ float b=abs(dot(normalize(p-uLightPos[i]),uBeamDir)); c*=0.55+4.0*pow(b,300.0); }
  return c;
}
`;

/** Ends a fragment shader: tone mapping and colour space when drawing straight to the screen (Simple level). */
export const FINISH = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
