import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadTestWorld} from '../src/test-data.mjs';
const root=new URL('../public/data/',import.meta.url);const sourceFiles=['neighborhood.json','buildings.json','survey/ground.bin','survey/roofs.bin','survey/colors.bin'];const hash=crypto.createHash('sha256');for(const p of sourceFiles)hash.update(fs.readFileSync(new URL(p,root)));
const data=loadTestWorld();const layout={version:3,width:720,sourceHash:hash.digest('hex'),roads:data.roads,buildings:data.buildings,spawn:data.spawn,focusId:data.focus?.id??null,sourceCount:data.sourceCount};
fs.writeFileSync(new URL('world-layout.json',root),JSON.stringify(layout));fs.writeFileSync(new URL('world-surface.bin',root),data.surface);console.log(`Prepared ${data.buildings.length} buildings; browsers load the fitted world directly.`);
