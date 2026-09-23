// One camera stream, two responsive presentations: a dock on touch screens and a movable window on desktop.
export function videoPopup(video) {
 const $=id=>document.getElementById(id);
 const panel=$('videoPopup'),toggle=$('toggleVideoPopup'),dock=$('mobileVideoSlot');
 const canvas=$('popupCanvas'),ctx=canvas.getContext('2d');
 const mobile=matchMedia('(max-width: 950px), (pointer: coarse)');
 let active=false,lastTime=-1,lastDraw=0,desktopRect=null;
 const onMobile=()=>mobile.matches;
 function sizeLabel(){
  const compact=panel.classList.contains('compact');
  $('popupSize').textContent=compact?'↗':'↙';
  $('popupSize').setAttribute('aria-label',compact?'Phóng to video':'Thu nhỏ video');
  $('popupSize').title=compact?'Phóng to video':'Thu nhỏ video';
 }
 function bounds(){
  const v=window.visualViewport;
  return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};
 }
 function fit(x,y,w=panel.offsetWidth,h=panel.offsetHeight){
  if(onMobile())return;
  const v=bounds(),maxW=Math.max(180,v.width-16),maxH=Math.max(180,v.height-16);
  w=Math.min(Math.max(240,w),maxW);h=Math.min(Math.max(200,h),maxH);
  const left=Math.max(v.left+8,Math.min(x,v.left+v.width-w-8));
  const top=Math.max(v.top+8,Math.min(y,v.top+v.height-h-8));
  Object.assign(panel.style,{width:w+'px',height:h+'px',left:left+'px',top:top+'px',right:'auto',bottom:'auto'});
  desktopRect={x:left,y:top,w,h};
 }
 function place(){
  // Never overlay calibration or the main controls on a phone.
  if(onMobile()){
   if(panel.parentElement!==dock)dock.append(panel);
   panel.style.cssText='';
   panel.classList.add('docked','compact');
  }else{
   if(panel.parentElement!==document.body)document.body.append(panel);
   panel.classList.remove('docked');
   panel.style.cssText='';
   panel.classList.remove('compact');
   const r=desktopRect||{x:innerWidth-360,y:innerHeight-330,w:340,h:310};
   fit(r.x,r.y,r.w,r.h);
  }
  sizeLabel();
 }
 function show(open,focus=false){
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  toggle.textContent=open?'Ẩn video':'Hiện video';
  if(!open){lastTime=-1;ctx.clearRect(0,0,canvas.width,canvas.height);}
  if(open&&onMobile()&&focus)panel.scrollIntoView({block:'nearest',behavior:'smooth'});
  if(open&&!onMobile()){const r=panel.getBoundingClientRect();fit(r.x,r.y);}
  if(focus&&open)$('closeVideoPopup').focus({preventScroll:true});
  if(focus&&!open)toggle.focus({preventScroll:true});
 }
 $('popupSize').onclick=()=>{
  panel.classList.toggle('compact');
  if(!onMobile()){const r=panel.getBoundingClientRect(),small=panel.classList.contains('compact');fit(r.x,r.y,small?240:340,small?220:310);}
  sizeLabel();
 };
 $('popupCalibrate').onclick=()=>{if(!$('calibrate').disabled)$('calibrate').click();};
 toggle.onclick=()=>{if(active)show(panel.hidden,true);};
 $('closeVideoPopup').onclick=()=>show(false,true);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();show(false,true);}});
 function gesture(handle,resize){
  let start=null;
  handle.addEventListener('pointerdown',e=>{
   if(onMobile()||e.button!==0||e.target.closest('button'))return;
   const r=panel.getBoundingClientRect();start={id:e.pointerId,x:e.clientX,y:e.clientY,r};
   handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
   if(!start||start.id!==e.pointerId)return;
   const {r,x,y}=start,dx=e.clientX-x,dy=e.clientY-y;
   if(resize)fit(r.x,r.y,r.width+dx,r.height+dy);else fit(r.x+dx,r.y+dy);
  });
  const end=()=>{start=null;};
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
 }
 gesture($('popupHandle'),false);gesture($('popupResize'),true);
 $('popupResize').addEventListener('keydown',e=>{
  if(onMobile())return;
  const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
  if(!delta)return;
  e.preventDefault();const r=panel.getBoundingClientRect();fit(r.x,r.y,r.width+delta[0],r.height+delta[1]);
 });
 mobile.addEventListener('change',place);
 addEventListener('resize',()=>{if(onMobile()){place();return;}if(!panel.hidden){const r=panel.getBoundingClientRect();fit(r.x,r.y);}});
 window.visualViewport?.addEventListener('resize',()=>{if(!onMobile()&&!panel.hidden){const r=panel.getBoundingClientRect();fit(r.x,r.y);}});
 window.visualViewport?.addEventListener('scroll',()=>{if(!onMobile()&&!panel.hidden){const r=panel.getBoundingClientRect();fit(r.x,r.y);}});
 place();
 return {
  setActive(value){active=value;toggle.disabled=!value;if(!value)show(false);else if(onMobile())show(true,false);},
  draw(){
   $('popupCalibrate').disabled=$('calibrate').disabled;
   if(!active||panel.hidden||video.readyState<2||!video.videoWidth||lastTime===video.currentTime)return;
   const now=performance.now();
   if(onMobile()&&now-lastDraw<65)return; // Avoid a second full-rate canvas on phones.
   lastTime=video.currentTime;lastDraw=now;
   const w=Math.min(video.videoWidth,onMobile()?360:640),h=Math.round(w*video.videoHeight/video.videoWidth);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   try{ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,w,h);ctx.restore();}
   catch(error){ctx.restore();if(error.name!=='InvalidStateError')console.warn('Popup frame',error);}
  }
 };
}
