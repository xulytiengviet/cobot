export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function features(p){
 const size=distance(p[0],p[9]);
 if(size<0.035)return null;
 return [(p[0].x+p[9].x)/2,(p[0].y+p[9].y)/2,size,
 Math.atan2(p[5].y-p[17].y,p[5].x-p[17].x),distance(p[8],p[5])/size,distance(p[4],p[8])/size];
}
export function handTargets(f,ref,angles,limits,gain,single=-1){
 const out=[...angles];
 if(single>=0){out[single]=clamp(angles[single]-(f[0]-ref[0])*5*gain,...limits[single]);return out;}
 const wrapped=Math.atan2(Math.sin(f[3]-ref[3]),Math.cos(f[3]-ref[3]));
 const delta=[-(f[0]-ref[0])*5,-(f[1]-ref[1])*4,(f[2]/ref[2]-1)*2,wrapped,(f[4]-ref[4])*1.8,(f[5]-ref[5])*2];
 return angles.map((a,i)=>clamp(a+delta[i]*gain,...limits[i]));
}
export function advance(current,target,dt,speed=1.2){
 const step=Math.max(0,Math.min(dt,0.05));
 return current.map((q,i)=>q+clamp((target[i]-q)*(1-Math.exp(-8*step)),-speed*step,speed*step));
}
