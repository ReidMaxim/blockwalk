import { gridIndex, inside, nearest, random, type Footprint, type Point, type WorldData } from './world';
import { groundHeight } from './survey';
export type Voxel = {x:number;y:number;z:number;sx:number;sy:number;sz:number;color:string|number; yaw?:number; glass?:boolean};
export type Panel = {a:Point;b:Point;bottomA:number;bottomB:number;topA:number;topB:number;color:string;outward:number;foundation?:boolean};
export type Edge = {a:Point;b:Point;t:Point;n:Point;length:number;yaw:number};
export function footprintEdges(points:Point[]):Edge[]{
 let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.z-b.x*a.z;}const sign=area>=0?1:-1;
 const edges:Edge[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.05)continue;const t={x:(b.x-a.x)/length,z:(b.z-a.z)/length};edges.push({a,b,t,n:{x:t.z*sign,z:-t.x*sign},length,yaw:-Math.atan2(t.z,t.x)});}return edges;
}
export function roofSampler(b:Footprint){const cells=new Map(b.cells.map((p,i)=>[gridIndex(p.x,p.z),b.tops[i]]));return (p:Point)=>{const ax=Math.floor(p.x-.5)+.5,az=Math.floor(p.z-.5)+.5,fx=p.x-ax,fz=p.z-az;let sum=0,w=0;for(const [dx,dz,weight] of [[0,0,(1-fx)*(1-fz)],[1,0,fx*(1-fz)],[0,1,(1-fx)*fz],[1,1,fx*fz]]){const h=cells.get(gridIndex(ax+dx,az+dz));if(h!==undefined){sum+=h*weight;w+=weight;}}if(w>.001)return sum/w;let distance=Infinity,result=b.eave;for(let i=0;i<b.cells.length;i++){const q=b.cells[i],d=(p.x-q.x)**2+(p.z-q.z)**2;if(d<distance){distance=d;result=b.tops[i];}}return result;};}
export function displayRoofHeight(b:Footprint,edges:Edge[],roofAt:(p:Point)=>number,p:Point){
 const raw=roofAt(p);if(b.base+b.height-b.eave<.65)return raw;
 let distance=Infinity;for(const edge of edges){if(!b.hipRoof&&Math.abs(edge.n.x*b.roofAxis.x+edge.n.z*b.roofAxis.z)>.65)continue;const q=nearest(p,edge.a,edge.b);distance=Math.min(distance,Math.hypot(q.x-p.x,q.z-p.z));}
 const blend=inside(p,b.points)?Math.max(0,Math.min(1,distance/1.4)):0;return Math.max(b.eave+.12,b.eave+(raw-b.eave)*blend);
}
export function buildArchitecture(data:WorldData){
 const panels:Panel[]=[],blocks:Voxel[]=[],colliders:Voxel[]=[];let fineRoofs=0;
 const add=(b:Voxel)=>{if(b.sy>.001&&b.sx>.001&&b.sz>.001)blocks.push(b);};
 const walls=['#dedbd0','#d9ddd7','#e4dfd2','#d0d7d6','#d5cdc1'];
 for(const b of data.buildings){
  const rng=random(b.id),wall=walls[Math.floor(rng()*walls.length)],edges=footprintEdges(b.points),roofAt=roofSampler(b),color=b.roofColor;
  const outward=edges.length?Math.sign(edges[0].t.z*edges[0].n.x-edges[0].t.x*edges[0].n.z):1;
  const front=edges.filter(e=>e.length>2&&e.n.x*(b.front.x-b.center.x)+e.n.z*(b.front.z-b.center.z)>0).sort((a,c)=>{const p=nearest(b.front,a.a,a.b),q=nearest(b.front,c.a,c.b);return Math.hypot(p.x-b.front.x,p.z-b.front.z)-Math.hypot(q.x-b.front.x,q.z-b.front.z);})[0];
  const displayRoof=(p:Point)=>displayRoofHeight(b,edges,roofAt,p);
  const near=Math.hypot(b.center.x,b.center.z)<115;const step=near?.5:1;if(near)fineRoofs++;
  const minX=Math.floor(Math.min(...b.points.map(p=>p.x))/step)*step,minZ=Math.floor(Math.min(...b.points.map(p=>p.z))/step)*step,maxX=Math.max(...b.points.map(p=>p.x)),maxZ=Math.max(...b.points.map(p=>p.z));
  // The measured height field is unchanged; only its display sampling becomes finer nearby.
  for(let z=minZ-step/2;z<maxZ+step/2;z+=step)for(let x=minX-step/2;x<maxX+step/2;x+=step){const p={x,z};let within=inside(p,b.points);if(!within)within=edges.some(e=>{const q=nearest(p,e.a,e.b);return Math.hypot(q.x-x,q.z-z)<.22;});if(!within)continue;
   const top=Math.round(displayRoof(p)*8)/8,low=Math.min(b.eave-.1,top-.2);const variation=.96+((Math.round(x*2)*13+Math.round(z*2)*7+b.id)%7+7)%7*.012;
   const rgb=color.map(v=>Math.min(255,Math.round(v*variation)));const roofColor=`rgb(${rgb.join(',')})`;
   add({x,y:(low+top)/2,z,sx:step+.015,sy:top-low,sz:step+.015,color:roofColor});
  }
  for(const edge of edges){
   const isGable=!b.hipRoof&&Math.abs(edge.n.x*b.roofAxis.x+edge.n.z*b.roofAxis.z)>.65;
   const count=Math.max(1,Math.ceil(edge.length/(near?.5:1))),at=(distance:number):Point=>({x:edge.a.x+edge.t.x*distance,z:edge.a.z+edge.t.z*distance});
   for(let i=0;i<count;i++){const a=at(edge.length*i/count),c=at(edge.length*(i+1)/count),ga=groundHeight(data.survey,a.x,a.z),gc=groundHeight(data.survey,c.x,c.z);const baseA=Math.min(b.base,ga)-.1,baseB=Math.min(b.base,gc)-.1,topA=Math.min(isGable?displayRoof(a)-.15:b.eave,displayRoof(a)-.12),topB=Math.min(isGable?displayRoof(c)-.15:b.eave,displayRoof(c)-.12);
    panels.push({a,b:c,bottomA:baseA,bottomB:baseB,topA,topB,color:wall,outward});
    panels.push({a,b:c,bottomA:baseA-.01,bottomB:baseB-.01,topA:Math.max(baseA+.15,b.base+.23),topB:Math.max(baseB+.15,b.base+.23),color:'#a2a397',outward,foundation:true});
    const mid=at(edge.length*(i+.5)/count),trimTop=isGable?displayRoof(mid)-.13:Math.min(b.eave,displayRoof(mid)-.13);
    add({x:mid.x+edge.n.x*.07,y:trimTop-.18,z:mid.z+edge.n.z*.07,sx:edge.length/count+.025,sy:.12,sz:.2,color:'#e1ded2',yaw:edge.yaw});
   }
   if(edge.length<2.1)continue;
   const doorAt=edge===front?Math.max(.8,Math.min(edge.length-.8,(b.front.x-edge.a.x)*edge.t.x+(b.front.z-edge.a.z)*edge.t.z)):-100;
   const place=(distance:number,y:number,sx:number,sy:number,depth:number,color:string,offset=.055,glass=false)=>{const p=at(distance);add({x:p.x+edge.n.x*offset,y,z:p.z+edge.n.z*offset,sx,sy,sz:depth,color,yaw:edge.yaw,glass});};
   const floors=Math.min(40,Math.max(1,Math.round((b.eave-b.base)/2.9)));const bays=Math.max(1,Math.floor((edge.length-.8)/2.7));
   for(let k=0;k<bays;k++){const distance=edge.length*(k+.5)/bays;if(Math.abs(distance-doorAt)<1.05)continue;
    for(let f=0;f<floors;f++){const y=b.base+1.65+f*2.8;if(y+.7>Math.min(b.eave,roofAt(at(distance)))-.2)continue;
     place(distance,y,.98,1.3,.12,'#f0eee2');place(distance,y,.77,1.08,.045,'#46636a',.13,true);
     place(distance,y,.045,1.08,.05,'#e6e8dd',.16);place(distance,y,.77,.045,.05,'#e6e8dd',.16);
     place(distance,y-.7,1.1,.09,.24,'#e4e0d2',.13);
    }
   }
   if(isGable&&edge.length>4&&b.height>5&&b.eave-b.base<4.8){const mid=edge.length/2,y=b.eave+.7;if(y+.35<roofAt(at(mid))-.25){place(mid,y,.65,.85,.12,'#e8e5d7');place(mid,y,.48,.66,.05,'#48696c',.14,true);}}
   if(edge===front){
    place(doorAt,b.base+1.12,1.13,2.27,.12,'#eee9dc');place(doorAt,b.base+1.07,.91,2.1,.08,'#6a6b61',.13);place(doorAt,b.base+1.57,.57,.68,.05,'#769190',.18,true);place(doorAt+.32,b.base+1.02,.065,.065,.07,'#c7ae73',.2);
    place(doorAt,b.base+2.32,1.5,.12,.7,'#d9d5c8',.28);
    const p=at(doorAt),landing={x:p.x+edge.n.x*.55,z:p.z+edge.n.z*.55},ground=groundHeight(data.survey,landing.x,landing.z),height=Math.max(.1,b.base+.06-ground);
    if(height<1){const block={x:landing.x,y:ground+height/2,z:landing.z,sx:1.5,sy:height,sz:1.1,color:'#adafa2',yaw:edge.yaw};add(block);colliders.push(block);
     if(height>.25){const h=Math.min(height-.13,.26),s={x:p.x+edge.n.x*1.3,y:ground+h/2,z:p.z+edge.n.z*1.3,sx:1.5,sy:h,sz:.5,color:'#b6b7a9',yaw:edge.yaw};add(s);colliders.push(s);}}
   }
  }
 }
 return {panels,blocks,colliders,fineRoofs};
}
