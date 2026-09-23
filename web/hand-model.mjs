import {clamp,features} from './control.mjs';
export const CHAINS=[[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]];
export const BONES=CHAINS.flatMap(chain=>chain.slice(1).map((p,i)=>[chain[i],p]));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const unit=a=>a.map(v=>v/(norm(a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function handPose(image,world){
 if(!image?.every(p=>[p.x,p.y,p.z??0].every(Number.isFinite))||image.length!==21||!features(image))return null;
 if(world?.some(p=>![p.x,p.y,p.z??0].every(Number.isFinite)))return null;
 const points=(world?.length===21?world:image).map(p=>[p.x,p.y,p.z||0]);
 const along=sub(points[9],points[0]),side=sub(points[5],points[17]);
 if(norm(along)<1e-5||norm(cross(side,along))<1e-7)return null;
 const y=unit(along),z=unit(cross(side,y)),x=unit(cross(y,z));
 const scale=.052/norm(along);
 const local=points.map(p=>{const d=sub(p,points[0]);return [dot(d,x)*scale,dot(d,y)*scale,dot(d,z)*scale];});
 const f=features(image);
 const orientation=[f[3],Math.atan2(along[2],Math.hypot(along[0],along[1])),Math.atan2(side[2],Math.hypot(side[0],side[1]))];
 return {local,features:f,orientation,curls:fingerCurls(local)};
}
export function fingerCurls(points){return CHAINS.map(chain=>{
 let bend=0;for(let i=1;i<4;i++){const a=unit(sub(points[chain[i]],points[chain[i-1]])),b=unit(sub(points[chain[i+1]],points[chain[i]]));bend+=Math.acos(clamp(dot(a,b),-1,1));}return clamp(bend/3.7,0,1);
});}
export const OPEN_HAND=[[0,0,0],[.019,.009,0],[.036,.019,0],[.049,.032,0],[.060,.046,0],[.025,.042,0],[.028,.070,0],[.028,.088,0],[.028,.103,0],[.004,.052,0],[.004,.082,0],[.004,.102,0],[.004,.118,0],[-.017,.048,0],[-.020,.077,0],[-.021,.096,0],[-.022,.110,0],[-.033,.038,0],[-.041,.059,0],[-.045,.076,0],[-.048,.089,0]];
export function palmGoal(pose,reference,origin,gain){const f=pose.features,r=reference.features;return [origin[0]-(f[0]-r[0])*.65*gain,origin[1]+clamp(Math.log(f[2]/r[2]),-.6,.6)*.22*gain,clamp(origin[2]-(f[1]-r[1])*.65*gain,.08,.52)];}
export function wristTargets(pose,reference,angles,limits,gain){return angles.map((v,i)=>i<3?v:clamp(v+wrap(pose.orientation[i-3]-reference.orientation[i-3])*gain,...limits[i]));}
// Damped least squares on position; wrist angles remain independent of finger flexion.
export function solvePositionIK(initial,goal,limits,forward){
 let q=[...initial],best=[...q],bestError=Infinity;const h=.0001;
 for(let iter=0;iter<18;iter++){
  const p=forward(q),error=sub(goal,p),length=norm(error);if(length<bestError){bestError=length;best=[...q];}if(length<.001)break;
  const columns=[0,1,2].map(i=>{const next=[...q];next[i]+=h;return sub(forward(next),p).map(v=>v/h);});
  const a=columns.map((c,i)=>[...columns.map((d,j)=>dot(c,d)+(i===j?.0004:0)),dot(c,error)]);
  for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;[a[i],a[pivot]]=[a[pivot],a[i]];const divisor=a[i][i];for(let k=i;k<4;k++)a[i][k]/=divisor;for(let j=0;j<3;j++)if(j!==i){const factor=a[j][i];for(let k=i;k<4;k++)a[j][k]-=factor*a[i][k];}}
  for(let i=0;i<3;i++)q[i]=clamp(q[i]+clamp(a[i][3],-.18,.18),...limits[i]);
 }
 return {angles:best,error:bestError};
}
