import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {features,handTargets,advance,clamp} from './control.mjs';
import {cameraError,timeout,stopStream,acquireCamera,waitForVideo} from './camera.mjs';
const $=id=>document.getElementById(id),say=t=>$('message').textContent=t;
const scene=new THREE.Scene();scene.background=new THREE.Color('#101a23');scene.fog=new THREE.Fog('#101a23',1.5,3.5);
const camera=new THREE.PerspectiveCamera(38,1,.005,10);camera.up.set(0,0,1);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){$('modelStatus').textContent='Trình duyệt không hỗ trợ WebGL';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;$('scene').append(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=.25;orbit.maxDistance=2;orbit.maxPolarAngle=Math.PI*.49;
function view(){camera.position.set(.72,-.85,.6);orbit.target.set(0,0,.20);orbit.update();}view();$('view').onclick=view;
scene.add(new THREE.HemisphereLight(0xcfe7ff,0x31424b,2.4));
const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(.4,-.6,1);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-.6,right:.6,top:.6,bottom:-.6,near:.01,far:3});key.shadow.bias=-.0001;scene.add(key);
const rim=new THREE.DirectionalLight(0x80f1c6,2);rim.position.set(-.5,.3,.6);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshStandardMaterial({color:0x101a23,roughness:.9}));ground.position.z=-.008;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(2,40,0x365968,0x223441);grid.rotation.x=Math.PI/2;grid.position.z=-.006;scene.add(grid);
const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.381,128),new THREE.MeshBasicMaterial({color:0x457269,side:THREE.DoubleSide,transparent:true,opacity:.6}));ring.position.z=-.005;scene.add(ring);
const root=new THREE.Group();scene.add(root);
const links={},joints=[],limits=[];let q=Array(6).fill(0),target=[...q],ready=false,stopped=false,mode='manual';
let stream=null,landmarker=null,starting=false,session=0,lastVideoTime=-1,lastSeen=0,lastDetection=0,hand=null,reference=null,referenceAngles=null;
const labels=['Đế','Vai','Khuỷu','Cẳng tay','Cổ tay','Mặt bích'];
const status=t=>$('cameraState').textContent=t;
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
 const axes=new THREE.AxesHelper(.065);links.L6.add(axes);
 for(let i=0;i<6;i++){
  const row=document.createElement('div');row.className='joint';row.innerHTML=`<label for="j${i}"><b>J${i+1}</b>${labels[i]}</label><input id="j${i}" type="range" min="${limits[i][0]}" max="${limits[i][1]}" step="0.001" value="0"><output id="v${i}">0.0°</output>`;$('joints').append(row);
  $('j'+i).oninput=e=>{if(stopped)return;setMode('manual');target[i]=Number(e.target.value);};
 }
 ready=true;$('modelStatus').textContent='URDF + STL GỐC / SẴN SÀNG';
}
function freeze(){target=[...q];}
function clearReference(){reference=null;referenceAngles=null;}
function setMode(value){mode=value;$('mode').value=value;freeze();clearReference();if(value==='hand'||value==='single')say('Giữ tay mở trong khung hình rồi nhấn Lấy mốc tay.');}
$('mode').onchange=e=>setMode(e.target.value);
$('jointSelect').onchange=()=>{freeze();clearReference();say('Đã đổi khớp. Lấy mốc tay mới để điều khiển.');};
$('gain').oninput=e=>{$('gainValue').value=Number(e.target.value).toFixed(1)+'×';};
function stop(){stopped=!stopped;freeze();clearReference();$('stop').innerHTML=stopped?'▶ TIẾP TỤC <kbd>Space</kbd>':'■ DỪNG <kbd>Space</kbd>';say(stopped?'Đã dừng mọi chuyển động.':'Đã mở khóa. Lấy mốc mới nếu dùng cử chỉ.');}
$('stop').onclick=stop;addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();stop();}});
$('home').onclick=()=>{if(stopped)return;setMode('manual');target=Array(6).fill(0);say('Đang trở về tư thế gốc URDF.');};
$('save').onclick=()=>{try{localStorage.setItem('cobot-pose-v1',JSON.stringify(q));say('Đã lưu tư thế trong trình duyệt.');}catch{say('Trình duyệt không cho phép lưu tư thế.');}};
$('restore').onclick=()=>{if(stopped||!ready)return;try{const saved=JSON.parse(localStorage.getItem('cobot-pose-v1'));if(!Array.isArray(saved)||saved.length!==6||!saved.every(Number.isFinite))throw Error();setMode('manual');target=saved.map((v,i)=>clamp(v,...limits[i]));say('Đang khôi phục tư thế đã lưu.');}catch{say('Chưa có tư thế hợp lệ được lưu.');}};
$('calibrate').onclick=()=>{if(!hand||stopped||!ready)return;if(mode!=='hand'&&mode!=='single')setMode('hand');reference=features(hand);referenceAngles=[...q];freeze();say('Đã lấy mốc. Di chuyển tay chậm để điều khiển.');};
let aiLoading=false;
function releaseCamera(){session++;starting=false;stopStream(stream);stream=null;$('video').srcObject=null;hand=null;freeze();clearReference();$('camera').textContent='Bật camera';$('camera').disabled=false;$('cameraSelect').disabled=false;$('cameraPlaceholder').style.display='flex';$('calibrate').disabled=true;$('retryAI').hidden=true;status('CHƯA BẬT');const c=$('overlay');c.getContext('2d').clearRect(0,0,c.width,c.height);}
async function refreshDevices(){
 try{const current=$('cameraSelect').value;const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');$('cameraSelect').replaceChildren(new Option('Camera mặc định',''),...devices.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));if(devices.some(d=>d.deviceId===current))$('cameraSelect').value=current;}catch(error){console.warn('Cannot list cameras',error);}
}
async function startAI(token){
 if(aiLoading){$('retryAI').hidden=false;say('AI đang hoàn tất lần tải trước. Nhấn Thử lại AI khi nút sẵn sàng.');return;}aiLoading=true;$('retryAI').disabled=true;$('retryAI').hidden=false;
 try{
  status('CAMERA OK · TẢI AI');say('Camera đã mở. Đang tải nhận diện tay (~18 MB lần đầu)…');
  if(!landmarker){
   const {HandLandmarker}=await timeout(import('./vendor/mediapipe/vision_bundle.mjs'),30000,'Không tải được thư viện AI');
   if(token!==session)return;
   const base=new URL('./vendor/mediapipe/',import.meta.url);
   const response=await fetch(new URL('hand_landmarker.task',base),{signal:AbortSignal.timeout(45000)});
   if(!response.ok)throw Error(`Tệp mô hình AI: HTTP ${response.status}`);
   const modelAssetBuffer=new Uint8Array(await response.arrayBuffer());
   if(token!==session)return;
   const {FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(base.href.replace(/\/$/,''));
   const detector=await timeout(HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65}),45000,'Khởi tạo AI quá thời gian',late=>late.close());
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
  const video=$('video');video.srcObject=stream;
  await timeout(video.play(),12000,'Video playback timeout');await waitForVideo(video);
  if(token!==session)return;
  lastVideoTime=-1;lastSeen=performance.now();$('cameraPlaceholder').style.display='none';$('camera').textContent='Tắt camera';status('CAMERA OK');
  await refreshDevices();startAI(token);
 }catch(error){if(token===session){releaseCamera();status('CAMERA LỖI');say(`${cameraError(error)} Chi tiết trình duyệt: ${error.message||'Không có'}. Mở Kiểm tra camera độc lập để khoanh vùng lỗi.`);refreshDevices();console.error('Camera startup',error);}}
 finally{if(token===session){starting=false;$('camera').disabled=false;}}
};
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function detect(now){
 const video=$('video');if(!stream||aiLoading||!landmarker||video.readyState<2||video.currentTime===lastVideoTime||now-lastDetection<50)return;
 lastVideoTime=video.currentTime;lastDetection=now;
 const result=landmarker.detectForVideo(video,now);hand=result.landmarks[0]||null;
 const canvas=$('overlay');if(canvas.width!==video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 if(hand&&features(hand)){
  lastSeen=now;status('● NHẬN DIỆN TAY');$('calibrate').disabled=stopped||!ready;
  ctx.strokeStyle='#80f1c6';ctx.lineWidth=3;
  for(const [a,b]of connections){ctx.beginPath();ctx.moveTo(hand[a].x*canvas.width,hand[a].y*canvas.height);ctx.lineTo(hand[b].x*canvas.width,hand[b].y*canvas.height);ctx.stroke();}
  for(const p of hand){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();}
  if(!stopped&&reference&&(mode==='hand'||mode==='single'))target=handTargets(features(hand),reference,referenceAngles,limits,Number($('gain').value),mode==='single'?Number($('jointSelect').value):-1);
 }else{hand=null;loseHand();}
}
function loseHand(){if(mode==='hand'||mode==='single')freeze();if(reference){clearReference();say('Mất dấu tay: đã giữ tư thế. Đưa tay trở lại và lấy mốc mới.');}$('calibrate').disabled=true;status('KHÔNG THẤY TAY');}
addEventListener('pagehide',releaseCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden){freeze();clearReference();}});
new ResizeObserver(()=>{const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('scene'));
let previous=performance.now();const position=new THREE.Vector3();
function frame(now){requestAnimationFrame(frame);const dt=(now-previous)/1000;previous=now;
 try{detect(now);}catch(e){hand=null;freeze();clearReference();landmarker?.close();landmarker=null;$('calibrate').disabled=true;$('retryAI').hidden=false;status('CAMERA OK · AI LỖI');say(`Camera vẫn mở. Nhận diện gặp lỗi: ${e.message}. Nhấn Thử lại AI.`);console.error(e);}
 if(stream&&landmarker&&!aiLoading&&now-lastSeen>300&&(mode==='hand'||mode==='single'))loseHand();
 if(ready&&!stopped&&!document.hidden){
  if(mode==='demo')target=limits.map(([lo,hi],i)=>clamp(Math.sin(now/2000+i*.6)*.42,lo,hi));
  q=advance(q,target,dt);
 }
 if(ready){joints.forEach(({child,axis},i)=>{child.quaternion.setFromAxisAngle(axis,q[i]);$('j'+i).value=String(q[i]);$('j'+i).disabled=stopped;$('v'+i).value=(q[i]*180/Math.PI).toFixed(1)+'°';});scene.updateMatrixWorld(true);links.L6.getWorldPosition(position);$('xyz').textContent=`X ${(position.x*1000).toFixed(1)} / Y ${(position.y*1000).toFixed(1)} / Z ${(position.z*1000).toFixed(1)}`;}
 orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);loadRobot().catch(e=>{$('modelStatus').textContent='LỖI TẢI MÔ HÌNH';say('Không tải được mô hình 3D. Kiểm tra mạng và tải lại trang.');console.error(e);});
