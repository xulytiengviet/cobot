import {timeout} from './camera.mjs';
export async function createVision({signal}={}){
 if(signal?.aborted){const e=new Error('AI startup canceled');e.name='AbortError';throw e;}
 let worker;
 if(typeof Worker!=='undefined'&&typeof createImageBitmap==='function'&&typeof OffscreenCanvas!=='undefined'){
  try{
   worker=new Worker(new URL('./vision-worker.js',import.meta.url));
   await timeout(new Promise((resolve,reject)=>{
    worker.onmessage=({data})=>data.type==='ready'?resolve():reject(Error(data.message||'Worker init failed'));
    worker.onerror=e=>{e.preventDefault();reject(Error(e.message||'Worker unavailable'));};
    worker.postMessage({type:'init'});
   }),60000,'Worker AI khởi tạo quá lâu',()=>{},signal);
   let pending=null,id=0,closed=false;
   worker.onmessage=({data})=>{
    if(!pending)return;
    const p=pending;pending=null;clearTimeout(p.timer);
    if(data.type==='error')p.reject(Error(data.message));else if(data.id===p.id)p.resolve(data);else p.reject(Error('Mẫu AI không khớp'));
   };
   worker.onerror=e=>{e.preventDefault();if(pending){clearTimeout(pending.timer);pending.reject(Error(e.message||'Worker AI lỗi'));pending=null;}};
   return {kind:'AI nền',async detect(canvas,now){
    if(closed||pending)throw Error('AI chưa sẵn sàng');
    const bitmap=await createImageBitmap(canvas);
    if(closed){bitmap.close();throw Error('AI đã đóng');}
    return new Promise((resolve,reject)=>{
     const request=++id;pending={id:request,resolve,reject,timer:setTimeout(()=>{pending=null;closed=true;worker.terminate();reject(Error('AI không phản hồi trong 4 giây'));},4000)};
     try{worker.postMessage({type:'frame',bitmap,now,id:request},[bitmap]);}catch(e){bitmap.close();clearTimeout(pending.timer);pending=null;reject(e);}
    });
   },close(){closed=true;worker.terminate();if(pending){clearTimeout(pending.timer);pending.reject(Error('AI đã đóng'));pending=null;}}};
  }catch(e){worker?.terminate();if(signal?.aborted)throw e;console.warn('AI nền không khả dụng; dùng chế độ tương thích',e.message);}
 }
 const {createDetector}=await import('./vision-runtime.js');
 const detector=await timeout(createDetector({signal}),60000,'AI khởi tạo quá lâu',late=>late.close(),signal);
 return {kind:'AI tương thích',async detect(canvas,now){const start=performance.now();return {result:detector.detectForVideo(canvas,now),ms:performance.now()-start};},close(){detector.close();}};
}
