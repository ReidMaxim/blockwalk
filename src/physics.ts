import RAPIER from '@dimforge/rapier3d-compat';
import type { Voxel } from './architecture';
import { groundHeight } from './survey';
import { CELL, HALF, SIZE, gridIndex, type Point, type WorldData } from './world';
export async function createPhysics(data:WorldData,trees:{x:number;z:number;r:number}[],steps:Voxel[]=[]){
 await RAPIER.init();
 const world=new RAPIER.World({x:0,y:-18,z:0});world.timestep=1/60;
 const n=data.survey.metadata.groundSize;const heights=new Float32Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)heights[x*n+z]=data.survey.ground[z*n+x];world.createCollider(RAPIER.ColliderDesc.heightfield(n-1,n-1,heights,{x:HALF*2,y:1,z:HALF*2}));
 // Merge each footprint's voxel rows into simple collision volumes.
 for(const b of data.buildings){const rows=new Map<number,number[]>();for(const p of b.cells){const xs=rows.get(p.z)||[];xs.push(p.x);rows.set(p.z,xs);}for(const [z,xs] of rows){xs.sort((a,b)=>a-b);let start=xs[0],end=start;const flush=()=>world.createCollider(RAPIER.ColliderDesc.cuboid((end-start+CELL)/2,(b.height+4)/2,CELL/2).setTranslation((start+end)/2,b.base+(b.height-4)/2,z));for(let i=1;i<xs.length;i++){if(xs[i]-end>CELL+.01){flush();start=xs[i];}end=xs[i];}flush();}}
 for(const s of steps){const yaw=s.yaw||0;world.createCollider(RAPIER.ColliderDesc.cuboid(s.sx/2,s.sy/2,s.sz/2).setTranslation(s.x,s.y,s.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));}
 for(const t of trees)world.createCollider(RAPIER.ColliderDesc.cuboid(.5,2,.5).setTranslation(t.x,groundHeight(data.survey,t.x,t.z)+2,t.z));
 for(const [x,z,hx,hz] of [[-HALF,0,.5,HALF],[HALF,0,.5,HALF],[0,-HALF,HALF,.5],[0,HALF,HALF,.5]])world.createCollider(RAPIER.ColliderDesc.cuboid(hx,100,hz).setTranslation(x,50,z));
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(data.spawn.x,groundHeight(data.survey,data.spawn.x,data.spawn.z)+1.1,data.spawn.z));const collider=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.3),body);const controller=world.createCharacterController(.025);controller.enableAutostep(.35,.2,true);controller.enableSnapToGround(.3);controller.setSlideEnabled(true);
 let vy=0;let walked=0;
 function step(dx:number,dz:number,jump:boolean){if(jump&&controller.computedGrounded())vy=6;else vy=Math.max(-20,vy-18/60);controller.computeColliderMovement(collider,{x:dx,y:vy/60,z:dz});const m=controller.computedMovement(),p=body.translation();body.setNextKinematicTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z});world.step();if(controller.computedGrounded()&&vy<0)vy=0;walked+=Math.hypot(m.x,m.z);return body.translation();}
 function reset(point:Point=data.spawn){const i=gridIndex(point.x,point.z);if(i<0||i>=SIZE*SIZE||data.occupied[i])return false;body.setTranslation({x:point.x,y:groundHeight(data.survey,point.x,point.z)+1.1,z:point.z},true);body.setNextKinematicTranslation({x:point.x,y:groundHeight(data.survey,point.x,point.z)+1.1,z:point.z});vy=0;return true;}
 return {world,step,reset,position:()=>body.translation(),distance:()=>walked};
}
