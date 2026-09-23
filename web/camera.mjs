// Camera lifecycle is independent of the hand detector and the 3D renderer.
export function cameraError(error){
 const tips={NotAllowedError:'Quyền camera bị chặn. Cho phép camera trong Chrome và Windows → Privacy → Camera.',SecurityError:'Camera bị chính sách trình duyệt chặn.',NotFoundError:'Không tìm thấy camera. Kiểm tra kết nối và bật thiết bị trong Windows.',NotReadableError:'Không đọc được camera. Đóng Camera, Teams, Zoom và các tab đang dùng camera; kiểm tra nắp che camera rồi thử lại.',TrackStartError:'Camera không khởi động được. Đóng ứng dụng khác đang dùng camera rồi thử lại.',OverconstrainedError:'Camera không hỗ trợ cấu hình yêu cầu. Chọn camera khác rồi thử lại.',TimeoutError:'Camera chưa trả hình hoặc chưa được cấp quyền. Đóng các ứng dụng dùng camera, mở nắp che và thử lại.',AbortError:'Camera bị ngắt khi khởi động. Hãy thử lại.'};
 return `${tips[error.name]||'Không thể mở camera. Kiểm tra thiết bị rồi thử lại.'} [${error.name||'CameraError'}]`;
}
export function timeout(promise,ms,label,onLate=()=>{}){
 let expired=false,timer;
 const observed=Promise.resolve(promise).then(value=>{if(expired)onLate(value);return value;});
 return Promise.race([observed,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;const error=new Error(label);error.name='TimeoutError';reject(error);},ms);})]).finally(()=>clearTimeout(timer));
}
export function stopStream(stream){stream?.getTracks().forEach(track=>track.stop());}
export async function acquireCamera(mediaDevices,deviceId){
 // Let the device/driver negotiate its native format. No facingMode or size hints.
 const video=deviceId?{deviceId:{exact:deviceId}}:true;
 return timeout(mediaDevices.getUserMedia({video,audio:false}),20000,'Camera permission / startup timed out',stopStream);
}
export function waitForVideo(video,ms=12000){
 if(video.readyState>=2&&video.videoWidth>0)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const clean=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',check);video.removeEventListener('resize',check);video.removeEventListener('error',fail);};
  const check=()=>{if(video.readyState>=2&&video.videoWidth>0){clean();resolve();}};
  const fail=()=>{clean();reject(new Error('Video playback failed'));};
  const timer=setTimeout(()=>{clean();const error=new Error('No camera frames');error.name='TimeoutError';reject(error);},ms);
  video.addEventListener('loadeddata',check);video.addEventListener('resize',check);video.addEventListener('error',fail);check();
 });
}
