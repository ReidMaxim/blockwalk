import {DATA_LICENSES} from './data-licenses';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {hydrateWorld,SIZE,HALF,type BakedLayout,type GeoOrigin,type WorldData} from './world';
import type {Survey} from './survey';
export type WorldInfo={title:string;location:string;origin:GeoOrigin;quality:'survey'|'map';createdAt:string;sources:string[];warnings:string[]};
export type WorldBundle={data:WorldData;info:WorldInfo};
const names=['layout.json','surface.bin','ground.bin','roofs.bin','canopy.bin','colors.bin','metadata.json'];
const bytes=(a:ArrayBufferView)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const finite=(n:unknown,max=1e5)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=max;
const point=(p:any,max=HALF)=>p&&finite(p.x,max)&&finite(p.z,max);
const text=(s:unknown,max=1000)=>typeof s==='string'&&s.length<=max;
export function validateLayout(l:any){
 if(!l||l.version!==3||l.width!==720||!Array.isArray(l.buildings)||l.buildings.length>2500||!Array.isArray(l.roads)||l.roads.length>8000||!point(l.spawn))throw new Error('Unsupported or oversized world layout');
 let cells=0,points=0;const ids=new Set<number>();
 for(const b of l.buildings){if(!finite(b.id,1e15)||ids.has(b.id)||!Array.isArray(b.points)||b.points.length<3||b.points.length>4096||!b.points.every((p:any)=>point(p,HALF+160))||!Array.isArray(b.cells)||!Array.isArray(b.tops)||b.cells.length!==b.tops.length||!point(b.center)||!point(b.front,1e5)||!point(b.roofAxis,1.1)||!finite(b.base,5000)||!finite(b.height,250)||b.height<=0||!finite(b.eave,5000)||!Array.isArray(b.roofColor)||b.roofColor.length!==3||!b.roofColor.every((c:unknown)=>finite(c,255)&&Number(c)>=0)||typeof b.hipRoof!=='boolean'||typeof b.measured!=='boolean')throw new Error('Invalid building geometry');ids.add(b.id);cells+=b.cells.length;if(cells>220000||!b.cells.every((p:any)=>point(p,HALF-.001))||!b.tops.every((h:unknown)=>finite(h,5000)))throw new Error('World contains invalid or excessive voxels');}
 for(const r of l.roads){if(!text(r.name,200)||!text(r.kind,100)||!finite(r.width,100)||r.width<=0||!Array.isArray(r.points)||r.points.length>30000||!r.points.every((p:any)=>point(p,1e5)))throw new Error('Invalid street geometry');points+=r.points.length;if(points>40000)throw new Error('World contains too many street points');}
 if(l.focusId!==null&&!ids.has(l.focusId))throw new Error('Starting building is missing');
}
export function validateSurvey(s:Survey){const m=s.metadata;if(!m||m.groundSize!==361||m.groundStep!==2||m.surfaceSize!==720||m.surfaceStep!==1||s.ground.length!==361**2||s.roofs.length!==720**2||s.canopy.length!==720**2||s.colors.length!==720**2*3||!finite(m.baseElevation,10000))throw new Error('World survey dimensions are invalid');if(!s.ground.every(v=>finite(v,3000))||!s.canopy.every(v=>finite(v,100)&&v>=0)||!s.roofs.every(v=>Number.isNaN(v)||finite(v,5000)))throw new Error('World survey contains invalid heights');}
function validateInfo(i:WorldInfo){if(!i||!text(i.title,160)||!text(i.location,300)||!i.origin||!finite(i.origin.lat,85)||!finite(i.origin.lon,180)||!['survey','map'].includes(i.quality)||!Array.isArray(i.sources)||i.sources.length>30||!i.sources.every(s=>text(s,2000))||!Array.isArray(i.warnings)||i.warnings.length>30||!i.warnings.every(s=>text(s,2000)))throw new Error('World description is invalid');}
export function layoutOf(d:WorldData):BakedLayout{return {version:3,width:720,sourceHash:'portable',roads:d.roads,buildings:d.buildings,spawn:d.spawn,focusId:d.focus?.id??null,sourceCount:d.sourceCount};}
export function encodeWorld(bundle:WorldBundle):Uint8Array{validateInfo(bundle.info);validateSurvey(bundle.data.survey);const layout=layoutOf(bundle.data);validateLayout(layout);const s=bundle.data.survey;const files:Record<string,Uint8Array>={'licenses.txt':strToU8(DATA_LICENSES),'manifest.json':strToU8(JSON.stringify({format:'blockwalk-world',version:1,info:bundle.info})),'layout.json':strToU8(JSON.stringify(layout)),'metadata.json':strToU8(JSON.stringify(s.metadata)),'surface.bin':bundle.data.surface,'ground.bin':bytes(s.ground),'roofs.bin':bytes(s.roofs),'canopy.bin':bytes(s.canopy),'colors.bin':s.colors};let size=0;for(const file of Object.values(files)){size+=file.byteLength;if(file.byteLength>18*1024*1024||size>32*1024*1024)throw new Error('This world exceeds the portable-file budget. Choose a less dense area.');}const packed=zipSync(files,{level:6});if(packed.byteLength>32*1024*1024)throw new Error('This world file is too large to reopen safely.');return packed;}
export function decodeWorld(input:Uint8Array):WorldBundle{
 if(input.byteLength>32*1024*1024)throw new Error('World file is too large (32 MB maximum)');let total=0,count=0;
 const files=unzipSync(input,{filter:f=>{if(++count>9||!['manifest.json','licenses.txt',...names].includes(f.name))throw new Error('Unexpected entry in world file');total+=f.originalSize;if(f.originalSize>18*1024*1024||total>32*1024*1024)throw new Error('World file expands beyond the supported size');return true;}});
 for(const n of ['manifest.json',...names])if(!files[n])throw new Error(`World file is missing ${n}`);
 const manifest=JSON.parse(strFromU8(files['manifest.json']));if(manifest.format!=='blockwalk-world'||manifest.version!==1)throw new Error('This is not a supported Blockwalk world');validateInfo(manifest.info);
 const l=JSON.parse(strFromU8(files['layout.json']));validateLayout(l);const float=(n:string)=>{const a=files[n];if(a.byteLength%4)throw new Error('Damaged height raster');return new Float32Array(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength));};
 const survey:Survey={metadata:JSON.parse(strFromU8(files['metadata.json'])),ground:float('ground.bin'),roofs:float('roofs.bin'),canopy:float('canopy.bin'),colors:files['colors.bin']};validateSurvey(survey);if(files['surface.bin'].length!==SIZE*SIZE)throw new Error('Damaged street raster');return {data:hydrateWorld(l,files['surface.bin'],survey),info:manifest.info};
}
