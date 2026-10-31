import { asset } from './paths';
import { HALF, type Point, type GeoOrigin } from './world';
export type Survey = { ground: Float32Array; roofs: Float32Array; canopy: Float32Array; colors: Uint8Array; metadata: { groundSize:number; groundStep:number; surfaceSize:number; surfaceStep:number; baseElevation:number; elevationRange:number[]; lidarPoints:number; lidarYear:number; origin?:GeoOrigin; sources?:Record<string,string>; notes?:string } };
export async function loadSurvey():Promise<Survey>{
 const root=asset('data/survey/');const buffers=await Promise.all(['ground.bin','roofs.bin','canopy.bin','colors.bin'].map(async p=>{const r=await fetch(root+p);if(!r.ok)throw new Error('Survey data could not be loaded');return r.arrayBuffer();}));const r=await fetch(root+'metadata.json');if(!r.ok)throw new Error('Survey metadata could not be loaded');const metadata=await r.json();
 const [ground,roofs,canopy]=buffers.slice(0,3).map(b=>new Float32Array(b));const colors=new Uint8Array(buffers[3]);if(ground.length!==metadata.groundSize**2||roofs.length!==metadata.surfaceSize**2||canopy.length!==roofs.length||colors.length!==roofs.length*3)throw new Error('Survey rasters have mismatched dimensions');return {ground,roofs,canopy,colors,metadata};
}
export function groundHeight(s:Survey,x:number,z:number){const n=s.metadata.groundSize,step=s.metadata.groundStep;const fx=Math.max(0,Math.min(n-1.001,(x+HALF)/step)),fz=Math.max(0,Math.min(n-1.001,(z+HALF)/step)),ix=Math.floor(fx),iz=Math.floor(fz),a=fx-ix,b=fz-iz;return (s.ground[iz*n+ix]*(1-a)+s.ground[iz*n+ix+1]*a)*(1-b)+(s.ground[(iz+1)*n+ix]*(1-a)+s.ground[(iz+1)*n+ix+1]*a)*b;}
export function surveyIndex(s:Survey,x:number,z:number){const n=s.metadata.surfaceSize;const ix=Math.floor((x+HALF)/s.metadata.surfaceStep),iz=Math.floor((z+HALF)/s.metadata.surfaceStep);return ix<0||iz<0||ix>=n||iz>=n?-1:iz*n+ix;}
export function roofHeight(s:Survey,p:Point){const i=surveyIndex(s,p.x,p.z);return i<0?NaN:s.roofs[i];}
export function sampleColor(s:Survey,x:number,z:number):[number,number,number]{const i=surveyIndex(s,x,z);return i<0?[110,125,86]:[s.colors[i*3],s.colors[i*3+1],s.colors[i*3+2]];}
