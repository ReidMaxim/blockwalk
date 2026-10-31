import * as THREE from 'three';
import { CELL, HALF, SIZE, gridIndex, random, type WorldData } from './world';
import { groundHeight, sampleColor } from './survey';
import { buildArchitecture } from './architecture';
import { createStreetSigns } from './signs';
type Block={x:number;y:number;z:number;sx:number;sy:number;sz:number;color:THREE.ColorRepresentation;yaw?:number;glass?:boolean};
export function createScene(canvas:HTMLCanvasElement,data:WorldData){
 const {survey}=data;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#c8d9df');scene.fog=new THREE.Fog('#c8d9df',180,650);
 const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,.1,1800);
 const hemisphere=new THREE.HemisphereLight('#f4f7ff','#7b8668',1.85);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#fff4de',2.3);sun.position.set(-120,200,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,near:1,far:650});sun.shadow.bias=-.0004;sun.shadow.normalBias=.18;scene.add(sun);
 const blocks:Block[]=[];
 const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number,color:THREE.ColorRepresentation)=>{if(sy>.001)blocks.push({x,y,z,sx,sy,sz,color});};
 // The ground follows a 2m USGS elevation grid. A 1m aerial-color texture preserves actual
 // driveways, parking areas and lawns instead of painting every empty space as grass.
 const n=survey.metadata.groundSize,positions=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),indices:number[]=[];
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x;positions.set([x*2-HALF,survey.ground[i],z*2-HALF],i*3);uv.set([x/(n-1),z/(n-1)],i*2);if(x<n-1&&z<n-1){indices.push(i,i+n,i+1,i+1,i+n,i+n+1);}}
 const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));terrainGeometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));terrainGeometry.setIndex(indices);terrainGeometry.computeVertexNormals();
 const rgb=survey.colors,rgba=new Uint8Array(rgb.length/3*4);for(let i=0;i<rgb.length/3;i++){rgba[i*4]=rgb[i*3];rgba[i*4+1]=rgb[i*3+1];rgba[i*4+2]=rgb[i*3+2];rgba[i*4+3]=255;}
 const texture=new THREE.DataTexture(rgba,720,720,THREE.RGBAFormat);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 const terrain=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({map:texture,roughness:1}));terrain.receiveShadow=true;scene.add(terrain);
 const bottoms=survey.ground.reduce((a,b)=>Math.min(a,b),Infinity)-4;
 for(let i=0;i<n-1;i++){const p=-HALF+i*2+1;for(const [x,z] of [[p,-HALF],[p,HALF],[-HALF,p],[HALF,p]]){const top=groundHeight(survey,x,z);add(x,(top+bottoms)/2,z,2,top-bottoms,2,'#797d62');}}
 const architecture=buildArchitecture(data);for(const block of architecture.blocks)blocks.push(block);
 const measuredBuildings=data.buildings.filter(b=>b.measured).length;
 // Continuous facade planes follow source outlines; roofs and vegetation retain voxel silhouettes.
 const sidingCanvas=document.createElement('canvas');sidingCanvas.width=4;sidingCanvas.height=32;const sc=sidingCanvas.getContext('2d')!;sc.fillStyle='#ffffff';sc.fillRect(0,0,4,32);sc.fillStyle='#e2e2df';sc.fillRect(0,29,4,2);sc.fillStyle='#f3f3ef';sc.fillRect(0,31,4,1);
 const siding=new THREE.CanvasTexture(sidingCanvas);siding.wrapS=siding.wrapT=THREE.RepeatWrapping;siding.repeat.set(1,1/.19);siding.colorSpace=THREE.SRGBColorSpace;siding.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 for(const foundation of [false,true]){
  const verts:number[]=[],colors:number[]=[],uvs:number[]=[],faces:number[]=[];
  for(const p of architecture.panels.filter(p=>!!p.foundation===foundation)){
   const dx=p.b.x-p.a.x,dz=p.b.z-p.a.z,length=Math.hypot(dx,dz),nx=dz/length*p.outward,nz=-dx/length*p.outward,offset=foundation?.014:0;const index=verts.length/3;
   verts.push(p.a.x+nx*offset,p.bottomA,p.a.z+nz*offset,p.b.x+nx*offset,p.bottomB,p.b.z+nz*offset,p.b.x+nx*offset,p.topB,p.b.z+nz*offset,p.a.x+nx*offset,p.topA,p.a.z+nz*offset);
   uvs.push(0,p.bottomA,length,p.bottomB,length,p.topB,0,p.topA);const color=new THREE.Color(p.color);for(let i=0;i<4;i++)colors.push(color.r,color.g,color.b);
   if(p.outward>0)faces.push(index,index+2,index+1,index,index+3,index+2);else faces.push(index,index+1,index+2,index,index+2,index+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(faces);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:foundation?null:siding,side:THREE.DoubleSide}));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 }
 // Lidar canopy peaks + vegetation-colored aerial pixels replace random tree positions.
 const trees:{x:number;z:number;r:number;height:number;ground:number}[]=[];
 const canopy=survey.canopy;
 const candidates:{x:number;z:number;h:number;i:number}[]=[];
 for(let z=3;z<717;z+=2)for(let x=3;x<717;x+=2){const i=z*720+x,h=canopy[i];if(h<4||h>35)continue;const wx=x-HALF+.5,wz=z-HALF+.5,idx=gridIndex(wx,wz);if(data.occupied[idx]||data.surface[idx]===2)continue;const [r,g,b]=sampleColor(survey,wx,wz);if(g<r*.99||g<b*.98)continue;let peak=true;for(let dz=-2;dz<=2;dz+=2)for(let dx=-2;dx<=2;dx+=2)if(canopy[(z+dz)*720+x+dx]>h+.5)peak=false;if(peak)candidates.push({x:wx,z:wz,h,i});}
 candidates.sort((a,b)=>b.h-a.h);
 for(const p of candidates){const radius=Math.max(2,Math.min(6,p.h*.23));if(trees.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<Math.min(radius,t.r)*1.25))continue;let clear=true;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(data.occupied[gridIndex(p.x+dx,p.z+dz)])clear=false;if(!clear)continue;
  const y=groundHeight(survey,p.x,p.z),top=y+p.h,leafBase=y+p.h*.5;const rgb=sampleColor(survey,p.x,p.z),leaf=new THREE.Color(`rgb(${Math.min(125,Math.round(rgb[0]*1.05))},${Math.min(143,Math.round(rgb[1]*1.1))},${Math.min(105,Math.round(rgb[2]*.86))})`);add(p.x,y+p.h*.36,p.z,.65,p.h*.72,.65,'#77654e');
  // Build irregular crowns from metre cubes, retaining the measured local silhouette.
  for(let dz=-Math.ceil(radius);dz<=radius;dz++)for(let dx=-Math.ceil(radius);dx<=radius;dx++){
   const d=Math.hypot(dx,dz)/radius;if(d>1)continue;const localIndex=gridIndex(p.x+dx,p.z+dz),local=localIndex<0?0:canopy[localIndex];const crownTop=Math.min(top,Math.max(leafBase+1,local>p.h*.55?groundHeight(survey,p.x+dx,p.z+dz)+local:top-d*radius*.65));
   const low=leafBase+Math.max(0,d-.6)*radius;const h=Math.round((crownTop-low)*2)/2;if(h<.5)continue;add(p.x+dx,low+h/2,p.z+dz,1,h,1,leaf.clone().multiplyScalar(.92+(dx+dz+20)%4*.035));
  }
  trees.push({x:p.x,z:p.z,r:radius,height:p.h,ground:y});
 }
 // Chunk instancing keeps visibility culling useful in the walking view.
 const chunks=new Map<string,Block[]>();for(const b of blocks){const key=`${Math.floor(b.x/64)},${Math.floor(b.z/64)},${b.glass?1:0}`;const list=chunks.get(key)||[];list.push(b);chunks.set(key,list);}
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({roughness:1});const glass=new THREE.MeshStandardMaterial({roughness:.2,metalness:.1});const dummy=new THREE.Object3D();
 for(const list of chunks.values()){const mesh=new THREE.InstancedMesh(geometry,list[0].glass?glass:material,list.length);list.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.yaw||0,0);dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(b.color));});mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}
 const marker=new THREE.Group();const markerBody=new THREE.Mesh(new THREE.BoxGeometry(.6,1.1,.4),new THREE.MeshStandardMaterial({color:'#e5bd68'}));markerBody.position.y=.9;marker.add(markerBody);const head=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),new THREE.MeshStandardMaterial({color:'#f2d6ae'}));head.position.y=1.65;marker.add(head);scene.add(marker);
 const streetSigns=createStreetSigns(data);scene.add(streetSigns.group);
 const presets=[{name:'Daylight',sky:'#c8d9df',sun:'#fff4de',intensity:2.3,ambient:1.85,offset:[-120,200,90]},{name:'Golden hour',sky:'#d9c8b5',sun:'#ffd29a',intensity:2.35,ambient:1.35,offset:[-175,90,100]},{name:'Overcast',sky:'#cbd1d0',sun:'#edf1ef',intensity:.65,ambient:2.35,offset:[-100,220,80]}];let light=0;
 const lighting={next(){light=(light+1)%presets.length;return presets[light].name;},get name(){return presets[light].name;},update(focus:THREE.Vector3){const p=presets[light];hemisphere.intensity=p.ambient;sun.intensity=p.intensity;sun.color.set(p.sun);sun.position.set(focus.x+p.offset[0],focus.y+p.offset[1],focus.z+p.offset[2]);sun.target.position.copy(focus);sun.target.updateMatrixWorld();(scene.background as THREE.Color).set(p.sky);if(scene.fog)scene.fog.color.set(p.sky);}};
 const dispose=()=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(object=>{const o=object as THREE.Mesh;if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}});for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();sun.shadow.map?.dispose();renderer.dispose();};
 return {scene,camera,renderer,marker,trees,blockCount:blocks.length,sun,measuredBuildings,lighting,streetSigns,colliders:architecture.colliders,fineRoofs:architecture.fineRoofs,dispose};
}
