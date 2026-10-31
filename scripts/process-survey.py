"""Build compact, aligned rasters from public survey sources. Run after fetch scripts."""
import json,math,pathlib,collections
import numpy as np,tifffile,laspy
from PIL import Image
from pyproj import Transformer
from scipy.ndimage import map_coordinates,median_filter,maximum_filter,gaussian_filter
cache=pathlib.Path('/tmp/blockwalk-survey');out=pathlib.Path('public/data/survey');out.mkdir(parents=True,exist_ok=True)
lat,lon=44.1009685,-70.1876829;N=720;half=360
# DEM source export has pixel centers evenly covering [-361,361].
dem=tifffile.imread(cache/'ground.tiff').astype(np.float32)
coords=(np.arange(361)*2+1)*723/722-.5 # grid vertices -360..360
zz,xx=np.meshgrid(coords,coords,indexing='ij');ground=map_coordinates(dem,[zz,xx],order=1)
base=float(ground[180,180]);ground=np.round(ground-base,3);ground.astype('<f4').tofile(out/'ground.bin')
# The source cutout covers 722 metres; take its central 720m and average .5m pixels to 1m.
image=Image.open(cache/'aerial.png').convert('RGB');image.crop((2,2,1442,1442)).resize((720,720),Image.Resampling.BOX).save(out/'aerial.jpg',quality=94)
colors=np.asarray(Image.open(out/'aerial.jpg')).astype(np.uint8);colors.tofile(out/'colors.bin')
roof=np.full((N,N),-9999,dtype=np.float32);canopy=np.zeros((N,N),dtype=np.float32);count=np.zeros((N,N),dtype=np.uint16)
trans=Transformer.from_crs(3857,4326,always_xy=True);classes=collections.Counter();selected=0
files=list((cache/'ept').glob('*.laz'))
for file in files:
 las=laspy.read(file);lons,lats=trans.transform(np.asarray(las.x),np.asarray(las.y));xs=(lons-lon)*111320*math.cos(math.radians(lat));zs=-(lats-lat)*111320
 ix=np.floor(xs+half).astype(int);iz=np.floor(zs+half).astype(int);elev=np.asarray(las.z)-base;cl=np.asarray(las.classification)
 valid=(ix>=0)&(ix<N)&(iz>=0)&(iz<N)&(elev>-20)&(elev<70)&(~np.isin(cl,[7,18]))
 ix,iz,elev,cl=ix[valid],iz[valid],elev[valid],cl[valid];selected+=len(ix);classes.update(cl.tolist())
 if not len(ix):continue
 terrain=map_coordinates(ground,[(iz+.5)/2,(ix+.5)/2],order=1);above=elev-terrain
 nonground=(above>1.5)&(cl!=2)
 # Classified buildings or unclassified high returns can describe roofs. Vegetation classes are excluded.
 r=nonground&(~np.isin(cl,[3,4,5]))
 np.maximum.at(roof,(iz[r],ix[r]),elev[r]);np.add.at(count,(iz[r],ix[r]),1)
 veg=nonground&(above>3)&(~np.isin(cl,[6,9,17]))
 np.maximum.at(canopy,(iz[veg],ix[veg]),above[veg])
roof[roof<-100]=np.nan
roof.astype('<f4').tofile(out/'roofs.bin');canopy.astype('<f4').tofile(out/'canopy.bin')
meta={'origin':{'lat':lat,'lon':lon},'widthMeters':720,'baseElevation':round(base,3),'groundSize':361,'groundStep':2,'surfaceSize':720,'surfaceStep':1,'elevationRange':[round(float(ground.min()+base),2),round(float(ground.max()+base),2)],'lidarPoints':selected,'lidarClasses':dict(classes),'lidarYear':2020,'lidarProject':'ME_SouthCoastal_1_2020','lidarDepth':11,'sources':{'ground':'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer','aerial':'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer','lidar':'https://usgs-lidar-public.s3.amazonaws.com/ME_SouthCoastal_1_2020/ept.json'},'notes':'Public-domain USGS/USDA data. Heights metres NAVD88 minus local ground origin. Lidar sampled to depth 11, about 0.6m horizontal sample spacing. Aerial imagery and lidar have different collection dates.'}
(out/'metadata.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2));print('roof raster coverage',np.count_nonzero(np.isfinite(roof)))
