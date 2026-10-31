import { fitRoof } from './roof';
import { groundHeight, roofHeight, sampleColor, type Survey } from './survey';
export const CELL = 1;
export const SIZE = 720;
export const HALF = SIZE * CELL / 2;
export const ORIGIN = { lat: 44.1009685, lon: -70.1876829 };
export type GeoOrigin={lat:number;lon:number};
export type Point = { x: number; z: number };
export type MapElement = { id: number; tags: Record<string,string>; geometry: {lat:number;lon:number}[] };
export type Footprint = { id:number; points:Point[]; height:number; cells:Point[]; base:number; eave:number; tops:number[]; measured:boolean; roofColor:[number,number,number]; front:Point; center:Point; roofAxis:Point; hipRoof:boolean };
export type Road = { name:string; points:Point[]; width:number; kind:string };
export type WorldData = { roads:Road[]; buildings:Footprint[]; surface:Uint8Array; occupied:Uint8Array; spawn:Point; sourceCount:number; survey:Survey; focus:Footprint|undefined };
export function project(lon:number,lat:number,origin:GeoOrigin=ORIGIN):Point { return {x:(lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180),z:-(lat-origin.lat)*111320}; }
export function gridIndex(x:number,z:number) {const a=Math.floor((x+HALF)/CELL),b=Math.floor((z+HALF)/CELL);return a<0||b<0||a>=SIZE||b>=SIZE?-1:b*SIZE+a;}
export function cellPoint(i:number):Point{return {x:(i%SIZE+.5)*CELL-HALF,z:(Math.floor(i/SIZE)+.5)*CELL-HALF};}
export function random(seed:number){let t=seed|0;return ()=>{t+=0x6D2B79F5;let a=Math.imul(t^t>>>15,1|t);a^=a+Math.imul(a^a>>>7,61|a);return ((a^a>>>14)>>>0)/4294967296;};}
export function inside(p:Point,poly:Point[]){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)result=!result;}return result;}
export function nearest(p:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return {x:a.x+t*dx,z:a.z+t*dz};}
function percentile(values:number[],q:number){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))];}
function raster(poly:Point[]){const cells:Point[]=[];const minX=Math.max(-HALF,Math.floor(Math.min(...poly.map(p=>p.x))/CELL)*CELL),maxX=Math.min(HALF,Math.max(...poly.map(p=>p.x)));const minZ=Math.max(-HALF,Math.floor(Math.min(...poly.map(p=>p.z))/CELL)*CELL),maxZ=Math.min(HALF,Math.max(...poly.map(p=>p.z)));for(let z=minZ+CELL/2;z<maxZ;z+=CELL)for(let x=minX+CELL/2;x<maxX;x+=CELL)if(inside({x,z},poly))cells.push({x,z});return cells;}
export function nearestStreet(p:Point,roads:Road[]){let distance=Infinity,point={...p},road:Road|undefined;let candidates=roads.filter(r=>r.name&&!['footway','path'].includes(r.kind));if(!candidates.length)candidates=roads;for(const r of candidates)for(let i=1;i<r.points.length;i++){const n=nearest(p,r.points[i-1],r.points[i]),d=Math.hypot(n.x-p.x,n.z-p.z);if(d<distance){distance=d;point=n;road=r;}}return {point,road,distance};}
export function generateWorld(osm:{elements:MapElement[]},ms:{features:{geometry:{coordinates:number[][][]};properties:{height?:number}}[]},survey:Survey):WorldData{
 const roads:Road[]=osm.elements.filter(e=>e.tags.highway&&e.geometry&&!['steps','construction','proposed'].includes(e.tags.highway)).map(e=>({name:e.tags.name||'',points:e.geometry.map(p=>project(p.lon,p.lat,survey.metadata.origin||ORIGIN)),kind:e.tags.highway,width:parseFloat(e.tags.width)||(['primary','secondary','tertiary'].includes(e.tags.highway)?12:['footway','path','cycleway'].includes(e.tags.highway)?2:e.tags.highway==='service'?4:7)}));
 const origin=survey.metadata.origin||ORIGIN;const isLewiston=Math.abs(origin.lat-ORIGIN.lat)<1e-7&&Math.abs(origin.lon-ORIGIN.lon)<1e-7;
 const buildings:Footprint[]=[];const occupied=new Uint8Array(SIZE*SIZE);let sourceCount=0;
 function add(poly:Point[],id:number,sourceHeight?:number){
  const cells=raster(poly);if(!cells.length||cells.some(p=>occupied[gridIndex(p.x,p.z)]))return;
  const center={x:cells.reduce((s,p)=>s+p.x,0)/cells.length,z:cells.reduce((s,p)=>s+p.z,0)/cells.length};
  const base=percentile(cells.map(p=>groundHeight(survey,p.x,p.z)),.85);
  // The footprint source's height describes the whole building, including the roof.
  const fallback=sourceHeight&&sourceHeight>2&&sourceHeight<200?sourceHeight:5.5;
  const samples=cells.map(p=>roofHeight(survey,p));const good=samples.filter(h=>Number.isFinite(h)&&h>base+1.8&&h<base+Math.max(13,fallback*1.6+3));
  const measured=good.length>=Math.max(5,cells.length*.18);const maxTop=measured?percentile(good,.96):base+fallback;
  let eave=measured?Math.max(base+2.4,percentile(good,.04)):base+fallback*.68;
  if(maxTop-eave<.45)eave=maxTop-.25;
  const front=nearestStreet(center,isLewiston&&inside({x:0,z:0},poly)?roads.filter(r=>r.name==='Russell Street'):roads).point;
  let longest=0,axis={x:1,z:0};for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],l=Math.hypot(b.x-a.x,b.z-a.z);if(l>longest){longest=l;axis={x:(b.x-a.x)/l,z:(b.z-a.z)/l};}}
  const cross=cells.map(p=>(p.x-center.x)*-axis.z+(p.z-center.z)*axis.x),span=Math.max(...cross)-Math.min(...cross),mid=(Math.max(...cross)+Math.min(...cross))/2;
  const fit=fitRoof(cells.map((p,i)=>({...p,h:samples[i]})).filter(p=>Number.isFinite(p.h)&&p.h>base+1.8&&p.h<base+Math.max(13,fallback*1.6+3)),random(id),poly);
  const tops=cells.map((p,i)=>{
   let h=fit.height(p);if(!Number.isFinite(h)||h<eave-.8||h>maxTop+1){const nearby:number[]=[];for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){const q={x:p.x+x,z:p.z+z};const t=roofHeight(survey,q);if(inside(q,poly)&&Number.isFinite(t)&&t>eave-.8&&t<=maxTop+1)nearby.push(t);}h=nearby.length?percentile(nearby,.5):NaN;}
   if(!Number.isFinite(h))h=eave+(maxTop-eave)*Math.max(0,1-Math.abs(cross[i]-mid)/(span/2||1));
   return Math.round(Math.max(base+2.1,Math.min(maxTop+.5,h))*4)/4;
  });
  if(measured)eave=fit.flat?percentile(tops,.5)-.25:Math.max(base+2.6,Math.min(eave,percentile(tops,.12)-.3));
  const roofPixels=cells.map(p=>sampleColor(survey,p.x,p.z)).filter(([r,g,b])=>!(g>r*1.15&&g>b*1.1)&&Math.max(r,g,b)>45);const roofColor=(roofPixels.length?[0,1,2].map(c=>Math.max(45,Math.min(190,percentile(roofPixels.map(p=>p[c]),.65)))):[95,98,97]) as [number,number,number];
  buildings.push({id,points:poly,height:Math.max(...tops)-base,cells,base,eave,tops,measured,roofColor,front,center,roofAxis:fit.axis,hipRoof:fit.hip||fit.flat});for(const p of cells)occupied[gridIndex(p.x,p.z)]=1;sourceCount++;
 }
 for(const e of osm.elements.filter(e=>e.tags.building&&e.geometry))add(e.geometry.map(p=>project(p.lon,p.lat,survey.metadata.origin||ORIGIN)),e.id,parseFloat(e.tags.height)||parseFloat(e.tags['building:levels'])*3);
 ms.features.forEach((f,i)=>add(f.geometry.coordinates[0].map(p=>project(p[0],p[1],origin)),900000+i,f.properties.height));
 const surface=new Uint8Array(SIZE*SIZE);
 for(const road of roads)for(let s=1;s<road.points.length;s++){const a=road.points[s-1],b=road.points[s],r=road.width/2+1.5;const minX=Math.max(-HALF,Math.floor(Math.min(a.x,b.x)-r)),maxX=Math.min(HALF,Math.max(a.x,b.x)+r),minZ=Math.max(-HALF,Math.floor(Math.min(a.z,b.z)-r)),maxZ=Math.min(HALF,Math.max(a.z,b.z)+r);for(let z=minZ+.5;z<maxZ;z+=CELL)for(let x=minX+.5;x<maxX;x+=CELL){const n=nearest({x,z},a,b),d=Math.hypot(x-n.x,z-n.z),idx=gridIndex(x,z);if(d<=road.width/2)surface[idx]=2;else if(d<=r&&surface[idx]<2)surface[idx]=1;}}
 const focus=buildings.find(b=>inside({x:0,z:0},b.points))||[...buildings].sort((a,b)=>Math.hypot(a.center.x,a.center.z)-Math.hypot(b.center.x,b.center.z))[0];
 const street=nearestStreet(focus?.center||{x:0,z:0},isLewiston?roads.filter(r=>r.name==='Russell Street'):roads);let spawn=street.point;
 if(gridIndex(spawn.x,spawn.z)<0||occupied[gridIndex(spawn.x,spawn.z)]){let idx=-1,best=Infinity;for(let i=0;i<surface.length;i++)if(surface[i]===2&&!occupied[i]){const p=cellPoint(i),d=Math.hypot(p.x,p.z);if(d<best){best=d;idx=i;}}if(idx>=0)spawn=cellPoint(idx);else {const clear=occupied.findIndex(v=>v===0);if(clear<0)throw new Error('No clear space for a starting point');spawn=cellPoint(clear);}}
 return {roads,buildings,surface,occupied,spawn,sourceCount,survey,focus};
}

export type BakedLayout={version:number;width:number;sourceHash:string;roads:Road[];buildings:Footprint[];spawn:Point;focusId:number|null;sourceCount:number};
export function hydrateWorld(layout:BakedLayout,surface:Uint8Array,survey:Survey):WorldData{
 if(layout.version!==3||layout.width!==HALF*2||surface.length!==SIZE*SIZE)throw new Error('World layout is out of date. Rebuild the neighborhood.');
 const occupied=new Uint8Array(SIZE*SIZE);for(const b of layout.buildings)for(const p of b.cells){const i=gridIndex(p.x,p.z);if(i<0)throw new Error('Building outside the world boundary');occupied[i]=1;}
 const focus=layout.buildings.find(b=>b.id===layout.focusId);if(layout.focusId!==null&&!focus)throw new Error('Starting house is missing from the prepared world');
 const index=gridIndex(layout.spawn.x,layout.spawn.z);if(index<0||occupied[index]||(layout.roads.length>0&&surface[index]!==2))throw new Error('The prepared world has no safe starting point');
 return {roads:layout.roads,buildings:layout.buildings,spawn:layout.spawn,sourceCount:layout.sourceCount,occupied,surface,survey,focus};
}
