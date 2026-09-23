export async function createDetector({signal}={}){
 const {HandLandmarker,FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');
 const base=new URL('./vendor/mediapipe/',import.meta.url);
 const deadline=AbortSignal.timeout(45000);
 const combined=signal?(AbortSignal.any?AbortSignal.any([signal,deadline]):signal):deadline;
 const response=await fetch(new URL('hand_landmarker.task',base),{signal:combined});
 if(!response.ok)throw Error(`Tệp mô hình AI: HTTP ${response.status}`);
 const modelAssetBuffer=new Uint8Array(await response.arrayBuffer());
 const files=await FilesetResolver.forVisionTasks(base.href.replace(/\/$/,''));
 if(signal?.aborted){const error=new Error('Camera session canceled');error.name='AbortError';throw error;}
 return HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
}
