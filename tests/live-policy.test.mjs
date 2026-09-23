import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleIsFresh,nextInterval,cameraStalled} from '../web/live-policy.mjs';
test('old, hidden and previous-session results cannot drive robot',()=>{
 assert.equal(sampleIsFresh(1,2,100,110,false),false);
 assert.equal(sampleIsFresh(1,1,100,900,false),false);
 assert.equal(sampleIsFresh(1,1,100,110,true),false);
 assert.equal(sampleIsFresh(1,1,100,110,false),true);
});
test('slow inference leaves UI headroom and light mode reduces load',()=>{
 assert(nextInterval(100,true)>=250);
 assert(nextInterval(10,false,true)>=125);
 assert(nextInterval(10,false)>=66);
 assert(nextInterval(5000,false)<=500);
});
test('camera watchdog separates stopped video from background tab',()=>{
 assert(cameraStalled(100,2700,true,false));
 assert(!cameraStalled(100,2700,true,true));
 assert(!cameraStalled(100,2700,false,false));
 assert(!cameraStalled(100,500,true,false));
});
