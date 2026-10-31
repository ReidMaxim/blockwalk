import json,math,pathlib,urllib.request,concurrent.futures,time
cache=pathlib.Path('/tmp/blockwalk-survey/ept');cache.mkdir(exist_ok=True)
base='https://usgs-lidar-public.s3.amazonaws.com/ME_SouthCoastal_1_2020/'
meta=json.load(urllib.request.urlopen(base+'ept.json',timeout=60));(cache.parent/'ept.json').write_text(json.dumps(meta));bounds=meta['bounds']
lat,lon=44.1009685,-70.1876829
x=6378137*math.radians(lon);y=6378137*math.log(math.tan(math.pi/4+math.radians(lat)/2));half=362/math.cos(math.radians(lat));aoi=[x-half,y-half,40,x+half,y+half,145]
def intersects(key):
 d,x,y,z=map(int,key.split('-'));n=2**d
 low=[bounds[i]+(bounds[i+3]-bounds[i])*v/n for i,v in enumerate([x,y,z])]
 high=[bounds[i]+(bounds[i+3]-bounds[i])*(v+1)/n for i,v in enumerate([x,y,z])]
 return d<=11 and all(high[i]>=aoi[i] and low[i]<=aoi[i+3] for i in range(3))
def get(u):
 for n in range(3):
  try:return urllib.request.urlopen(u,timeout=60).read()
  except Exception:
   if n==2:raise
   time.sleep(n+1)
queue=['0-0-0-0'];nodes={}
while queue:
 key=queue.pop();h=json.loads(get(base+'ept-hierarchy/'+key+'.json'))
 for k,count in h.items():
  if not intersects(k):continue
  if count==-1:queue.append(k)
  elif count>0:nodes[k]=count
print('Lidar nodes',len(nodes),'sample points',sum(nodes.values()),flush=True)
(cache/'index.json').write_text(json.dumps({'base':base,'nodes':nodes,'aoi':aoi,'maxDepth':11}))
def download(k):
 path=cache/(k+'.laz')
 if not path.exists():path.write_bytes(get(base+'ept-data/'+k+'.laz'))
 return path.stat().st_size
with concurrent.futures.ThreadPoolExecutor(5) as p:sizes=list(p.map(download,nodes))
print('Lidar downloaded',sum(sizes),'bytes',flush=True)
