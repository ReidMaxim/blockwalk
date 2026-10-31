import type {GeoOrigin,BakedLayout} from './world';
import type {Survey} from './survey';
import type {WorldInfo} from './world-pack';
export type LocationChoice={label:string;origin:GeoOrigin;country?:string};
export type Services={geocoder:string;overpass:string;elevation:string;imagery:string;buildingIndex:string;buildingFeatures:string;lidarCatalog:string;lidarBucket:string};
export type GenerationRequest={location:LocationChoice;mode:'best'|'map';services:Services;wasmUrl:string};
export type PreparedWorld={layout:BakedLayout;surface:Uint8Array;survey:Survey;info:WorldInfo};
export const defaults:Services={geocoder:'https://photon.komoot.io/api/',overpass:'https://overpass-api.de/api/interpreter',elevation:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',imagery:'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer',buildingFeatures:'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/MSBFP2/FeatureServer/0',buildingIndex:'https://bfppub.blob.core.windows.net/$web/2026-08-13/dataset-links.csv',lidarCatalog:'https://tnmaccess.nationalmap.gov/api/v1/products',lidarBucket:'https://usgs-lidar-public.s3.amazonaws.com/'};
