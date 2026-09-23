// One existing camera stream, rendered only after an explicit user action.
export function videoPopup(video) {
 const $=id=>document.getElementById(id),panel=$('videoPopup'),toggle=$('toggleVideoPopup'),canvas=$('popupCanvas'),ctx=canvas.getContext('2d');
 const mobile=matchMedia('(max-width: 600px), (pointer: coarse) and (max-width: 950px)'),slot=$('mobileVideoSlot');
 const home=panel.parentElement;
 function place(){
  const dock=mobile.matches;
  panel.classList.toggle('docked',dock);panel.classList.toggle('compact',dock);panel.style.cssText='';
  if(dock&&panel.parentElement!==slot)slot.append(panel);
  if(!dock&&panel.parentElement!==home)home.append(panel);
  if(!dock&&!panel.hidden){const r=panel.getBoundingClientRect();fit(r.x,r.y);}
  sizeLabel();
 }
 function sizeLabel(){
  const compact=panel.classList.contains('compact');
  $('popupSize').textContent=compact?'↗':'↙';
  $('popupSize').setAttribute('aria-label',compact?'Phóng to video':'Thu nhỏ video');
  $('popupSize').title=compact?'Phóng to video':'Thu nhỏ video';
 }
 $('popupSize').onclick=()=>{
  const r=panel.getBoundingClientRect();panel.classList.toggle('compact');panel.style.width='';panel.style.height='';
  fit(r.x,r.y);sizeLabel();
 };
 $('popupCalibrate').onclick=()=>{if(!$('calibrate').disabled)$('calibrate').click();};
 mobile.addEventListener('change',place);place();
 let active=false,lastTime=-1;
 function fit(x,y,w=panel.offsetWidth,h=panel.offsetHeight){
  w=Math.min(w,innerWidth-16);h=Math.min(h,innerHeight-16);
  Object.assign(panel.style,{width:w+'px',height:h+'px',left:Math.max(8,Math.min(x,innerWidth-w-8))+'px',top:Math.max(8,Math.min(y,innerHeight-h-8))+'px',right:'auto',bottom:'auto'});
 }
 function show(open,focus=false){
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Ẩn video nổi':'Hiện video nổi';
  lastTime=-1;ctx.clearRect(0,0,canvas.width,canvas.height);
  if(open){const r=panel.getBoundingClientRect();if(!panel.classList.contains('docked'))fit(r.x,r.y);if(focus)$('closeVideoPopup').focus();}
  else if(focus)toggle.focus({preventScroll:true});
 }
 toggle.onclick=()=>{if(active)show(panel.hidden,true);};
 $('closeVideoPopup').onclick=()=>show(false,true);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();show(false,true);}});
 function gesture(handle,resize){
  let start=null;
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.target.closest('button'))return;
   const r=panel.getBoundingClientRect();start={id:e.pointerId,x:e.clientX,y:e.clientY,r};handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
   if(!start||start.id!==e.pointerId)return;
   const {r,x,y}=start,dx=e.clientX-x,dy=e.clientY-y;
   if(resize)fit(r.x,r.y,Math.max(240,r.width+dx),Math.max(200,r.height+dy));else fit(r.x+dx,r.y+dy);
  });
  const end=()=>{start=null;};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
 }
 gesture($('popupHandle'),false);gesture($('popupResize'),true);
 $('popupResize').addEventListener('keydown',e=>{
  const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!delta)return;
  e.preventDefault();const r=panel.getBoundingClientRect();fit(r.x,r.y,Math.max(240,r.width+delta[0]),Math.max(200,r.height+delta[1]));
 });
 addEventListener('resize',()=>{place();if(!panel.hidden&&!panel.classList.contains('docked')){const r=panel.getBoundingClientRect();fit(r.x,r.y);}});
 globalThis.visualViewport?.addEventListener('resize',place);
 return {
  setActive(value){active=value;toggle.disabled=!value;if(!value)show(false);},
  draw(){
   $('popupCalibrate').disabled=$('calibrate').disabled;
   if(!active||panel.hidden||video.readyState<2||!video.videoWidth||lastTime===video.currentTime)return;
   lastTime=video.currentTime;
   const w=Math.min(video.videoWidth,640),h=Math.round(w*video.videoHeight/video.videoWidth);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,w,h);ctx.restore();
  }
 };
}
