// Integration check with Chromium's synthetic camera, never a person's webcam.
const {chromium}=require(process.env.COBOT_PLAYWRIGHT);
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({permissions:['camera'],serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8000/');
  await page.waitForFunction(()=>document.querySelector('#modelStatus').textContent.includes('SẴN SÀNG'),null,{timeout:60000});
  await page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#camera').textContent==='Tắt camera',null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='KHÔNG THẤY TAY',null,{timeout:90000});
  assert(await page.locator('#video').evaluate(v=>v.videoWidth>0&&v.readyState>=2));
  assert((await page.locator('#performanceStatus').textContent()).includes('AI nền'),'Real MediaPipe must initialize and infer in background worker');
  const stopped=await page.locator('#v0').textContent();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#v0').textContent(),stopped);
  await page.locator('#video').evaluate(v=>v.pause());
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='CAMERA ĐỨNG HÌNH',null,{timeout:6000});
  assert(await page.locator('#calibrate').isDisabled());
  await page.locator('#recoverCamera').click();
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='KHÔNG THẤY TAY',null,{timeout:90000});
  assert(await page.locator('#video').evaluate(v=>!v.paused&&v.currentTime>0));
  await page.getByRole('button',{name:'Tắt camera',exact:true}).click();
  assert(await page.locator('#video').evaluate(v=>v.srcObject===null));
  // Fail AI only: camera must stay open and the retry button must work.
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#modelStatus').textContent.includes('SẴN SÀNG'));
  await page.route('**/hand_landmarker.task',route=>route.fulfill({status:503,body:'test failure'}));
  await page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='CAMERA OK · AI LỖI',null,{timeout:60000});
  assert(await page.locator('#video').evaluate(v=>v.srcObject?.active&&v.videoWidth>0));
  await page.unroute('**/hand_landmarker.task');
  await page.getByRole('button',{name:'Thử lại AI',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='KHÔNG THẤY TAY',null,{timeout:90000});
  await page.getByRole('button',{name:'Tắt camera',exact:true}).click();
  await page.goto('http://localhost:8000/camera-check.html');
  await page.getByRole('button',{name:'Kiểm tra camera',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('CÓ HÌNH'),null,{timeout:20000});
  await page.getByRole('button',{name:'Tắt / Hủy',exact:true}).click();
  assert(await page.locator('#preview').evaluate(v=>v.srcObject===null));
  // Force the compatibility fallback for window-controlled landmark fixtures only.
  await page.route('**/vision-worker.js',r=>r.fulfill({contentType:'application/javascript',body:`self.onmessage=()=>self.postMessage({type:'error',message:'Fixture uses window landmarks'});`}));
  // Controlled landmarks exercise synchronization, independently of model accuracy.
  const {OPEN_HAND}=await import('../web/hand-model.mjs');
  const fixture=`export const FilesetResolver={forVisionTasks:async()=>({})};
  export class HandLandmarker{static async createFromOptions(){return new HandLandmarker();} close(){} detectForVideo(){
   const state=globalThis.__handState||'open';if(state==='missing')return {landmarks:[],worldLandmarks:[]};
   const p=${JSON.stringify(OPEN_HAND)}.map(v=>[...v]);
   if(state==='bend'){p[7]=[.028,.075,.019];p[8]=[.028,.057,.025];}
   return {landmarks:[p.map(([x,y,z])=>({x:.5+x*3+(state==='move'?.1:0),y:.8-y*3,z:-z*3}))],worldLandmarks:[p.map(([x,y,z])=>({x,y:-y,z:-z}))],handedness:[[{categoryName:'Right'}]]};
  }};`;
  await page.route('**/hand-view.js',async route=>{
   const response=await route.fetch();let source=await response.text();
   source=source.replace('return {group,update};',`return {group,update(points){globalThis[robot?'__robotPoints':'__skeletonPoints']=points.map(p=>[...p]);update(points);}};`);
   await route.fulfill({response,body:source});
  });
  await page.route('**/vision_bundle.mjs',r=>r.fulfill({contentType:'application/javascript',body:fixture}));
  await page.addInitScript(()=>{window.__videoDraws=0;window.__popupDraws=0;window.__cameraCalls=0;const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{window.__cameraCalls++;return gum(...args);};const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(this.canvas.id==='overlay'&&(source instanceof HTMLVideoElement||source instanceof HTMLCanvasElement))window.__videoDraws++;if(this.canvas.id==='popupCanvas'&&source instanceof HTMLVideoElement)window.__popupDraws++;return draw.call(this,source,...args);};});
  await page.goto('http://localhost:8000/');
  await page.waitForFunction(()=>document.querySelector('#modelStatus').textContent.includes('SẴN SÀNG'));
  await page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#calibrate').disabled,null,{timeout:30000});
  assert.equal(await page.locator('#visibility').inputValue(),'skeleton');
  assert.equal(await page.locator('#video').evaluate(v=>getComputedStyle(v).opacity),'0');
  await page.getByRole('button',{name:'Lấy mốc tay',exact:true}).click();
  await page.waitForTimeout(700);
  const beforeFinger=Number((await page.locator('#f1').textContent()).replace('%',''));
  const wristBefore=await page.locator('#v4').textContent();
  await page.evaluate(()=>window.__handState='bend');
  await page.waitForFunction(v=>Number(document.querySelector('#f1').textContent.replace('%',''))>v+20,beforeFinger,{timeout:6000});
  assert.equal(await page.locator('#v4').textContent(),wristBefore);
  // Repeated alternating poses must be applied in full on the first accepted frame.
  for(const state of ['open','bend','open','bend']){
   await page.evaluate(state=>window.__handState=state,state);
   const bent=state==='bend';
   await page.waitForFunction(bent=>{
    const points=window.__robotPoints;if(!points)return false;
    return bent?Math.abs(points[8][2])>.02:Math.abs(points[8][2])<1e-8;
   },bent,{timeout:6000});
   assert(await page.evaluate(()=>JSON.stringify(window.__robotPoints)===JSON.stringify(window.__skeletonPoints)),'Both 3D renders must consume the identical applied pose');
   const points=await page.evaluate(()=>window.__robotPoints);
   const expected=OPEN_HAND.map(p=>[...p]);if(bent){expected[7]=[.028,.075,.019];expected[8]=[.028,.057,.025];}
   const {handPose}=await import('../web/hand-model.mjs');
   const local=handPose(expected.map(([x,y,z])=>({x:.5+x*3,y:.8-y*3,z:-z*3})),expected.map(([x,y,z])=>({x,y:-y,z:-z}))).local;
   assert(points.every((p,i)=>p.every((v,j)=>Math.abs(v-local[i][j])<1e-8)),'No trailing independent finger interpolation');
  }
  const armBefore=await page.locator('.joint output').allTextContents();
  await page.evaluate(()=>window.__handState='move');
  await page.waitForFunction(previous=>Array.from(document.querySelectorAll('.joint output')).slice(0,3).some((el,i)=>Math.abs(parseFloat(el.textContent)-parseFloat(previous[i]))>.5),armBefore,{timeout:6000});
  assert.equal(await page.evaluate(()=>window.__videoDraws),0,'Skeleton mode must paint no video pixels');
  await page.locator('#visibility').selectOption('full');
  await page.waitForFunction(()=>window.__videoDraws>0);
  await page.locator('#visibility').selectOption('skeleton');
  const draws=await page.evaluate(()=>window.__videoDraws);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__videoDraws),draws);
  assert(await page.locator('#videoPopup').isHidden());
  await page.locator('#toggleVideoPopup').click();
  await page.waitForFunction(()=>window.__popupDraws>2);
  assert.equal(await page.evaluate(()=>window.__cameraCalls),1,'Popup must reuse the camera');
  assert.equal(await page.evaluate(()=>window.__videoDraws),draws,'Popup must not expose video in skeleton panel');
  assert.equal(await page.locator('#syncState').textContent(),'● ĐỒNG BỘ');
  const initial=await page.locator('#videoPopup').boundingBox();
  await page.mouse.move(initial.x+70,initial.y+20);await page.mouse.down();await page.mouse.move(initial.x-30,initial.y-80,{steps:5});await page.mouse.up();
  const moved=await page.locator('#videoPopup').boundingBox();assert(moved.x<initial.x-50&&moved.y<initial.y-50);
  const handle=await page.locator('#popupResize').boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+50,handle.y+handle.height/2+40,{steps:5});await page.mouse.up();
  assert((await page.locator('#videoPopup').boundingBox()).width>moved.width+30);
  await page.locator('#closeVideoPopup').click();
  const popupDraws=await page.evaluate(()=>window.__popupDraws);await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__popupDraws),popupDraws);
  assert(await page.locator('#video').evaluate(v=>v.srcObject.active));
  assert.equal(await page.locator('#syncState').textContent(),'● ĐỒNG BỘ');
  await page.locator('#toggleVideoPopup').click();
  require('node:fs').mkdirSync('_qa',{recursive:true});
  await page.getByRole('button',{name:'Xem bàn tay',exact:true}).click();
  await page.screenshot({path:'_qa/hand-sync.png',fullPage:true});
  await page.evaluate(()=>window.__handState='missing');
  await page.waitForFunction(()=>document.querySelector('#syncState').textContent==='CHƯA LẤY MỐC',null,{timeout:4000});
  const frozen=await page.locator('.joint output').allTextContents();
  await page.evaluate(()=>window.__handState='move');await page.waitForTimeout(500);
  assert.deepEqual(await page.locator('.joint output').allTextContents(),frozen);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'_qa/hand-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Small floating video stays on screen while its own calibration action is used.
  await page.waitForFunction(()=>!document.querySelector('#popupCalibrate').disabled);
  assert.equal(await page.locator('#videoPopup').evaluate(el=>el.parentElement.id),'mobileVideoSlot','Mobile video must dock above the controls');
  const mobile=await page.locator('#videoPopup').boundingBox();
  const cameraButton=await page.locator('#camera').boundingBox();
  assert(mobile.width>250&&mobile.width<=390,'Mobile video must use the panel width');
  assert(mobile.x>=0&&mobile.x+mobile.width<=390,'Mobile video must stay within horizontal bounds');
  assert(mobile.y+mobile.height<=cameraButton.y+1,'Docked video must not cover camera controls');
  await page.locator('#popupCalibrate').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.querySelector('#popupCalibrate').disabled);
  assert(await page.locator('#popupCalibrate').evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);}), 'Docked calibration must accept taps');
  await page.locator('#popupCalibrate').click();
  await page.waitForFunction(()=>document.querySelector('#syncState').textContent==='● ĐỒNG BỘ');
  assert(await page.locator('#videoPopup').isVisible(),'Calibration keeps video open');
  const frames=await page.evaluate(()=>window.__popupDraws);
  await page.waitForFunction(n=>window.__popupDraws>n+2,frames);
  await page.locator('#popupSize').click();
  const expanded=await page.locator('#videoPopup').boundingBox();
  assert(expanded.height>mobile.height+30,'Expand changes dock height');
  await page.locator('#popupSize').click();
  assert(await page.locator('#videoPopup').isVisible(),'Minimize must not hide video');
  const compact=await page.locator('#videoPopup').boundingBox();
  assert(compact.height<expanded.height-30,'Minimize reduces dock height');
  const cameraBelow=await page.locator('#camera').boundingBox();
  assert(compact.y+compact.height<=cameraBelow.y+1,'Minimized dock must keep controls clear');
  await page.screenshot({path:'_qa/mobile-calibration.png',fullPage:true});
  await page.locator('#closeVideoPopup').click();
  await page.locator('#camera').click();
  assert(await page.locator('#videoPopup').isHidden());assert(await page.locator('#toggleVideoPopup').isDisabled());
  assert.deepEqual(errors,[]);
  console.log('PASS: floating video reuses one stream, preserves calibration/privacy, drag/resize, mobile bounds and camera shutdown.');
  console.log('PASS: calibration, five finger mapping, independent wrist, position IK, hidden video pixels, loss freeze, mobile layout.');
  console.log('PASS: real MediaPipe init + inference on synthetic video; camera survives AI failure; retry succeeds; stop releases stream.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
