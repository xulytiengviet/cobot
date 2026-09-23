// Classic worker permits the WASM runtime's importScripts loader.
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {createDetector}=await import('./vision-runtime.js');detector=await createDetector();self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{
    const started=performance.now(),result=detector.detectForVideo(data.bitmap,data.now);
    self.postMessage({type:'result',id:data.id,result,ms:performance.now()-started});
   }finally{data.bitmap.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
