import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {features,handTargets,advance,clamp} from './control.mjs';
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
function releaseCamera(){session++;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;hand=null;freeze();clearReference();$('camera').textContent='Bật camera';$('cameraPlaceholder').style.display='flex';$('calibrate').disabled=true;status('CHƯA BẬT');const c=$('overlay');c.getContext('2d').clearRect(0,0,c.width,c.height);}
$('camera').onclick=async()=>{
 if(stream){releaseCamera();say('Đã tắt camera.');return;}if(starting)return;
 if(!window.isSecureContext||!navigator.mediaDevices){say('Camera cần HTTPS hoặc localhost. Hãy mở bằng GitHub Pages.');return;}
 starting=true;$('camera').disabled=true;status('ĐANG TẢI');const token=++session;
 try{
  if(!landmarker){
   say('Đang tải mô hình nhận diện tay. Lần đầu cần Internet…');
   const {HandLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   landmarker=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
  }
  if(token!==session)return;
  const candidate=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
  if(token!==session){candidate.getTracks().forEach(t=>t.stop());return;}stream=candidate;
  stream.getVideoTracks()[0].onended=()=>{if(stream){releaseCamera();say('Camera đã ngắt.');}};
  $('video').srcObject=stream;await $('video').play();lastVideoTime=-1;$('cameraPlaceholder').style.display='none';$('camera').textContent='Tắt camera';status('TÌM BÀN TAY');setMode('hand');
 }catch(e){releaseCamera();say(e.name==='NotAllowedError'?'Camera bị từ chối. Cho phép camera tại biểu tượng cạnh địa chỉ rồi thử lại.':e.name==='NotFoundError'?'Không tìm thấy camera trên thiết bị.':'Không thể khởi động camera / mô hình AI. Kiểm tra mạng và camera rồi thử lại.');console.error(e);}
 finally{starting=false;$('camera').disabled=false;}
};
const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
function detect(now){
 const video=$('video');if(!stream||!landmarker||video.readyState<2||video.currentTime===lastVideoTime||now-lastDetection<50)return;
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
 try{detect(now);}catch(e){releaseCamera();say('Nhận diện gặp lỗi. Bật lại camera để thử lại.');console.error(e);}
 if(stream&&now-lastSeen>300&&(mode==='hand'||mode==='single'))loseHand();
 if(ready&&!stopped&&!document.hidden){
  if(mode==='demo')target=limits.map(([lo,hi],i)=>clamp(Math.sin(now/2000+i*.6)*.42,lo,hi));
  q=advance(q,target,dt);
 }
 if(ready){joints.forEach(({child,axis},i)=>{child.quaternion.setFromAxisAngle(axis,q[i]);$('j'+i).value=String(q[i]);$('j'+i).disabled=stopped;$('v'+i).value=(q[i]*180/Math.PI).toFixed(1)+'°';});scene.updateMatrixWorld(true);links.L6.getWorldPosition(position);$('xyz').textContent=`X ${(position.x*1000).toFixed(1)} / Y ${(position.y*1000).toFixed(1)} / Z ${(position.z*1000).toFixed(1)}`;}
 orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);loadRobot().catch(e=>{$('modelStatus').textContent='LỖI TẢI MÔ HÌNH';say('Không tải được mô hình 3D. Kiểm tra mạng và tải lại trang.');console.error(e);});
