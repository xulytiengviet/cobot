import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraError,timeout,acquireCamera,waitForVideo} from '../web/camera.mjs';
test('busy camera is distinguished from denied permission',()=>{assert.match(cameraError({name:'NotReadableError'}),/Teams/);assert.match(cameraError({name:'NotAllowedError'}),/Quyền/);});
test('late camera stream is released after timeout',async()=>{let stopped=false;await assert.rejects(timeout(new Promise(resolve=>setTimeout(()=>resolve({stop(){stopped=true;}}),30)),5,'timeout',v=>v.stop()),{name:'TimeoutError'});await new Promise(r=>setTimeout(r,40));assert.equal(stopped,true);});
test('unsupported preferred resolution retries unconstrained',async()=>{let calls=0;const stream={};const devices={getUserMedia:async options=>{calls++;if(calls===1)throw Object.assign(new Error(),{name:'OverconstrainedError'});assert.equal(options.video,true);return stream;}};assert.equal(await acquireCamera(devices,''),stream);assert.equal(calls,2);});
test('device selection errors do not silently choose another camera',async()=>{let calls=0;await assert.rejects(acquireCamera({getUserMedia:async()=>{calls++;throw Object.assign(new Error(),{name:'OverconstrainedError'});}},'selected-camera'));assert.equal(calls,1);});
test('permission failures are not retried',async()=>{let calls=0;await assert.rejects(acquireCamera({getUserMedia:async()=>{calls++;throw Object.assign(new Error(),{name:'NotAllowedError'});}},''));assert.equal(calls,1);});
test('video startup detects absent frames and removes listeners',async()=>{const video=new EventTarget();video.readyState=0;video.videoWidth=0;await assert.rejects(waitForVideo(video,5),{name:'TimeoutError'});video.readyState=2;video.videoWidth=640;await waitForVideo(video,5);});
