import * as THREE from 'three';
import {gridIndex,type WorldData} from './world';
import {groundHeight} from './survey';
const short=(name:string)=>name.replace(/ Street$/,' St').replace(/ Avenue$/,' Ave').replace(/ Circle$/,' Cir');
/** Navigation aids derived from mapped junctions; placement is inferred, not surveyed. */
export function createStreetSigns(data:WorldData){
 const points=new Map<string,{x:number;z:number;names:Set<string>;width:number}>();
 for(const r of data.roads.filter(r=>r.name&&['primary','secondary','tertiary','residential','unclassified'].includes(r.kind)))for(const p of r.points){const key=`${Math.round(p.x*2)},${Math.round(p.z*2)}`;let j=points.get(key);if(!j){j={...p,names:new Set(),width:r.width};points.set(key,j);}j.names.add(r.name);j.width=Math.max(j.width,r.width);}
 const group=new THREE.Group(),signs:{sprite:THREE.Sprite;x:number;z:number}[]=[];const material=new THREE.MeshStandardMaterial({color:'#858e83',roughness:.8});
 for(const junction of points.values()){
  if(junction.names.size<2||Math.abs(junction.x)>345||Math.abs(junction.z)>345)continue;if(signs.some(s=>Math.hypot(s.x-junction.x,s.z-junction.z)<20))continue;
  const d=junction.width/2+4;let spot:{x:number;z:number}|undefined;
  for(const [dx,dz]of [[0,-d],[-d,0],[0,d],[d,0],[-d,-d],[d,-d],[-d,d],[d,d]]){const x=junction.x+dx,z=junction.z+dz,i=gridIndex(x,z);if(i>=0&&!data.occupied[i]&&data.surface[i]!==2){spot={x,z};break;}}
  if(!spot)continue;const y=groundHeight(data.survey,spot.x,spot.z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,3.4,6),material);pole.position.set(spot.x,y+1.7,spot.z);pole.castShadow=true;group.add(pole);
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const c=canvas.getContext('2d')!;c.fillStyle='#34594c';c.fillRect(0,0,768,192);c.strokeStyle='#ecedd8';c.lineWidth=7;c.strokeRect(8,8,752,176);c.font='600 46px system-ui';c.fillStyle='#f6f3dd';c.textAlign='center';c.textBaseline='middle';const names=[...junction.names].slice(0,2);names.forEach((name,i)=>c.fillText(short(name),384,54+i*80,720));
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));sprite.position.set(spot.x,y+3.15,spot.z);sprite.scale.set(3.4,.85,1);group.add(sprite);signs.push({sprite,...spot});
 }
 return {group,count:signs.length,update(camera:THREE.Camera,walking:boolean){group.visible=walking;if(!walking)return;for(const s of signs){const d=Math.hypot(camera.position.x-s.x,camera.position.z-s.z);s.sprite.visible=d<80;(s.sprite.material as THREE.SpriteMaterial).opacity=Math.max(0,Math.min(1,(80-d)/30));}}};
}
