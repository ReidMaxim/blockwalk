/** Decodes LAS records through laz-perf; coordinates are taken from each file's header. */
export function decodeLaz(module:any,input:Uint8Array,emit:(x:number,y:number,z:number,classification:number)=>void){
 const header=new DataView(input.buffer,input.byteOffset,input.byteLength);if(input.length<227||String.fromCharCode(...input.subarray(0,4))!=='LASF')throw new Error('Invalid lidar tile');
 const scale=[131,139,147].map(o=>header.getFloat64(o,true)),offset=[155,163,171].map(o=>header.getFloat64(o,true));
 const file=module._malloc(input.length);module.HEAPU8.set(input,file);const reader=new module.LASZip();let point=0;
 try{reader.open(file,input.length);const length=reader.getPointLength(),format=reader.getPointFormat(),count=reader.getCount();if(count>2500000||length<20||length>1024)throw new Error('Lidar tile exceeds the supported budget');point=module._malloc(length);
  for(let i=0;i<count;i++){reader.getPoint(point);const v=new DataView(module.HEAPU8.buffer,point,length);const classification=format>=6?v.getUint8(16):v.getUint8(15)&31;if(classification===7||classification===18)continue;emit(v.getInt32(0,true)*scale[0]+offset[0],v.getInt32(4,true)*scale[1]+offset[1],v.getInt32(8,true)*scale[2]+offset[2],classification);}return count;
 }finally{reader.delete();if(point)module._free(point);module._free(file);}
}
