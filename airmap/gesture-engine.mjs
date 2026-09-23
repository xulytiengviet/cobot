// Vietflex AirMap: deterministic gesture state machine and Web Mercator math.
// Inspired by Cobot LAB 10's single-frame policy; adapted to map controls.
// No DOM, camera, network or map-provider dependencies in this module.
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const MAX_LAT=85.05112878;

export function panLatLngByPixels(position,dx,dy,zoom){
 const size=256*Math.pow(2,zoom), lat=clamp(position.lat,-MAX_LAT,MAX_LAT);
 const s=Math.sin(lat*Math.PI/180);
 const x=(position.lng+180)/360*size+dx;
 const y=(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size+dy;
 const lng=((x/size*360-180+540)%360)-180;
 const n=Math.PI-2*Math.PI*y/size;
 return {lat:clamp(180/Math.PI*Math.atan(Math.sinh(n)),-MAX_LAT,MAX_LAT),lng};
}
function straight(points,tip,pip){
 return distance(points[0],points[tip]) > distance(points[0],points[pip])*1.12;
}
export function analyzeHand(points,handedness='Unknown'){
 if(!Array.isArray(points)||points.length!==21||points.some(p=>!p||![p.x,p.y].every(Number.isFinite)))return null;
 const size=distance(points[0],points[9]);
 if(size<0.045)return null;
 const fingers=[straight(points,8,6),straight(points,12,10),straight(points,16,14),straight(points,20,18)];
 const count=fingers.filter(Boolean).length;
 const pinchRatio=distance(points[4],points[8])/size;
 const center={x:1-(points[0].x+points[9].x)/2,y:(points[0].y+points[9].y)/2};
 const pointer={x:clamp(1-points[8].x,0,1),y:clamp(points[8].y,0,1)};
 let gesture='neutral';
 if(count===0&&pinchRatio>=.45)gesture='fist';
 else if(fingers[0]&&fingers[1]&&!fingers[2]&&!fingers[3]&&pinchRatio>=.48)gesture='victory';
 else if(pinchRatio<.49)gesture='pinch';
 else if(count>=3)gesture='open';
 else if(fingers[0]&&count===1)gesture='point';
 return {size,center,pointer,fingers,count,pinchRatio,gesture,handedness};
}
export class AirGestureController {
 constructor({onEvent=()=>{},autoCalibrate=true}={}){
  this.onEvent=onEvent;this.autoCalibrate=autoCalibrate;this.reset();
 }
 emit(type,detail={}){this.onEvent({type,...detail});}
 reset(){
  this.calibrated=false;this.reference=null;this.last=null;this.lastSample=null;
  this.stableSince=0;this.gestureSince=0;this.currentGesture='';
  this.lastTime=-1;this.lastFrame=-1;this.paused=false;this.held=false;
  this.victoryFired=false;this.fistFired=false;
  this.dwellAnchor=null;this.dwellFired=false;
 }
 calibrate(){
  if(!this.lastSample||!['open','neutral'].includes(this.lastSample.gesture))return false;
  this.reference={...this.lastSample.center,size:this.lastSample.size,handedness:this.lastSample.handedness};
  this.calibrated=true;this.paused=false;this.last=null;this.currentGesture='';
  this.emit('calibrated',{reference:this.reference});return true;
 }
 feed(points,now,handedness='Unknown',frameId=-1){
  if(!Number.isFinite(now)||now<=this.lastTime||frameId>=0&&frameId<=this.lastFrame)return null;
  this.lastTime=now;if(frameId>=0)this.lastFrame=frameId;
  const h=analyzeHand(points,handedness);
  if(!h){this.lost(now);return null;}
  if(this.reference&&handedness!=='Unknown'&&this.reference.handedness!=='Unknown'&&handedness!==this.reference.handedness){
   this.calibrated=false;this.reference=null;this.last=null;this.emit('hand-changed');
  }
  this.lastSample=h;
  if(h.gesture!==this.currentGesture){
   this.currentGesture=h.gesture;this.gestureSince=now;this.last=null;this.victoryFired=false;this.fistFired=false;
   this.dwellAnchor=null;this.dwellFired=false;
  }
  if(!this.calibrated&&this.autoCalibrate&&h.gesture==='open'){
   if(!this.stableSince){this.stableSince=now;this.stableCenter={...h.center};}
   if(distance(h.center,this.stableCenter)>.045){this.stableSince=now;this.stableCenter={...h.center};}
   if(now-this.stableSince>1000)this.calibrate();
  }else if(!this.calibrated&&h.gesture!=='open')this.stableSince=0;
  if(!this.calibrated){this.emit('observed',{hand:h,calibrating:true});return h;}
  if(h.gesture==='fist'){
   if(!this.fistFired&&now-this.gestureSince>1050){this.paused=!this.paused;this.fistFired=true;this.emit('pause',{paused:this.paused});}
   this.last=null;return h;
  }
  if(this.paused){this.last=null;return h;}
  if(h.gesture==='victory'&&!this.victoryFired&&now-this.gestureSince>850){
   this.victoryFired=true;this.emit('toggle-satellite');
  }
  if(h.gesture==='point'){
   this.emit('pointer',{pointer:h.pointer});
   if(!this.dwellAnchor||distance(h.pointer,this.dwellAnchor)>.035){
    this.dwellAnchor={...h.pointer};this.dwellSince=now;this.dwellFired=false;
   }else if(!this.dwellFired&&now-this.dwellSince>1000){
    this.dwellFired=true;this.emit('dwell',{pointer:h.pointer});
   }
  }
  if(now-this.gestureSince<180){this.last=h;return h;}
  if(this.last&&h.gesture===this.last.gesture&&h.gesture==='open'){
   const dx=clamp(h.center.x-this.last.center.x,-.075,.075);
   const dy=clamp(h.center.y-this.last.center.y,-.075,.075);
   if(Math.hypot(dx,dy)>.006)this.emit('pan',{dx,dy});
  }
  if(this.last&&h.gesture===this.last.gesture&&h.gesture==='pinch'){
   const delta=clamp(Math.log(h.size/this.last.size)*5,-.38,.38);
   if(Math.abs(delta)>.03)this.emit('zoom',{delta});
  }
  this.last=h;this.emit('observed',{hand:h,calibrating:false});
  return h;
 }
 lost(now){
  this.last=null;this.currentGesture='';this.stableSince=0;this.dwellAnchor=null;
  this.emit('lost',{at:now});
 }
}