export async function createDetector(){
 const {HandLandmarker,FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');
 const base=new URL('./vendor/mediapipe/',import.meta.url);
 const response=await fetch(new URL('hand_landmarker.task',base),{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Tệp mô hình AI: HTTP ${response.status}`);
 const modelAssetBuffer=new Uint8Array(await response.arrayBuffer());
 const files=await FilesetResolver.forVisionTasks(base.href.replace(/\/$/,''));
 return HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
}
