import test from 'node:test';
import assert from 'node:assert/strict';
import { project, gridIndex, HALF, CELL, inside } from './world.ts';
import { groundHeight } from './survey.ts';
import { fitRoof } from './roof.ts';
import { createPhysics } from './physics.ts';
import { loadTestWorld } from './test-data.mjs';
const data=loadTestWorld();
test('address maps to local origin, focus footprint contains it, spawn faces it from a road',()=>{assert.deepEqual(project(-70.1876829,44.1009685),{x:0,z:-0});assert.ok(inside({x:0,z:0},data.focus.points));assert.ok(data.focus.measured);assert.ok(data.buildings.length>300);const i=gridIndex(data.spawn.x,data.spawn.z);assert.equal(data.occupied[i],0);assert.equal(data.surface[i],2);assert.ok(Math.hypot(data.spawn.x,data.spawn.z)<50);});
test('survey retains real elevation range and measured roof shapes',()=>{assert.ok(data.survey.metadata.lidarPoints>2e6);const elevations=data.survey.metadata.elevationRange;assert.ok(elevations[1]-elevations[0]>20);assert.ok(Math.abs(groundHeight(data.survey,0,0))<.01);assert.ok(data.buildings.filter(b=>b.measured).length>350);assert.ok(Math.max(...data.focus.tops)-Math.min(...data.focus.tops)>1);assert.ok(data.focus.height<9);});
test('voxel footprints stay within source outlines and measured roofs remain above terrain',()=>{const seen=new Set();for(const b of data.buildings){assert.equal(b.tops.length,b.cells.length);for(let n=0;n<b.cells.length;n++){const p=b.cells[n];assert.ok(Math.abs(p.x)<HALF&&Math.abs(p.z)<HALF);assert.ok(inside(p,b.points));assert.ok(Number.isFinite(b.tops[n])&&b.tops[n]>b.base+1.5);const i=gridIndex(p.x,p.z);assert.ok(!seen.has(i));seen.add(i);}}});
test('heightfield physics follows measured slopes, blocks buildings and bounds, and allows hopping',async()=>{
 const physics=await createPhysics(data,[]);for(let i=0;i<120;i++)physics.step(0,0,false);let p=physics.position();assert.ok(Math.abs(p.y-groundHeight(data.survey,p.x,p.z)-.875)<.12);
 const before=p.y;physics.step(0,0,true);for(let i=0;i<8;i++)physics.step(0,0,false);assert.ok(physics.position().y>before+.4);for(let i=0;i<120;i++)physics.step(0,0,false);
 const building=data.focus;const edge=building.cells.find(p=>!data.occupied[gridIndex(p.x-1,p.z)]&&!data.occupied[gridIndex(p.x-3,p.z)]);assert.ok(edge);assert.ok(physics.reset({x:edge.x-3,z:edge.z}));for(let i=0;i<120;i++)physics.step(.1,0,false);assert.ok(physics.position().x<edge.x-CELL/2);assert.equal(physics.reset(edge),false);
 // Sample the terrain at asymmetric points so a transposed heightfield cannot silently pass.
 for(const point of [{x:-200,z:-100},{x:150,z:170},{x:310,z:-180}]){if(data.occupied[gridIndex(point.x,point.z)])continue;assert.ok(physics.reset(point));for(let i=0;i<120;i++)physics.step(0,0,false);p=physics.position();assert.ok(Math.abs(p.y-groundHeight(data.survey,p.x,p.z)-.875)<.15,`ground mismatch at ${JSON.stringify(point)}`);}
 let edgeZ=-HALF+4;while(data.occupied[gridIndex(HALF-2,edgeZ)]||data.occupied[gridIndex(HALF-1,edgeZ)])edgeZ+=CELL;assert.ok(physics.reset({x:HALF-2,z:edgeZ}));for(let i=0;i<120;i++)physics.step(.1,0,false);assert.ok(physics.position().x<HALF-.5);physics.world.free();
});

test('roof fitting recovers a pitched roof while rejecting isolated high returns',()=>{
 const samples=[];for(let z=-6;z<=6;z++)for(let x=-4;x<=4;x++)samples.push({x,z,h:7-.65*Math.abs(x)});for(let i=0;i<12;i++)samples[i].h+=8;
 const fit=fitRoof(samples,()=>.5,[{x:-4,z:-6},{x:4,z:-6},{x:4,z:6},{x:-4,z:6},{x:-4,z:-6}]);
 assert.ok(Math.abs(fit.height({x:0,z:0})-7)<.5);assert.ok(fit.height({x:0,z:0})-fit.height({x:4,z:0})>2);assert.ok(Math.abs(fit.height({x:0,z:4})-fit.height({x:0,z:0}))<.5);
});

test('facade normals face outside regardless of source polygon winding',async()=>{
 const {footprintEdges}=await import('./architecture.ts');const square=[{x:0,z:0},{x:8,z:0},{x:8,z:5},{x:0,z:5},{x:0,z:0}];
 for(const polygon of [square,[...square].reverse()])for(const edge of footprintEdges(polygon)){const p={x:(edge.a.x+edge.b.x)/2+edge.n.x*.1,z:(edge.a.z+edge.b.z)/2+edge.n.z*.1};assert.equal(inside(p,polygon),false);assert.ok(Math.abs(Math.hypot(edge.n.x,edge.n.z)-1)<1e-8);}
});
test('detailed architecture remains finite and its entrance steps have matching collision volumes',async()=>{
 const {buildArchitecture}=await import('./architecture.ts');const a=buildArchitecture(data);assert.ok(a.fineRoofs>20&&a.fineRoofs<100);assert.ok(a.panels.length>1000);assert.ok(a.colliders.length>100);
 for(const p of a.panels){for(const n of [p.a.x,p.a.z,p.b.x,p.b.z,p.bottomA,p.bottomB,p.topA,p.topB])assert.ok(Number.isFinite(n));assert.ok(p.topA>p.bottomA&&p.topB>p.bottomB);}
 for(const b of a.blocks){assert.ok([b.x,b.y,b.z,b.sx,b.sy,b.sz,b.yaw||0].every(Number.isFinite));assert.ok(b.sx>0&&b.sy>0&&b.sz>0);}

});

test('prepared layouts reproduce the generated source world and reject unsafe or stale data',async()=>{
 const fs=await import('node:fs');const {hydrateWorld}=await import('./world.ts');const root=new URL('../public/data/',import.meta.url);const layout=JSON.parse(fs.readFileSync(new URL('world-layout.json',root)));const surface=new Uint8Array(fs.readFileSync(new URL('world-surface.bin',root)));const restored=hydrateWorld(layout,surface,data.survey);
 assert.deepEqual(restored.spawn,data.spawn);assert.deepEqual(restored.focus.tops,data.focus.tops);assert.deepEqual(restored.occupied,data.occupied);assert.equal(restored.buildings.length,data.buildings.length);
 assert.throws(()=>hydrateWorld({...layout,version:0},surface,data.survey),/out of date/);assert.throws(()=>hydrateWorld({...layout,spawn:{x:0,z:0}},surface,data.survey),/safe starting/);
});

test('hip-roof display meets the eaves without changing the measured ridge',async()=>{
 const {footprintEdges,displayRoofHeight}=await import('./architecture.ts');const points=[{x:-5,z:-5},{x:5,z:-5},{x:5,z:5},{x:-5,z:5},{x:-5,z:-5}];const b={points,base:0,height:7,eave:3,hipRoof:true,roofAxis:{x:0,z:1}};const edges=footprintEdges(points);
 assert.ok(Math.abs(displayRoofHeight(b,edges,()=>6.5,{x:5,z:0})-3.12)<.01);assert.equal(displayRoofHeight(b,edges,()=>6.5,{x:0,z:0}),6.5);
});
test('the character controller climbs a low entrance step instead of passing through it',async()=>{
 const p=data.spawn,center={x:p.x+2,z:p.z},height=groundHeight(data.survey,center.x,center.z);const step={x:center.x,y:height+.12,z:center.z,sx:1.2,sy:.24,sz:2.4,color:'#aaaaaa',yaw:0};const physics=await createPhysics(data,[],[step]);
 for(let i=0;i<120;i++)physics.step(0,0,false);for(let i=0;i<44;i++)physics.step(.05,0,false);const at=physics.position();assert.ok(at.x>center.x-.15);assert.ok(at.y>height+1);physics.world.free();
});

test('portable worlds retain geometry, all raster values, and attribution',async()=>{
 const {encodeWorld,decodeWorld}=await import('./world-pack.ts');const info={title:'A portable neighborhood',location:'Lewiston, Maine',origin:{lat:44.1009685,lon:-70.1876829},quality:'survey',createdAt:'2026-10-31T00:00:00Z',sources:['© OpenStreetMap contributors · ODbL 1.0'],warnings:['Facade details are inferred.']};const file=encodeWorld({data,info});const restored=decodeWorld(file);assert.deepEqual(restored.info,info);assert.deepEqual(restored.data.focus.tops,data.focus.tops);assert.deepEqual(restored.data.survey.ground,data.survey.ground);assert.deepEqual(restored.data.survey.roofs,data.survey.roofs);assert.deepEqual(restored.data.survey.canopy,data.survey.canopy);assert.deepEqual(restored.data.survey.colors,data.survey.colors);assert.deepEqual(restored.data.surface,data.surface);assert.ok(file.length<8e6);
});
test('world-file validation rejects unsupported formats, oversized payloads, and bad geometry',async()=>{
 const {decodeWorld,validateLayout,layoutOf}=await import('./world-pack.ts');assert.throws(()=>decodeWorld(new Uint8Array(33*1024*1024)),/too large/);assert.throws(()=>decodeWorld(new TextEncoder().encode('<script>not a world</script>')));const layout=structuredClone(layoutOf(data));layout.buildings[0].tops[0]=Infinity;assert.throws(()=>validateLayout(layout),/invalid/i);
});
test('geographic projection and empty-area generation work beyond Lewiston',async()=>{
 const {generateWorld}=await import('./world.ts');const origin={lat:51.5,lon:-.12};assert.deepEqual(project(origin.lon,origin.lat,origin),{x:0,z:-0});const survey={...data.survey,ground:new Float32Array(361**2),roofs:new Float32Array(720**2).fill(NaN),canopy:new Float32Array(720**2),colors:new Uint8Array(720**2*3),metadata:{...data.survey.metadata,origin,baseElevation:0}};const world=generateWorld({elements:[]},{features:[]},survey);assert.equal(world.buildings.length,0);assert.equal(world.focus,undefined);assert.deepEqual(world.spawn,{x:0,z:0});
});

test('US footprint queries recover from an unavailable tile download and retain the correct data license',async()=>{
 const {microsoftBuildings}=await import('./generation-providers.ts');const {defaults}=await import('./generation-types.ts');const original=globalThis.fetch;const calls=[];globalThis.fetch=async input=>{const url=String(input);calls.push(url);if(url===defaults.buildingIndex)throw new TypeError('Blocked tile request');return new Response(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{OBJECTID:1},geometry:{type:'Polygon',coordinates:[[[-70.187,44.101],[-70.1869,44.101],[-70.1869,44.1011],[-70.187,44.101]]]}}]}),{headers:{'content-type':'application/json'}});};
 try{const result=await microsoftBuildings({lat:44.101,lon:-70.187},defaults,()=>{});assert.equal(result.features.length,1);assert.match(result.source,/ODbL/);const request=new URL(calls[1]);assert.equal(request.searchParams.get('resultRecordCount'),'2000');assert.equal(request.searchParams.get('geometryType'),'esriGeometryEnvelope');assert.equal(request.searchParams.get('outSR'),'4326');}finally{globalThis.fetch=original;}
});
