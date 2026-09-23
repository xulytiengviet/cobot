// Integration check with Chromium's synthetic camera, never a person's webcam.
const {chromium}=require(process.env.COBOT_PLAYWRIGHT);
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({permissions:['camera']});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8000/');
  await page.waitForFunction(()=>document.querySelector('#modelStatus').textContent.includes('SẴN SÀNG'),null,{timeout:60000});
  await page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#camera').textContent==='Tắt camera',null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#cameraState').textContent==='KHÔNG THẤY TAY',null,{timeout:90000});
  assert(await page.locator('#video').evaluate(v=>v.videoWidth>0&&v.readyState>=2));
  const stopped=await page.locator('#v0').textContent();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#v0').textContent(),stopped);
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
  assert.deepEqual(errors,[]);
  console.log('PASS: real MediaPipe init + inference on synthetic video; camera survives AI failure; retry succeeds; stop releases stream.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
