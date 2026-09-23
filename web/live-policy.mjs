// Structured state and freshness guards inspired by Jev Ultrafast; no model/API calls.
export function sampleIsFresh(token,currentToken,capturedAt,now,hidden){return token===currentToken&&!hidden&&now-capturedAt<=450;}
export function nextInterval(inferenceMs,compatible=false,light=false){
 return Math.min(500,Math.max(light?125:66,compatible?100:0,inferenceMs*(compatible?2.5:1.35)));
}
export function cameraStalled(lastFrame,now,active,hidden){return active&&!hidden&&now-lastFrame>2500;}
