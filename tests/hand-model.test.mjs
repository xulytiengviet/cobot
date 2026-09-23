import test from 'node:test';import assert from 'node:assert/strict';
import {handPose,OPEN_HAND,fingerCurls,palmGoal,wristTargets,solvePositionIK} from '../web/hand-model.mjs';
const image=OPEN_HAND.map(([x,y,z])=>({x:.5+x*3,y:.8-y*3,z}));
const world=OPEN_HAND.map(([x,y,z])=>({x,y,z}));
const ref=handPose(image,world);const limits=Array.from({length:6},()=>[-2,2]);
test('normalizes all 21 landmarks to a fixed palm length',()=>{assert.equal(ref.local.length,21);assert(Math.abs(Math.hypot(...ref.local[9])-.052)<1e-8);assert.deepEqual(ref.local[0],[0,0,0]);});
test('translation and scale do not distort robot fingers',()=>{const moved=world.map(p=>({x:p.x*2+1,y:p.y*2-3,z:p.z*2+2}));const normalized=handPose(image,moved);normalized.local.forEach((p,i)=>p.forEach((v,j)=>assert(Math.abs(v-ref.local[i][j])<1e-8)));});
test('one curled index finger changes only its own curl value',()=>{const bent=OPEN_HAND.map(p=>[...p]);bent[7]=[.028,.075,.019];bent[8]=[.028,.057,.025];const a=fingerCurls(OPEN_HAND),b=fingerCurls(bent);assert(b[1]>a[1]+.3);for(const i of [0,2,3,4])assert.equal(a[i],b[i]);});
test('finger flex does not drive wrist joints',()=>{const bent=world.map(p=>({...p}));bent[8]={x:.028,y:.05,z:.03};const p=handPose(image,bent);assert.deepEqual(wristTargets(p,ref,Array(6).fill(0),limits,1),Array(6).fill(0));});
test('neutral calibration preserves arm position and wrist',()=>{assert.deepEqual(palmGoal(ref,ref,[.2,.0,.3],1),[.2,0,.3]);assert.deepEqual(wristTargets(ref,ref,Array(6).fill(.2),limits,1),Array(6).fill(.2));});
test('position IK reaches target and preserves three wrist angles',()=>{const q=[0,0,0,.3,.4,.5];const result=solvePositionIK(q,[.2,-.1,.3],limits,v=>v.slice(0,3));assert(result.error<.001);assert.deepEqual(result.angles.slice(3),q.slice(3));});
test('unreachable IK stays bounded and finite',()=>{const r=solvePositionIK(Array(6).fill(0),[10,-10,10],limits,v=>v.slice(0,3));assert(r.angles.every(v=>Number.isFinite(v)&&Math.abs(v)<=2));assert(r.error>1);});
test('degenerate and nonfinite hand data are rejected',()=>{assert.equal(handPose(Array.from({length:21},()=>({x:0,y:0,z:0}))),null);assert.equal(handPose(image.map((p,i)=>i===3?{...p,x:NaN}:p)),null);});

test('tracked palm axes remain orthonormal after hand translation',()=>{
 const b=ref.basis;
 for(const axis of [b.x,b.y,b.z])assert(Math.abs(Math.hypot(...axis)-1)<1e-8);
 for(const [a,c] of [[b.x,b.y],[b.x,b.z],[b.y,b.z]])assert(Math.abs(a.reduce((sum,v,i)=>sum+v*c[i],0))<1e-8);
});
