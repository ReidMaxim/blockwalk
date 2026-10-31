"""Download public USGS survey sources. Large LAZ files stay outside the project."""
import json,math,pathlib,urllib.request,urllib.parse,concurrent.futures
cache=pathlib.Path('/tmp/blockwalk-survey');cache.mkdir(exist_ok=True)
lat,lon=44.1009685,-70.1876829
half=361
bbox=[lon-half/(111320*math.cos(math.radians(lat))),lat-half/111320,lon+half/(111320*math.cos(math.radians(lat))),lat+half/111320]
def download(url,path):
 if path.exists() and path.stat().st_size>1000:return
 print('Fetching',path.name,flush=True)
 with urllib.request.urlopen(url,timeout=180) as response,path.open('wb') as f:
  while b:=response.read(1024*1024):f.write(b)
 print('Saved',path.name,path.stat().st_size,flush=True)
common={'bbox':','.join(map(str,bbox)),'bboxSR':4326,'imageSR':4326,'adjustAspectRatio':'false','f':'image','interpolation':'RSP_BilinearInterpolation'}
dem='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer'
naip='https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer'
jobs=[(dem+'/exportImage?'+urllib.parse.urlencode(dict(common,size='723,723',format='tiff',pixelType='F32',renderingRule=json.dumps({'rasterFunction':'None'}))),cache/'ground.tiff'),(naip+'/exportImage?'+urllib.parse.urlencode(dict(common,size='1444,1444',format='png',renderingRule=json.dumps({'rasterFunction':'NaturalColor'}))),cache/'aerial.png')]
(cache/'sources.json').write_text(json.dumps({'bbox':bbox,'dem':dem,'naip':naip,'lidar':'https://usgs-lidar-public.s3.amazonaws.com/ME_SouthCoastal_1_2020/ept.json','downloads':[(u,p.name) for u,p in jobs]},indent=2))
with concurrent.futures.ThreadPoolExecutor(3) as pool:
 for result in pool.map(lambda j:download(*j),jobs):pass
