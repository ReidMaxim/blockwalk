import type { Point } from './world';
type Sample=Point & {h:number};
export type RoofFit={height:(p:Point)=>number;axis:Point;hip:boolean;flat:boolean};
const median=(v:number[])=>{v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
/** Fit simple gable/hip/flat surfaces to lidar, resisting tree returns and missing cells.
 * A roof prior prevents isolated scan samples from becoming voxel towers. */
export function fitRoof(samples:Sample[],_rng:()=>number,outline:Point[]){
 if(samples.length<6)return {height:(_p:Point)=>NaN,axis:{x:1,z:0},hip:false,flat:false};
 const cx=samples.reduce((a,p)=>a+p.x,0)/samples.length,cz=samples.reduce((a,p)=>a+p.z,0)/samples.length;
 const hs=samples.map(p=>p.h).sort((a,b)=>a-b),flat=median([...hs]);const range=hs[Math.floor(hs.length*.9)]-hs[Math.floor(hs.length*.1)];
 if(range<.65)return {height:(_p:Point)=>flat,axis:{x:1,z:0},hip:false,flat:true};
 const angles=new Set<number>();for(let i=1;i<outline.length;i++){const a=outline[i-1],b=outline[i];if(Math.hypot(b.x-a.x,b.z-a.z)<3)continue;const angle=(Math.atan2(b.z-a.z,b.x-a.x)+Math.PI*2)%Math.PI;angles.add(Math.round(angle*36/Math.PI)/36*Math.PI);angles.add((Math.round(angle*36/Math.PI)/36*Math.PI+Math.PI/2)%Math.PI);}
 // Add coarse orientations in case the footprint has no edge along the ridge.
 for(let n=0;n<12;n++)angles.add(n*Math.PI/12);
 let bestCost=Infinity,best:RoofFit={height:(_p:Point)=>flat,axis:{x:1,z:0},hip:false,flat:true};
 for(const angle of angles){const c=Math.cos(angle),s=Math.sin(angle);const pts=samples.map(p=>({u:(p.x-cx)*c+(p.z-cz)*s,v:-(p.x-cx)*s+(p.z-cz)*c,h:p.h}));const us=pts.map(p=>p.u),vs=pts.map(p=>p.v);const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs),midU=(minU+maxU)/2,midV=(minV+maxV)/2,halfU=(maxU-minU)/2,halfV=(maxV-minV)/2;
  if(halfV<1.2)continue;
  for(const offset of [-.12,0,.12])for(const pitch of [.25,.4,.55,.7,.9])for(const hip of [false,true]){
   const ridge=midV+offset*halfV*2;const dist=(u:number,v:number)=>Math.max(Math.abs(v-ridge),hip?Math.max(0,Math.abs(u-midU)-halfU+halfV):0);
   const peak=median(pts.map(p=>p.h+pitch*dist(p.u,p.v)));
   const errors=pts.map(p=>Math.abs(peak-pitch*dist(p.u,p.v)-p.h)).sort((a,b)=>a-b);const keep=Math.ceil(errors.length*.78);let cost=0;for(let i=0;i<keep;i++)cost+=errors[i]**2;cost/=keep;
   // Mildly prefer a straight gable when both shapes explain the measurements equally well.
   cost+=hip?.006:0;
   if(cost<bestCost){bestCost=cost;best={axis:{x:c,z:s},hip,flat:false,height:p=>{const u=(p.x-cx)*c+(p.z-cz)*s,v=-(p.x-cx)*s+(p.z-cz)*c;return peak-pitch*dist(u,v);}};}
  }
 }
 // Large, mostly level roofs should remain flat despite equipment on top.
 const flatErrors=samples.map(p=>Math.abs(p.h-flat)).sort((a,b)=>a-b);const keep=Math.ceil(flatErrors.length*.78);const flatCost=flatErrors.slice(0,keep).reduce((a,e)=>a+e*e,0)/keep;
 if(flatCost<bestCost*1.1)return {height:(_p:Point)=>flat,axis:{x:1,z:0},hip:false,flat:true};
 return best;
}
