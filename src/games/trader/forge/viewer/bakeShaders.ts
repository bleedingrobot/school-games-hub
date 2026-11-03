/**
 * The shaders that draw the stand-in pictures (planet surfaces, night lights, clouds, skies) into textures on the GPU,
 * so the viewer looks finished with no paintings. Output is stored as sRGB-ish values in 8-bit textures.
 *
 * Planet output 0: rgb colour, a shine (water/ice/crystal). Output 1: rgb glow (night lights, lava), a height.
 * Output 2: rgb cloud colour, a cloud cover.
 */
import { DIR_UV, HUE, NOISE } from './glsl';

export const KIND_ID: Record<string, number> = {
  rocky: 0, desert: 1, ice: 2, ocean: 3, lava: 4, jungle: 5, gas: 6, icegiant: 7, crystal: 8, toxic: 9, eyeball: 10,
  shattered: 11, cube: 12, donut: 13, ringworld: 14, moon: 15,
};
export const LIFE_ID: Record<string, number> = { none: 0, microbes: 1, plants: 2, sea: 3, animals: 4, floaters: 5, crystalfolk: 6, robots: 7, cities: 8 };
export const CLOUD_ID: Record<string, number> = { none: 0, thin: 1, thick: 2, storms: 3, spot: 4 };

export const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;

export const PLANET_BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uKind; uniform vec3 uSeed; uniform float uVar; uniform float uTint; uniform vec3 uPlants;
uniform int uLife; uniform float uLifeAmt; uniform float uVolcano; uniform float uTerra; uniform int uOut; uniform int uCloud;
uniform int uOct; uniform float uSpot;
${NOISE}
${HUE}
${DIR_UV}
#define PI 3.14159265
vec3 srgb(float r,float g,float b){ return vec3(r,g,b)/255.0; }

vec3 swirl(vec3 d,vec3 c,float strength,float radius){
  float r=acos(clamp(dot(d,c),-1.0,1.0));
  float a=strength*exp(-r/radius);
  float ca=cos(a),sa=sin(a);
  return d*ca+cross(c,d)*sa+c*dot(c,d)*(1.0-ca);
}
vec2 localXY(vec3 d,vec3 c){
  vec3 e1=normalize(cross(c,vec3(0.0,1.0,0.0)+vec3(0.001,0.0,0.0)));
  vec3 e2=cross(c,e1);
  return vec2(dot(d,e1),dot(d,e2));
}
float craters(vec3 p,float amt){
  float h=0.0,a=1.0;
  for(int k=0;k<4;k++){
    vec3 w=worley(p*(2.2+float(k)*2.6)+float(k)*7.3);
    if(w.z>0.25){
      float rad=mix(0.18,0.42,fract(w.z*13.7));
      float r=w.x/rad;
      float bowl=r<1.0?(r*r-1.0)*0.55:0.0;
      float rim=exp(-(r-1.0)*(r-1.0)*12.25)*0.3;
      h+=(bowl+rim)*a*amt;
    }
    a*=0.55;
  }
  return h;
}

// Earth-like land and sea. Returns colour; sets shine, height and land (0 sea .. 1 land).
vec3 earthy(vec3 d,vec3 p,float sea,out float spec,out float h,out float land){
  float n=fbm(p*1.7,uOct)+0.35*ridged(p*3.2+4.0,5)-0.17;
  float e=n-sea;
  vec3 col;
  vec3 deep=srgb(8.0,30.0,78.0), shallow=srgb(22.0,98.0,150.0);
  if(uVar>2.5){ deep=srgb(10.0,40.0,60.0); shallow=srgb(30.0,130.0,140.0); }
  if(e<0.0){
    float dep=clamp(-e*3.0,0.0,1.0);
    col=mix(shallow,deep,sqrt(dep));
    spec=1.0; h=0.45-dep*0.05; land=0.0;
  } else {
    float t=clamp(e*2.2,0.0,1.0);
    vec3 low=mix(srgb(150.0,130.0,90.0),srgb(120.0,105.0,72.0),fbm(p*9.0,3)*0.5+0.5);
    if(uVar>0.5&&uVar<1.5) low=srgb(170.0,120.0,80.0);
    vec3 mid=srgb(110.0,92.0,74.0), high=srgb(140.0,135.0,130.0);
    col=mix(low,mid,smoothstep(0.15,0.5,t));
    col=mix(col,high,smoothstep(0.5,0.85,t));
    col=mix(srgb(200.0,190.0,150.0),col,smoothstep(0.0,0.03,e));
    col=mix(col,vec3(0.95),smoothstep(0.82,0.95,t));
    spec=0.0; h=0.5+t*0.5; land=1.0;
  }
  float cap=smoothstep(0.8,0.9,abs(d.y)+fbm(p*4.0,4)*0.08);
  col=mix(col,vec3(0.93,0.96,1.0),cap); spec*=1.0-cap; land*=1.0-cap; h=mix(h,0.55,cap);
  return col;
}

void main(){
  vec3 d=uvToDir(vUv);
  vec3 p=d+uSeed;

  if(uOut==2){
    // ---- clouds
    float a=0.0; vec3 cc=vec3(1.0);
    vec3 q=d;
    if(uKind==6||uKind==7){
      float y=d.y+fbm(p*vec3(2.0,9.0,2.0),4)*0.05;
      float streak=fbm(vec3(d.x*3.0,y*26.0,d.z*3.0)+uSeed,4);
      a=smoothstep(0.1,0.6,streak)*(uCloud>=2?0.45:0.25);
      cc=uKind==6?srgb(250.0,240.0,225.0):srgb(225.0,245.0,255.0);
    } else {
      if(uCloud>=3){
        for(int i=0;i<4;i++){
          vec3 c=normalize(hash33(uSeed*7.0+float(i)*3.1)*2.0-1.0);
          c.y*=0.7; c=normalize(c);
          q=swirl(q,c,uCloud==4&&i==0?9.0:5.0,uCloud==4&&i==0?0.22:0.12);
        }
      }
      vec3 z=vec3(q.x,q.y*1.5,q.z)*2.2+uSeed*2.0;
      float w=fbm(z*1.3,4);
      float n=fbm(z+w*0.9,uOct)+0.25*fbm(z*5.0,4);
      if(uCloud==1) a=smoothstep(0.12,0.55,n)*0.6;
      else if(uCloud==2) a=smoothstep(-0.25,0.3,n)*0.95;
      else a=smoothstep(-0.05,0.4,n)*0.9;
      if(uCloud==4){
        vec3 c=normalize(hash33(uSeed*7.0)*2.0-1.0); c.y*=0.7; c=normalize(c);
        float r=acos(clamp(dot(d,c),-1.0,1.0));
        vec2 xy=localXY(d,c);
        float ang=atan(xy.y,xy.x);
        float arms=0.5+0.5*sin(ang*2.0+log(r+0.001)*9.0);
        float storm=smoothstep(0.38,0.05,r)*(0.55+0.45*arms)*smoothstep(0.012,0.04,r);
        a=max(a*0.7,storm);
      }
      a*=1.0-smoothstep(0.92,1.0,abs(d.y))*0.5;
      if(uKind==9) cc=srgb(235.0,225.0,170.0);
      if(uKind==4) cc=srgb(120.0,110.0,100.0);
    }
    gl_FragColor=vec4(cc,clamp(a,0.0,1.0));
    return;
  }

  vec3 col=vec3(0.5); float spec=0.0; vec3 emis=vec3(0.0); float h=0.5; float land=1.0; float vegOk=1.0;
  float moist=fbm(d*2.4+uSeed*1.7+5.0,4)*0.5+0.5;

  if(uKind==0||uKind==11||uKind==15){
    // rocky, shattered, moons: dust, maria and craters
    float n=fbm(p*2.0,uOct);
    vec3 a=srgb(128.0,120.0,112.0), b=srgb(70.0,66.0,62.0);
    float v=uKind==15?uVar:uVar;
    if(v>0.5&&v<1.5){ a=srgb(150.0,110.0,80.0); b=srgb(90.0,60.0,45.0); }
    if(v>1.5&&v<2.5){ a=srgb(170.0,150.0,120.0); b=srgb(110.0,80.0,60.0); }
    if(v>2.5&&v<3.5){ a=srgb(80.0,78.0,82.0); b=srgb(40.0,38.0,44.0); }
    if(uKind==15){
      if(v>3.5&&v<4.5){ a=srgb(225.0,232.0,240.0); b=srgb(150.0,170.0,190.0); }
      if(v>4.5&&v<5.5){ a=srgb(230.0,200.0,90.0); b=srgb(160.0,90.0,40.0); }
      if(v>5.5&&v<6.5){ a=srgb(140.0,160.0,190.0); b=srgb(70.0,80.0,110.0); }
      if(v>6.5){ a=srgb(235.0,200.0,120.0); b=srgb(170.0,120.0,60.0); }
    }
    float maria=smoothstep(0.0,0.25,fbm(p*0.9+3.0,4));
    col=mix(a,b,maria*0.8);
    col*=0.85+0.3*n;
    float cr=craters(p*1.3,1.0);
    h=0.55+cr*0.6+n*0.15;
    col*=1.0+cr*0.5;
    vec3 w=worley(p*3.0);
    float ray=smoothstep(0.08,0.0,w.x)*step(0.85,w.z);
    col=mix(col,col*1.3+0.08,ray*0.5);
    if(uKind==11){
      float r=ridged(p*3.0,5);
      float glow=smoothstep(0.62,0.85,r);
      emis=mix(vec3(0.0),srgb(255.0,120.0,30.0),glow);
      col=mix(col,srgb(60.0,30.0,20.0),glow*0.5);
    }
    if(uKind==15&&v>4.5&&v<5.5){
      float vol=smoothstep(0.1,0.0,worley(p*4.0).x);
      col=mix(col,srgb(60.0,30.0,10.0),vol); emis+=srgb(255.0,110.0,20.0)*vol*0.8;
    }
    if(uKind==15&&v>3.5&&v<4.5){ float l=pow(1.0-abs(snoise(p*3.0)),14.0); col=mix(col,srgb(150.0,80.0,50.0),l*0.7); spec=0.2; }
    land=uKind==15?0.0:1.0;
  } else if(uKind==1){
    // desert: sand seas, dunes, canyons
    vec3 s1=srgb(210.0,140.0,80.0), s2=srgb(160.0,80.0,45.0);
    if(uVar>0.5&&uVar<1.5){ s1=srgb(225.0,195.0,140.0); s2=srgb(180.0,140.0,90.0); }
    if(uVar>1.5&&uVar<2.5){ s1=srgb(235.0,225.0,205.0); s2=srgb(190.0,170.0,150.0); }
    if(uVar>2.5){ s1=srgb(120.0,90.0,80.0); s2=srgb(70.0,50.0,45.0); }
    float n=fbm(p*1.6,uOct);
    col=mix(s1,s2,smoothstep(-0.4,0.5,n));
    float duneZone=smoothstep(0.0,-0.3,n);
    float dunes=sin(dot(d,normalize(vec3(1.0,0.2,0.4)))*140.0+fbm(p*4.0,4)*10.0);
    dunes=pow(dunes*0.5+0.5,3.0);
    col*=1.0+duneZone*(dunes-0.4)*0.18;
    vec3 wp=p*2.2+vec3(fbm(p*2.0,4),fbm(p*2.0+7.0,4),0.0)*0.5;
    float canyon=pow(1.0-abs(snoise(wp)),12.0)*smoothstep(-0.1,0.3,n);
    col=mix(col,s2*0.55,canyon*0.85);
    float cr=craters(p,0.4);
    h=0.5+n*0.25+duneZone*dunes*0.06-canyon*0.35+cr*0.3;
    float cap=smoothstep(0.9,0.96,abs(d.y)+fbm(p*5.0,3)*0.05);
    col=mix(col,vec3(0.95),cap);
    land=1.0;
  } else if(uKind==2){
    // ice: cracked shell
    vec3 b1=srgb(230.0,238.0,245.0), b2=srgb(175.0,200.0,220.0);
    vec3 crk=srgb(150.0,85.0,55.0);
    if(uVar>0.5&&uVar<1.5){ crk=srgb(60.0,110.0,170.0); }
    if(uVar>1.5&&uVar<2.5){ b1=srgb(240.0,235.0,225.0); b2=srgb(205.0,190.0,175.0); crk=srgb(170.0,90.0,90.0); }
    if(uVar>2.5){ b1=srgb(205.0,230.0,240.0); b2=srgb(130.0,180.0,205.0); crk=srgb(40.0,70.0,110.0); }
    float n=fbm(p*1.8,uOct);
    col=mix(b1,b2,smoothstep(-0.5,0.6,n));
    vec3 wp=p*1.5+fbm(p*1.5,4)*0.6;
    float lines=0.0;
    lines=max(lines,pow(1.0-abs(snoise(wp*2.0)),24.0));
    lines=max(lines,pow(1.0-abs(snoise(wp*4.3+3.0)),30.0)*0.8);
    lines=max(lines,pow(1.0-abs(snoise(wp*9.0+9.0)),36.0)*0.5);
    col=mix(col,crk,lines*0.85);
    col=mix(col,crk*0.9+0.1,smoothstep(0.3,0.6,fbm(p*0.8+2.0,4))*0.35);
    h=0.55+n*0.1-lines*0.25;
    spec=0.35*(1.0-lines);
    land=0.0; vegOk=0.0;
  } else if(uKind==3){
    col=earthy(d,p,0.28+uVar*0.02,spec,h,land);
  } else if(uKind==4){
    // lava: dark crust, glowing cracks and lakes
    float n=fbm(p*2.0,uOct);
    float r=ridged(p*3.2+fbm(p*1.8,4)*0.7,6);
    vec3 crust=mix(srgb(18.0,14.0,12.0),srgb(70.0,52.0,40.0),n*0.5+0.5);
    if(uVar>0.5&&uVar<1.5) crust=mix(srgb(30.0,20.0,25.0),srgb(80.0,50.0,60.0),n*0.5+0.5);
    if(uVar>1.5&&uVar<2.5) crust=mix(srgb(40.0,38.0,30.0),srgb(110.0,100.0,60.0),n*0.5+0.5);
    float cracks=smoothstep(0.58,0.86,r);
    float lakes=smoothstep(0.22,0.38,-n);
    float glow=max(cracks,lakes);
    vec3 hot=uVar>2.5?srgb(90.0,190.0,255.0):srgb(255.0,85.0,12.0);
    col=mix(crust,hot*0.6,glow*0.7);
    emis=hot*glow*0.8+vec3(1.0,0.75,0.4)*pow(glow,4.0)*0.25;
    h=0.55+n*0.3-glow*0.25;
    land=0.0; vegOk=0.0;
  } else if(uKind==5){
    col=earthy(d,p,0.0+uVar*0.03,spec,h,land);
    // rivers
    float riv=pow(1.0-abs(snoise(p*3.0+fbm(p*2.0,3)*0.6)),40.0)*land;
    col=mix(col,srgb(30.0,90.0,120.0),riv*0.8); spec=max(spec,riv);
  } else if(uKind==6||uKind==7){
    // gas and ice giants: bands and a storm spot
    vec3 c1,c2,c3;
    if(uKind==6){
      c1=srgb(232.0,214.0,180.0); c2=srgb(180.0,120.0,80.0); c3=srgb(140.0,80.0,55.0);
      if(uVar>0.5&&uVar<1.5){ c1=srgb(240.0,222.0,170.0); c2=srgb(205.0,170.0,110.0); c3=srgb(170.0,140.0,90.0); }
      if(uVar>1.5&&uVar<2.5){ c1=srgb(225.0,200.0,240.0); c2=srgb(150.0,100.0,190.0); c3=srgb(90.0,60.0,140.0); }
      if(uVar>2.5){ c1=srgb(200.0,240.0,225.0); c2=srgb(90.0,170.0,160.0); c3=srgb(40.0,110.0,120.0); }
    } else {
      c1=srgb(170.0,225.0,235.0); c2=srgb(120.0,190.0,215.0); c3=srgb(60.0,110.0,190.0);
      if(uVar>0.5&&uVar<1.5){ c1=srgb(120.0,160.0,240.0); c2=srgb(70.0,110.0,215.0); c3=srgb(30.0,50.0,140.0); }
      if(uVar>1.5&&uVar<2.5){ c1=srgb(190.0,240.0,220.0); c2=srgb(140.0,210.0,200.0); c3=srgb(80.0,150.0,160.0); }
      if(uVar>2.5){ c1=srgb(210.0,220.0,245.0); c2=srgb(160.0,175.0,225.0); c3=srgb(100.0,110.0,190.0); }
    }
    vec3 sc=normalize(vec3(0.6,-0.32,0.7)+hash33(uSeed)*0.3);
    float spotAmt=uKind==6?max(uSpot,0.55):uSpot;
    vec3 q=swirl(d,sc,5.0*spotAmt,0.09);
    float y=q.y+fbm(q*vec3(2.0,7.0,2.0)+uSeed,5)*0.05+fbm(q*vec3(5.0,26.0,5.0)+uSeed,4)*0.012;
    float freq=uKind==6?7.0+uVar:4.0+uVar*0.5;
    float band=sin(y*PI*freq+fbm(q*vec3(1.5,4.0,1.5),3)*1.2);
    float band2=sin(y*PI*freq*2.7+1.3);
    float contrast=uKind==6?1.0:0.35;
    col=mix(c1,c2,smoothstep(-0.6,0.6,band)*contrast);
    col=mix(col,c3,smoothstep(0.55,0.95,band2)*0.35*contrast);
    float turb=fbm(vec3(q.x*4.0,y*40.0,q.z*4.0)+uSeed,uOct);
    col*=0.93+0.14*turb;
    // the spot
    vec2 xy=localXY(d,sc);
    float e=length(vec2(xy.x/0.17,xy.y/0.095))/max(spotAmt,0.3);
    vec3 spotCol=uKind==6?srgb(200.0,95.0,60.0):srgb(25.0,40.0,110.0);
    float inside=smoothstep(1.0,0.75,e);
    col=mix(col,spotCol*(0.85+0.15*sin(e*14.0)),inside*(uKind==6?0.9:0.8)*step(0.01,spotAmt));
    col=mix(col,vec3(1.0),smoothstep(1.05,0.95,e)*smoothstep(0.85,0.95,e)*0.25*step(0.01,spotAmt));
    h=0.5; land=0.0; vegOk=0.0;
    // gas giant poles a little darker
    col*=1.0-smoothstep(0.75,1.0,abs(d.y))*0.25;
  } else if(uKind==8){
    // crystal: facets and glowing veins
    vec3 w=worley(p*4.0);
    vec3 w2=worley(p*11.0+5.0);
    vec3 ca=srgb(170.0,120.0,235.0), cb=srgb(90.0,230.0,240.0);
    if(uVar>0.5&&uVar<1.5){ ca=srgb(240.0,120.0,190.0); cb=srgb(255.0,210.0,240.0); }
    if(uVar>1.5&&uVar<2.5){ ca=srgb(230.0,240.0,255.0); cb=srgb(150.0,200.0,255.0); }
    if(uVar>2.5){ ca=srgb(120.0,240.0,150.0); cb=srgb(230.0,255.0,140.0); }
    col=mix(ca,cb,w.z);
    col*=0.55+0.5*fract(w2.z*7.0);
    float edge=smoothstep(0.0,0.06,w.y-w.x);
    float edge2=smoothstep(0.0,0.04,w2.y-w2.x);
    col*=0.55+0.45*edge;
    h=0.25+0.55*w.z+0.15*w2.z-(1.0-edge)*0.2-(1.0-edge2)*0.05;
    emis=mix(cb,vec3(1.0),0.3)*(1.0-edge)*0.35;
    spec=0.85*edge;
    land=0.0; vegOk=0.0;
  } else if(uKind==9){
    // toxic swamp
    float n=fbm(p*2.2,uOct);
    vec3 l1=srgb(110.0,100.0,40.0), l2=srgb(60.0,60.0,30.0), wat=srgb(90.0,120.0,40.0);
    if(uVar>0.5&&uVar<1.5){ l1=srgb(120.0,80.0,110.0); l2=srgb(70.0,40.0,70.0); wat=srgb(150.0,60.0,140.0); }
    if(uVar>1.5&&uVar<2.5){ l1=srgb(150.0,130.0,60.0); l2=srgb(100.0,80.0,40.0); wat=srgb(200.0,180.0,40.0); }
    if(uVar>2.5){ l1=srgb(60.0,90.0,70.0); l2=srgb(30.0,50.0,40.0); wat=srgb(60.0,200.0,120.0); }
    float sw=smoothstep(0.02,-0.08,n+fbm(p*8.0,3)*0.08);
    col=mix(l1,l2,smoothstep(-0.2,0.5,fbm(p*5.0,4)));
    float streak=pow(1.0-abs(snoise(p*6.0)),8.0);
    col=mix(col,srgb(190.0,180.0,60.0),streak*0.25);
    col=mix(col,wat,sw);
    spec=sw*0.7;
    emis=wat*sw*smoothstep(0.4,0.8,fbm(p*12.0,3)+0.5)*0.4;
    h=0.5+n*0.25-sw*0.1;
    land=1.0-sw;
  } else if(uKind==10){
    // eyeball: hot side faces the sun (direction -x), ice at night, life in the ring between
    vec3 D0=vec3(-1.0,0.0,0.0);
    float c=dot(d,D0)+fbm(p*3.0,4)*0.12;
    float s; float hh; float ll;
    vec3 ring=earthy(d,p,0.05,s,hh,ll);
    vec3 hot=mix(srgb(230.0,170.0,90.0),srgb(170.0,90.0,50.0),fbm(p*3.0,uOct)*0.5+0.5);
    if(uVar>1.5) hot=mix(srgb(20.0,70.0,120.0),srgb(10.0,40.0,80.0),fbm(p*3.0,4)*0.5+0.5);
    vec3 ice=mix(srgb(230.0,240.0,250.0),srgb(180.0,200.0,225.0),fbm(p*4.0,4)*0.5+0.5);
    float wHot=smoothstep(0.25,0.55,c), wIce=smoothstep(-0.25,-0.55,c);
    col=mix(ring,hot,wHot); col=mix(col,ice,wIce);
    spec=mix(s,uVar>1.5?1.0:0.0,wHot)*(1.0-wIce)+wIce*0.25;
    h=mix(hh,0.5+fbm(p*4.0,4)*0.2,max(wHot,wIce));
    land=ll*(1.0-wHot)*(1.0-wIce);
    float ringGlow=smoothstep(0.35,0.0,abs(c+0.05));
    col=mix(col,col*1.08,ringGlow);
  } else {
    // cube, donut, ring world: a friendly green-and-blue world
    float sea=uKind==14?0.05:-0.05;
    col=earthy(d,p,sea+uVar*0.05,spec,h,land);
    if(uKind==13&&uVar>2.5){ col=mix(col,srgb(250.0,170.0,200.0),land*0.5); }
  }

  // the tint: a colour shift of the painting (not the plants, they follow the sun)
  col=clamp(hueShift(col,uTint),0.0,1.0);
  emis=clamp(hueShift(emis,uKind==4?0.0:uTint*0.5),0.0,1.0);

  // life and effects
  float detail=fbm(p*14.0,3)*0.5+0.5;
  float vegAmt=uKind==5?0.95:uKind==10?0.0:0.0;
  if(uLife==2||uLife==4) vegAmt=max(vegAmt,0.8*uLifeAmt);
  if(uLife==8||uLife==7) vegAmt=max(vegAmt,0.45*uLifeAmt);
  if(uKind==10&&(uLife==2||uLife==4||uLife==8)) vegAmt=0.9*uLifeAmt;
  vegAmt=max(vegAmt,uTerra*0.7);
  if(uKind==14) vegAmt=max(vegAmt,0.85);
  float veg=land*vegOk*smoothstep(0.32,0.6,moist+(1.0-abs(d.y))*0.15)*(1.0-smoothstep(0.75,0.95,h));
  vec3 plant=uPlants*(0.75+0.5*detail);
  col=mix(col,plant,veg*vegAmt);
  if(uLife==1){
    float m=smoothstep(0.55,0.75,fbm(p*6.0+11.0,4)+0.5)*uLifeAmt;
    col=mix(col,mix(srgb(60.0,200.0,170.0),srgb(220.0,110.0,160.0),moist),m*0.35*(1.0-land*0.6));
    emis+=srgb(60.0,220.0,180.0)*m*0.15*spec;
  }
  if(uLife==3){
    float pat=pow(0.5+0.5*sin(dot(d,vec3(30.0,4.0,20.0))+fbm(p*5.0,4)*6.0),6.0);
    col=mix(col,col+srgb(20.0,60.0,60.0),pat*spec*0.6*uLifeAmt);
    emis+=srgb(40.0,200.0,220.0)*pat*spec*0.3*uLifeAmt;
  }
  if(uLife==5){
    vec3 cell=floor(d*90.0);
    float sp=step(0.985,hash13(cell+uSeed))*uLifeAmt;
    col=mix(col,srgb(255.0,170.0,220.0),sp*0.7);
    emis+=srgb(255.0,120.0,210.0)*sp*0.8;
  }
  if(uLife==6){ emis*=1.0+2.5*uLifeAmt; }
  if(uLife==7){
    float lon=atan(d.z,-d.x)*8.0, lt=asin(d.y)*8.0;
    vec2 g=abs(fract(vec2(lon,lt)*6.0)-0.5);
    float grid=(1.0-smoothstep(0.0,0.04,min(g.x,g.y)))*smoothstep(0.1,0.35,fbm(p*3.0,4))*max(land,0.2);
    emis+=srgb(120.0,220.0,255.0)*grid*0.8*uLifeAmt;
    vec2 f=fract(vec2(lon,lt)*3.0);
    float panel=step(0.6,hash13(floor(vec3(lon,lt,0.0)*3.0)))*step(0.1,f.x)*step(0.1,f.y)*land*smoothstep(0.0,0.3,fbm(p*3.0,4));
    col=mix(col,srgb(30.0,40.0,90.0),panel*0.6*uLifeAmt);
  }
  if(uLife==8){
    float coast=1.0-smoothstep(0.0,0.6,h-0.5);
    float town=smoothstep(0.15,0.55,fbm(p*7.0,4)+coast*0.3)*land;
    float dots=smoothstep(0.55,0.95,hash13(floor(d*420.0)))*0.6+smoothstep(0.2,0.7,fbm(p*40.0,3)+0.3)*0.6;
    float lights=town*dots;
    float roads=pow(1.0-abs(snoise(p*9.0)),26.0)*town;
    emis+=srgb(255.0,190.0,110.0)*(lights+roads*0.7)*1.0*uLifeAmt;
    col=mix(col,srgb(120.0,115.0,110.0),town*0.25*uLifeAmt);
  }
  if(uVolcano>0.0){
    vec3 w=worley(p*3.2+2.0);
    float cone=smoothstep(0.22,0.0,w.x)*step(0.55,w.z);
    float vent=smoothstep(0.06,0.0,w.x)*step(0.55,w.z);
    col=mix(col,srgb(40.0,30.0,25.0),cone*0.7);
    float flow=pow(1.0-abs(snoise(p*7.0)),10.0)*cone;
    emis+=srgb(255.0,100.0,20.0)*(vent+flow*0.7)*uVolcano;
    h+=cone*0.25-vent*0.2;
  }

  if(uOut==0) gl_FragColor=vec4(col,clamp(spec,0.0,1.0));
  else gl_FragColor=vec4(clamp(emis,0.0,1.0),clamp(h,0.0,1.0));
}
`;

/** The sky panorama: nebulae, the Milky Way, a close galaxy and faint stars, by background number. */
export const SKY_BAKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uBg; uniform vec3 uSeed; uniform int uOct;
${NOISE}
${DIR_UV}
vec3 srgb(float r,float g,float b){ return vec3(r,g,b)/255.0; }
vec3 nebula(vec3 d,vec3 c1,vec3 c2,vec3 c3,float amt,float scale){
  vec3 p=d*scale+uSeed;
  vec3 w=vec3(fbm(p,4),fbm(p+5.2,4),fbm(p+9.1,4));
  float n=fbm(p+w*1.4,uOct);
  float n2=fbm(p*2.0-w,uOct);
  float dens=smoothstep(-0.1,0.7,n)*amt;
  vec3 col=mix(c1,c2,smoothstep(-0.3,0.5,n2));
  col=mix(col,c3,smoothstep(0.35,0.8,n)*0.7);
  float dust=smoothstep(0.1,0.5,fbm(p*3.0+w,5));
  return col*dens*(1.0-dust*0.6);
}
void main(){
  vec3 d=uvToDir(vUv);
  vec3 col=srgb(2.0,3.0,8.0);
  // faint background stars
  for(int k=0;k<3;k++){
    float sc=180.0+float(k)*190.0;
    vec3 cell=floor(d*sc);
    float hsh=hash13(cell+uSeed+float(k)*17.0);
    vec3 off=hash33(cell+uSeed)-0.5;
    float dist=length(fract(d*sc)-0.5-off*0.6);
    float star=step(0.992-float(k)*0.002,hsh)*smoothstep(0.35,0.0,dist);
    vec3 tint=mix(vec3(0.7,0.8,1.0),vec3(1.0,0.85,0.7),fract(hsh*31.0));
    col+=tint*star*(0.5-float(k)*0.12);
  }
  if(uBg==0){
    col+=nebula(d,srgb(70.0,20.0,110.0),srgb(160.0,40.0,140.0),srgb(60.0,110.0,220.0),0.55,1.4);
  } else if(uBg==1||uBg==2){
    vec3 nrm=normalize(vec3(0.3,1.0,0.25));
    float b=dot(d,nrm);
    float band=exp(-b*b*(uBg==1?22.0:40.0));
    vec3 p=d*3.0+uSeed;
    float clumps=fbm(p,uOct)*0.5+0.5;
    float lanes=smoothstep(0.3,0.7,fbm(p*1.7+3.0,5)+0.5)*exp(-b*b*80.0);
    vec3 mw=mix(srgb(90.0,95.0,130.0),srgb(210.0,180.0,140.0),clumps)*band*(0.35+0.5*clumps);
    mw*=1.0-lanes*0.8;
    vec3 core=normalize(vec3(0.8,-0.25,0.5));
    mw+=srgb(255.0,200.0,140.0)*pow(max(dot(d,core),1e-6),40.0)*0.5*band;
    col+=mw*(uBg==1?1.0:0.45);
    float sp=smoothstep(0.9965,1.0,hash13(floor(d*600.0)+uSeed))*band;
    col+=vec3(0.8)*sp;
    if(uBg==2){
      vec3 gc=normalize(vec3(-0.5,0.35,-0.8));
      vec3 e1=normalize(cross(gc,vec3(0.2,1.0,0.1))); vec3 e2=cross(gc,e1);
      vec2 xy=vec2(dot(d,e1),dot(d,e2));
      xy=vec2(xy.x*cos(0.5)-xy.y*sin(0.5),xy.x*sin(0.5)+xy.y*cos(0.5));
      xy.y*=2.2;
      float r=length(xy); float a=atan(xy.y,xy.x);
      float arms=pow(0.5+0.5*cos(2.0*a-log(r+0.001)*5.0),2.0);
      float disc=exp(-r/0.09)*step(0.0,dot(d,gc));
      float n=fbm(vec3(xy*20.0,1.0),4)*0.5+0.5;
      vec3 g=mix(srgb(120.0,150.0,255.0),srgb(255.0,210.0,170.0),exp(-r/0.03));
      col+=g*disc*(0.25+0.9*arms*n)+srgb(255.0,230.0,190.0)*exp(-r/0.012)*1.4*step(0.0,dot(d,gc));
    }
  } else if(uBg==3){
    col*=0.6;
    col+=nebula(d,srgb(10.0,14.0,40.0),srgb(25.0,20.0,50.0),srgb(40.0,50.0,90.0),0.25,1.0);
  } else if(uBg==4){
    col+=nebula(d,srgb(10.0,60.0,120.0),srgb(30.0,160.0,180.0),srgb(160.0,230.0,255.0),0.55,1.3);
  } else if(uBg==5){
    col+=nebula(d,srgb(130.0,25.0,25.0),srgb(220.0,90.0,40.0),srgb(255.0,190.0,120.0),0.55,1.2);
    col+=nebula(d.zxy,srgb(20.0,30.0,80.0),srgb(40.0,60.0,140.0),srgb(80.0,120.0,200.0),0.18,2.0);
  } else if(uBg==6){
    col+=nebula(d,srgb(20.0,90.0,60.0),srgb(120.0,180.0,60.0),srgb(240.0,210.0,110.0),0.5,1.4);
  } else {
    vec3 a=nebula(d,srgb(200.0,60.0,140.0),srgb(60.0,120.0,230.0),srgb(120.0,240.0,200.0),0.45,1.2);
    vec3 b=nebula(d.yzx,srgb(240.0,160.0,60.0),srgb(150.0,60.0,220.0),srgb(255.0,255.0,255.0),0.3,1.8);
    col+=a+b;
  }
  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}
`;
