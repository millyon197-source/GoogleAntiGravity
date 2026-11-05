import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

const m1 = plan.modules.find(m => m.index === 1);
const m2 = plan.modules.find(m => m.index === 2);
const m3 = plan.modules.find(m => m.index === 3);

console.log('M1:', m1);
console.log('M2:', m2);
console.log('M3:', m3);

console.log('M1 snaps:', SNAP_POINTS_DB['defence_arg_claim_01']);
console.log('M2 snaps:', SNAP_POINTS_DB['dockarea_arg_m_station_02_hightech']);
