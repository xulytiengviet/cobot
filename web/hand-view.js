import * as THREE from 'three';
import {BONES,OPEN_HAND} from './hand-model.mjs';
export function makeHand(robot=false){
 const group=new THREE.Group(),joints=[],bones=[];
 const shell=new THREE.MeshStandardMaterial({color:robot?0xe4ecef:0x81f1c6,metalness:robot?.6:.1,roughness:.3});
 const jointMat=new THREE.MeshStandardMaterial({color:robot?0x223b49:0xeafff5,metalness:.45,roughness:.3});
 const cylinder=new THREE.CylinderGeometry(1,1,1,robot?12:8),sphere=new THREE.SphereGeometry(1,12,8);
 for(let i=0;i<21;i++){const mesh=new THREE.Mesh(sphere,jointMat);mesh.scale.setScalar(robot?.004:.0025);group.add(mesh);joints.push(mesh);}
 for(const [a,b] of BONES){const mesh=new THREE.Mesh(cylinder,shell);mesh.castShadow=robot;group.add(mesh);bones.push({a,b,mesh});}
 if(robot){
  const palm=new THREE.Mesh(new THREE.BoxGeometry(.061,.039,.014),shell);palm.position.set(-.001,.025,0);palm.castShadow=true;group.add(palm);
  const inset=new THREE.Mesh(new THREE.BoxGeometry(.045,.025,.015),new THREE.MeshStandardMaterial({color:0x21443e,metalness:.6,roughness:.35}));inset.position.copy(palm.position);group.add(inset);
  const wrist=new THREE.Mesh(new THREE.CylinderGeometry(.017,.019,.020,20),jointMat);wrist.position.y=-.004;group.add(wrist);
 }
 const direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 function update(points){for(let i=0;i<21;i++)joints[i].position.fromArray(points[i]);for(const {a,b,mesh}of bones){direction.subVectors(joints[b].position,joints[a].position);mesh.position.copy(joints[a].position).addScaledVector(direction,.5);mesh.scale.set(robot?.0038:.0015,direction.length(),robot?.0038:.0015);mesh.quaternion.setFromUnitVectors(up,direction.normalize());}}
 update(OPEN_HAND);return {group,update};
}
export function skeletonPreview(container){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080e13');
 const camera=new THREE.PerspectiveCamera(38,1,.005,2);camera.up.set(0,0,1);const center=new THREE.Vector3(),offset=new THREE.Vector3(.12,-.18,.16);
 const hand=makeHand();scene.add(hand.group);scene.add(new THREE.HemisphereLight(0xffffff,0x344a55,3));
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.append(renderer.domElement);
 const observer=new ResizeObserver(()=>{const r=container.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});observer.observe(container);
 return {update(points,orientation){
  hand.update(points);if(orientation)hand.group.quaternion.copy(orientation);
  center.set(0,.052,0).applyQuaternion(hand.group.quaternion);
  camera.position.copy(center).add(offset);camera.lookAt(center);
  renderer.render(scene,camera);
 }};
}
