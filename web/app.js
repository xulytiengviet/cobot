import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {features,handTargets,advance,clamp} from './control.mjs';
import {handPose,OPEN_HAND,fingerCurls,palmGoal,wristTargets,solvePositionIK} from './hand-model.mjs';
import {makeHand,skeletonPreview} from './hand-view.js';
import {cameraError,timeout,stopStream,acquireCamera,waitForVideo,watchVideoFrames} from './camera.mjs';
import {createVision} from './vision-client.js';
import {sampleIsFresh,nextInterval,cameraStalled} from './live-policy.mjs';
import {videoPopup} from './video-popup.js';
const $=id=>document.getElementById(id),say=t=>$('message').textContent=t;
const popup=videoPopup($('video'));
const mobile=matchMedia('(pointer:coarse)').matches;
const scene=new THREE.Scene();scene.background=new THREE.Color('#101a23');scene.fog=new THREE.Fog('#101a23',1.5,3.5);
const camera=new THREE.PerspectiveCamera(38,1,.005,10);camera.up.set(0,0,1);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:!mobile});}catch(e){$('modelStatus').textContent='Trình duyệt không hỗ trợ WebGL';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.5));renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;$('scene').append(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.25;orbit.maxDistance=2;orbit.maxPolarAngle=Math.PI*.49;
function view(){camera.position.set(.72,-.85,.6);orbit.target.set(0,0,.20);orbit.update();}view();$('view').onclick=view;
scene.add(new THREE.HemisphereLight(0xcfe7ff,0x31424b,2.4));
const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(.4,-.6,1);key.castShadow=true;key.shadow.mapSize.set(mobile?512:2048,mobile?512:2048);Object.assign(key.shadow.camera,{left:-.6,right:.6,top:.6,bottom:-.6,near:.01,far:3});key.shadow.bias=-.0001;scene.add(key);
const rim=new THREE.DirectionalLight(0x80f1c6,2);rim.position.set(-.5,.3,.6);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({color:0x101a23,roughness:.9}));ground.position.z=-.008;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(2,40,0x365968,0x223441);grid.rotation.x=Math.PI/2;grid.position.z=-.006;scene.add(grid);
const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.381,128),new THREE.MeshBasicMaterial({color:0x457269,side:THREE.DoubleSide,transparent:true,opacity:.6}));ring.position.z=-.005;scene.add(ring);
const root=new THREE.Group();scene.add(root);
const links={},joints=[],limits=[];let q=Array(6).fill(0),target=[...q],ready=false,stopped=false,mode='manual';
let pose=null,referencePose=null,referencePosition=null,side=null,referenceSide=null,stableFrames=0;
let lastAcceptedFrameId=0,lastAcceptedAt=0,acceptedDelay=0,overlayDirty=true;
let fingers=OPEN_HAND.map(p=>[...p]),fingerTarget=OPEN_HAND.map(p=>[...p]);
let stream=null,landmarker=null,starting=false,session=0,lastVideoTime=-1,lastSeen=0,lastDetection=0,hand=null,reference=null,referenceAngles=null;
const labels=['Đế','Vai','Khuỷu','Cẳng tay','Cổ tay','Mặt bích'];
const robotHand=makeHand(true);robotHand.group.position.z=-.065;robotHand.group.rotation.x=-Math.PI/2;
const skeleton=skeletonPreview($('skeleton3d'));
const names=['Cái','Trỏ','Giữa','Áp út','Út'];
names.forEach((name,i)=>{const row=document.createElement('div');row.className='finger-row';row.innerHTML=`<span>${name}</span><progress id="fbar${i}" max="100" value="0"></progress><output id="f${i}">0%</output>`;$('fingerValues').append(row);});
const status=t=>$('cameraState').textContent=t;
$('video').addEventListener('enterpictureinpicture',()=>{if(document.pictureInPictureElement=== $('video'))document.exitPictureInPicture?.().catch(()=>{});});
$('video').addEventListener('webkitpresentationmodechanged',()=>{const v=$('video');if(v.webkitPresentationMode&&v.webkitPresentationMode!=='inline'){try{v.webkitSetPresentationMode('inline');}catch{}}});
function origin(group,element){if(!element)return;group.position.fromArray((element.getAttribute('xyz')||'0 0 0').split(/\s+/).map(Number));const r=(element.getAttribute('rpy')||'0 0 0').split(/\s+/).map(Number);group.rotation.set(r[0],r[1],r[2],'ZYX');}
async function loadRobot(){
 const response=await fetch('PAROL6_URDF/PAROL6/urdf/PAROL6.urdf');if(!response.ok)throw Error('Không tải được URDF');
 const xml=new DOMParser().parseFromString(await response.text(),'application/xml');const loader=new STLLoader(),loads=[];
 for(const link of xml.querySelectorAll('robot > link')){
  const name=link.getAttribute('name'),group=new THREE.Group();links[name]=group;group.name=name;
  const visual=link.querySelector('visual'),mesh=visual?.querySelector('mesh');if(!mesh)continue;
  const path='PAROL6_URDF/PAROL6/meshes/'+mesh.getAttribute('filename').split('/').pop();
  loads.push(loader.loadAsync(path).then(geometry=>{geometry.computeVertexNormals();const model=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:name==='base_link'?0x3c5664:name==='L3'||name==='L5'?0x77d5b5:0xdbe3e6,metalness:.38,roughness:.32}));origin(model,visual.querySelector('origin'));model.castShadow=true;model.receiveShadow=true;group.add(model);}));
 }
 root.add(links.world);
 for(const joint of xml.querySelectorAll('robot > joint')){
  const pivot=new THREE.Group();origin(pivot,joint.querySelector('origin'));links[joint.querySelector('parent').getAttribute('link')].add(pivot);
  const child=links[joint.querySelector('child').getAttribute('link')];pivot.add(child);
  if(joint.getAttribute('type')!=='fixed'){
   const axis=new THREE.Vector3().fromArray(joint.querySelector('axis').getAttribute('xyz').split(' ').map(Number)).normalize();joints.push({child,axis});
   const limit=joint.querySelector('limit');limits.push([Number(limit.getAttribute('lower')),Number(limit.getAttribute('upper'))]);
  }
 }
 if(joints.length!==6)throw Error('URDF phải có sáu khớp');
 await Promise.all(loads);
 links.L6.add(robotHand.group);
 const axes=new THREE.AxesHelper(.04);axes.visible=false;links.L6.add(axes);
 for(let i=0;i<6;i++){
  const row=document.createElement('div');row.className='joint';row.innerHTML=`<label for="j${i}"><b>J${i+1}</b>${labels[i]}</label><input id="j${i}" type="range" min="${limits[i][0]}" max="${limits[i][1]}" step="0.001" value="0"><output id="v${i}">0.0°</output>`;$('joints').append(row);
  $('j'+i).oninput=e=>{if(stopped)return;setMode('manual');target[i]=Number(e.target.value);};
 }
 ready=true;$('modelStatus').textContent='URDF + STL GỐC / SẴN SÀNG';
}
function freeze(){target=[...q];fingerTarget=fingers.map(p=>[...p]);}
function clearReference(){reference=null;referenceAngles=null;referencePose=null;referencePosition=null;referenceSide=null;$('syncState').textContent='CHƯA LẤY MỐC';$('syncState').dataset.active='false';}
function setMode(value){mode=value;$('mode').value=value;freeze();clearReference();if(value==='hand'||value==='single')say('Giữ tay mở trong khung hình rồi nhấn Lấy mốc tay.');}
$('mode').onchange=e=>setMode(e.target.value);
$('jointSelect').onchange=()=>{freeze();clearReference();say('Đã đổi khớp. Lấy mốc tay mới để điều khiển.');};
$('gain').oninput=e=>{$('gainValue').value=Number(e.target.value).toFixed(1)+'×';};
function stop(){stopped=!stopped;freeze();clearReference();$('stop').innerHTML=stopped?'▶ TIẾP TỤC <kbd>Space</kbd>':'■ DỪNG <kbd>Space</kbd>';say(stopped?'Đã dừng mọi chuyển động.':'Đã mở khóa. Lấy mốc mới nếu dùng cử chỉ.');}
$('stop').onclick=stop;addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();stop();}});
$('home').onclick=()=>{if(stopped)return;setMode('manual');target=Array(6).fill(0);say('Đang trở về tư thế gốc URDF.');};
$('save').onclick=()=>{try{localStorage.setItem('cobot-pose-v1',JSON.stringify({angles:q,fingers}));say('Đã lưu tư thế trong trình duyệt.');}catch{say('Trình duyệt không cho phép lưu tư thế.');}};
$('restore').onclick=()=>{if(stopped||!ready)return;try{
 const saved=JSON.parse(localStorage.getItem('cobot-pose-v1'));const angles=Array.isArray(saved)?saved:saved?.angles;
 if(!Array.isArray(angles)||angles.length!==6||!angles.every(Number.isFinite))throw Error();
 setMode('manual');target=angles.map((v,i)=>clamp(v,...limits[i]));
 if(Array.isArray(saved.fingers)&&saved.fingers.length===21&&saved.fingers.every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<.2)))fingerTarget=saved.fingers;
 say('Đang khôi phục tư thế đã lưu.');
 }catch{say('Chưa có tư thế hợp lệ được lưu.');}};
$('calibrate').onclick=()=>{
 if(!hand||!pose||stopped||!ready||stableFrames<3||stalled||performance.now()-lastSeen>500)return;
 if(mode!=='hand'&&mode!=='single')setMode('hand');
 reference=features(hand);referenceAngles=[...q];referencePose=pose;referenceSide=side;
 scene.updateMatrixWorld(true);referencePosition=links.L6.getWorldPosition(new THREE.Vector3()).toArray();freeze();fingerTarget=pose.local.map(p=>[...p]);
 $('syncState').textContent='● ĐỒNG BỘ';$('syncState').dataset.active='true';say('Đã lấy mốc: dịch tay, xoay cổ tay và co duỗi từng ngón để điều khiển.');
};
$('focusHand').onclick=()=>{if(!ready)return;const pos=robotHand.group.localToWorld(new THREE.Vector3(0,.05,0));orbit.minDistance=.09;orbit.target.copy(pos);camera.position.copy(pos).add(new THREE.Vector3(.17,-.20,.12));orbit.update();};
function drawInput(points){
 if(!overlayDirty)return;
 overlayDirty=false;
 const c=$('overlay'),ctx=c.getContext('2d'),v=$('video'),display=$('visibility').value;
 if(c.width!==640||c.height!==480){c.width=640;c.height=480;}
 ctx.clearRect(0,0,640,480);ctx.fillStyle='#080e13';ctx.fillRect(0,0,640,480);
 const src=previewFrame.width?previewFrame:v;
 const sw=src.videoWidth||src.width,sh=src.videoHeight||src.height;
 const available=sw>0&&sh>0&&(src!==v||v.readyState>=2);
 if(!points){
  if(display==='full'&&available){
   ctx.save();ctx.translate(640,0);ctx.scale(-1,1);
   ctx.drawImage(src,0,0,sw,sh,0,0,640,480);ctx.restore();
  }
  return;
 }
 if(!available)return;
 let minX=0,minY=0,maxX=1,maxY=1;
 if(display!=='full'){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const bboxW=Math.max(...xs)-Math.min(...xs),bboxH=Math.max(...ys)-Math.min(...ys);
  const h=Math.max(bboxH,bboxW*sw/sh)*1.45;
  minY=Math.max(0,cy-h/2);maxY=Math.min(1,cy+h/2);
  const w=(maxY-minY)*4/3*sh/sw;
  minX=Math.max(0,cx-w/2);maxX=Math.min(1,cx+w/2);
 }
 const width=Math.max(maxX-minX,.001),height=Math.max(maxY-minY,.001);
 const aspect=width*sw/(height*sh),dw=Math.min(640,480*aspect),dh=dw/aspect,ox=(640-dw)/2,oy=(480-dh)/2;
 ctx.save();ctx.translate(640,0);ctx.scale(-1,1);
 if(display!=='skeleton')ctx.drawImage(src,minX*sw,minY*sh,width*sw,height*sh,ox,oy,dw,dh);
 const xy=p=>[ox+(p.x-minX)/width*dw,oy+(p.y-minY)/height*dh];
 ctx.strokeStyle='#80f1c6';ctx.lineWidth=3;
 for(const [a,b]of connections){ctx.beginPath();ctx.moveTo(...xy(points[a]));ctx.lineTo(...xy(points[b]));ctx.stroke();}
 for(const p of points){ctx.beginPath();ctx.arc(...xy(p),4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}
 ctx.restore();
}
$('visibility').onchange=()=>{
 const display=$('visibility').value;
 $('privacyNote').textContent=display==='skeleton'?'Ẩn toàn bộ video; camera vẫn nhận diện tay.':display==='crop'?'Chỉ cắt vùng tay; nền phía sau tay vẫn có thể xuất hiện.':'Đang hiển thị toàn bộ hình camera.';
 overlayDirty=true;drawInput(hand);
};
function forwardPosition(angles){joints.forEach(({child,axis},i)=>child.quaternion.setFromAxisAngle(axis,angles[i]));root.updateMatrixWorld(true);return links.L6.getWorldPosition(new THREE.Vector3()).toArray();}
let sampleEpoch=0;
let observedFrameId=0,lastSubmittedFrameId=-1,stopFrameWatch=null,lastFallbackDraw=0;
const previewFrame=document.createElement('canvas'),previewContext=previewFrame.getContext('2d');
let aiLoading=false,detectBusy=false,inferenceMs=0,interval=80,observedVideoTime=-1,lastCameraFrame=0,stalled=false;
const sampleCanvas=document.createElement('canvas'),sampleContext=sampleCanvas.getContext('2d');
function aiError(e){hand=null;pose=null;freeze();clearReference();landmarker?.close();landmarker=null;$('calibrate').disabled=true;$('retryAI').hidden=false;status('CAMERA OK · AI LỖI');say(`Camera vẫn mở. ${e.message}. Nhấn Thử lại AI.`);}

function releaseCamera(){popup.setActive(false);session++;landmarker?.close();landmarker=null;stalled=false;starting=false;stopStream(stream);stream=null;$('video').srcObject=null;hand=null;pose=null;stableFrames=0;freeze();clearReference();drawInput(null);$('camera').textContent='Bật camera';$('camera').disabled=false;$('cameraSelect').disabled=false;$('cameraPlaceholder').style.display='flex';$('calibrate').disabled=true;$('retryAI').hidden=true;status('CHƯA BẬT');const c=$('overlay');c.getContext('2d').clearRect(0,0,c.width,c.height);}
async function refreshDevices(){
 try{const current=$('cameraSelect').value;const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');$('cameraSelect').replaceChildren(new Option('Camera mặc định',''),...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));if(devices.some(d=>d.deviceId===current))$('cameraSelect').value=current;}catch(error){console.warn('Cannot list cameras',error);}
}
async function startAI(token){
 if(aiLoading){$('retryAI').hidden=false;say('AI đang hoàn tất lần tải trước. Nhấn Thử lại AI khi nút sẵn sàng.');return;}aiLoading=true;$('retryAI').disabled=true;$('retryAI').hidden=false;
 try{
  status('CAMERA OK · TẢI AI');say('Camera đã mở. Đang tải nhận diện tay (~18 MB lần đầu)…');
  if(!landmarker){
   const detector=await createVision();
   if(token!==session){detector.close();return;}landmarker=detector;
  }
  if(token!==session)return;
  $('retryAI').hidden=true;status('AI SẴN SÀNG');setMode('hand');
 }catch(error){
  if(token!==session)return;
  status('CAMERA OK · AI LỖI');say(`Camera vẫn hoạt động; nhận diện tay chưa sẵn sàng. Nhấn Thử lại AI. Chi tiết: ${error.message}`);console.error('Hand detector initialization',error);
 }finally{aiLoading=false;$('retryAI').disabled=false;}
}
$('refreshCameras').onclick=refreshDevices;
if(navigator.mediaDevices){refreshDevices();navigator.mediaDevices.addEventListener?.('devicechange',refreshDevices);}
$('retryAI').onclick=()=>{if(stream)startAI(session);};
$('camera').onclick=async()=>{
 if(stream||starting){releaseCamera();say('Đã tắt camera.');return;}
 if(!window.isSecureContext||!navigator.mediaDevices){say('Camera cần HTTPS hoặc localhost. Hãy mở bằng GitHub Pages.');return;}
 starting=true;$('camera').textContent='Hủy mở camera';$('cameraSelect').disabled=true;status('ĐANG MỞ CAMERA');say('Đang mở camera. Chấp nhận yêu cầu quyền truy cập nếu Chrome hiển thị.');const token=++session;
 try{
  const candidate=await acquireCamera(navigator.mediaDevices,$('cameraSelect').value);
  if(token!==session){stopStream(candidate);return;}stream=candidate;
  stream.getVideoTracks()[0].onended=()=>{if(token===session){releaseCamera();say('Camera đã ngắt. Bật camera để kết nối lại.');}};
  const video=$('video');video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.disablePictureInPicture=true;video.srcObject=stream;
  await timeout(video.play(),12000,'Video playback timeout');await waitForVideo(video);
  if(token!==session)return;
  popup.setActive(true);lastCameraFrame=performance.now();observedVideoTime=-1;stalled=false;lastVideoTime=-1;lastSeen=performance.now();$('cameraPlaceholder').style.display='none';$('camera').textContent='Tắt camera';status('CAMERA OK');
  await refreshDevices();startAI(token);
 }catch(error){if(token===session){releaseCamera();status('CAMERA LỖI');say(`${cameraError(error)} Chi tiết trình duyệt: ${error.message||'Không có'}. Mở Kiểm tra camera độc lập để khoanh vùng lỗi.`);refreshDevices();console.error('Camera startup',error);}}
 finally{if(token===session){starting=false;$('camera').disabled=false;}}
};
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function detect(now){
 const video=$('video');
 if(document.hidden||stalled||!stream||aiLoading||!landmarker||detectBusy||video.readyState<2||video.currentTime===lastVideoTime||now-lastDetection<interval)return;
 const capturedAt=performance.now(),token=session,epoch=sampleEpoch,detector=landmarker;
 const frameTime=video.currentTime;lastDetection=now;lastVideoTime=frameTime;detectBusy=true;
 const scale=Math.min(1,480/Math.max(video.videoWidth,video.videoHeight));
 sampleCanvas.width=Math.max(1,Math.round(video.videoWidth*scale));sampleCanvas.height=Math.max(1,Math.round(video.videoHeight*scale));
 sampleContext.drawImage(video,0,0,sampleCanvas.width,sampleCanvas.height);
 detector.detect(sampleCanvas,now).then(({result,ms})=>{
  if(epoch!==sampleEpoch||detector!==landmarker||!sampleIsFresh(token,session,capturedAt,performance.now(),document.hidden))return;
  inferenceMs=ms;interval=nextInterval(ms,detector.kind==='AI tương thích',$('performance').value==='light');
  acceptSample(result,performance.now());
 }).catch(e=>{if(token===session&&detector===landmarker)aiError(e);}).finally(()=>{detectBusy=false;});
}
function acceptSample(result,now){
 hand=result.landmarks[0]||null;
 side=result.handedness?.[0]?.[0]?.categoryName||'Unknown';
 pose=hand?handPose(hand,result.worldLandmarks?.[0]):null;
 if(hand&&pose){
  const wasLost=stableFrames===0;stableFrames++;
  if(referenceSide&&side!==referenceSide){freeze();clearReference();say('Đã đổi bàn tay. Lấy mốc mới để tiếp tục.');}
  lastSeen=now;status('● NHẬN DIỆN TAY');$('calibrate').disabled=stopped||!ready||stableFrames<3;
  if(wasLost&&!reference)say('Đã thấy tay. Giữ tay ổn định rồi nhấn Lấy mốc tay.');
  if(!stopped&&reference&&(mode==='hand'||mode==='single')){
   fingerTarget=pose.local.map(p=>[...p]);
   if(mode==='single')target=handTargets(pose.features,reference,referenceAngles,limits,Number($('gain').value),Number($('jointSelect').value));
   else{
    const gain=Number($('gain').value),goal=palmGoal(pose,referencePose,referencePosition,gain);
    const wrist=wristTargets(pose,referencePose,referenceAngles,limits,gain);const start=[...target.slice(0,3),...wrist.slice(3)];
    const solved=solvePositionIK(start,goal,limits,forwardPosition);target=solved.angles;forwardPosition(q);
    $('trackingInfo').textContent=solved.error>.015?'Đã tới giới hạn tầm với; robot giữ điểm gần nhất.':`Bám cổ tay · sai lệch mô phỏng ${(solved.error*1000).toFixed(1)} mm · ${side==='Left'?'tay trái':'tay phải'}`;
   }
   $('syncState').textContent='● ĐỒNG BỘ';$('syncState').dataset.active='true';
  }
 }else{hand=null;pose=null;loseHand(now);}
}
function loseHand(now){stableFrames=0;if(mode==='hand'||mode==='single')freeze();
 if(reference){$('syncState').textContent='GIỮ TƯ THẾ';$('syncState').dataset.active='false';if(now-lastSeen>700){clearReference();say('Mất dấu tay: đã giữ tư thế. Đưa tay trở lại và lấy mốc mới.');}}
 $('calibrate').disabled=true;status('KHÔNG THẤY TAY');if(!reference)say('Đưa một bàn tay vào khung hình, giữ ổn định rồi lấy mốc.');
}
addEventListener('pagehide',releaseCamera);document.addEventListener('visibilitychange',()=>{
 sampleEpoch++;hand=null;pose=null;stableFrames=0;freeze();clearReference();$('calibrate').disabled=true;
 if(!document.hidden&&stream){lastCameraFrame=performance.now();$('video').play().catch(()=>say('Nhấn Khôi phục camera để tiếp tục.'));}
});
$('recoverCamera').onclick=async()=>{releaseCamera();await $('camera').onclick();};
$('performance').onchange=()=>{interval=nextInterval(inferenceMs,landmarker?.kind==='AI tương thích',$('performance').value==='light');};

new ResizeObserver(()=>{const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('scene'));
let previous=performance.now();const position=new THREE.Vector3(),handRotation=new THREE.Quaternion();
function frame(now){requestAnimationFrame(frame);if(document.hidden||now-previous<1000/30)return;const dt=(now-previous)/1000;previous=now;
 const video=$('video');
 if(stream&&video.readyState>=2&&video.currentTime!==observedVideoTime){observedVideoTime=video.currentTime;lastCameraFrame=now;stalled=false;}
 if(cameraStalled(lastCameraFrame,now,!!stream,document.hidden)){
  if(!stalled){hand=null;pose=null;stableFrames=0;freeze();clearReference();$('calibrate').disabled=true;stalled=true;say('Video ngừng trả hình. Nhấn Khôi phục camera; trên iPhone hãy mở trang bằng Safari nếu đang dùng trình duyệt trong ứng dụng.');}
  status('CAMERA ĐỨNG HÌNH');
 }
 $('performanceStatus').textContent=stream?`${stalled?'Video đứng': 'Video đang chạy'} · ${landmarker?.kind||'AI chưa sẵn sàng'} · ${Math.round(inferenceMs)} ms / mẫu · tối đa ${Math.round(1000/interval)} mẫu/s`: 'Camera chưa bật';

 try{detect(now);}catch(e){detectBusy=false;aiError(e);}
 if(!stalled&&stream&&landmarker&&!aiLoading&&now-lastSeen>700){hand=null;pose=null;loseHand(now);}
 if(ready&&!stopped&&!document.hidden){
  if(mode==='demo')target=limits.map(([lo,hi],i)=>clamp(Math.sin(now/2000+i*.6)*.42,lo,hi));
  const live=!!(hand&&pose&&reference&&(mode==='hand'||mode==='single'));
  // Live simulation consumes the latest accepted sample without a second lag filter.
  q=live?[...target]:advance(q,target,dt);
  const blend=1-Math.exp(-12*Math.min(dt,.05));
  fingers=live?fingerTarget.map(p=>[...p]):fingers.map((p,i)=>p.map((v,j)=>v+(fingerTarget[i][j]-v)*blend));
 }
 if(ready){joints.forEach(({child,axis},i)=>{child.quaternion.setFromAxisAngle(axis,q[i]);$('j'+i).value=String(q[i]);$('j'+i).disabled=stopped;$('v'+i).value=(q[i]*180/Math.PI).toFixed(1)+'°';});scene.updateMatrixWorld(true);links.L6.getWorldPosition(position);$('xyz').textContent=`X ${(position.x*1000).toFixed(1)} / Y ${(position.y*1000).toFixed(1)} / Z ${(position.z*1000).toFixed(1)}`;}
 // Both 3D views always use the same applied pose, including pause/loss/manual modes.
 robotHand.update(fingers);robotHand.group.updateWorldMatrix(true,false);
 robotHand.group.getWorldQuaternion(handRotation);skeleton.update(fingers,handRotation);
 drawInput(hand);popup.draw();
 $('frameStatus').textContent=stream?(hand&&pose?`Mẫu tay ${lastVideoTime.toFixed(2)} s · ${reference&&!stopped?'Đang bám tay':'Chưa điều khiển · lấy mốc tay'}`:'Không thấy tay · robot và xương 3D giữ tư thế'):'Bật camera để nhận diện tay';
 const curls=fingerCurls(fingers);curls.forEach((v,i)=>{$('fbar'+i).value=v*100;$('f'+i).value=Math.round(v*100)+'%';});
 orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);loadRobot().catch(e=>{$('modelStatus').textContent='LỖI TẢI MÔ HÌNH';say('Không tải được mô hình 3D. Kiểm tra mạng và tải lại trang.');console.error(e);});
