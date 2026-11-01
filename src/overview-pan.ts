import {HALF} from './world';
// Move camera and orbit target together, relative to the current ground-plane view.
export function overviewPan(fx:number,fz:number,x:number,z:number,dt:number,fast:boolean,targetX:number,targetZ:number){
 const input=Math.hypot(x,z);if(!input)return {x:0,z:0};
 const length=Math.hypot(fx,fz);if(length<1e-6){fx=0;fz=-1;}else{fx/=length;fz/=length;}
 const speed=(fast?180:80)*Math.min(Math.max(dt,0),.075)/Math.max(1,input);
 const dx=(-fz*x+fx*z)*speed,dz=(fx*x+fz*z)*speed;
 return {x:Math.max(-HALF+10,Math.min(HALF-10,targetX+dx))-targetX,z:Math.max(-HALF+10,Math.min(HALF-10,targetZ+dz))-targetZ};
}
