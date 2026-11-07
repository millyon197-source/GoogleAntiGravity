import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';
import { SNAP_POINTS_DB } from '../../src/snap-points-db.js';

const xmlPath = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const xmlContent = fs.readFileSync(xmlPath, 'utf8');
const plan = parseConstructionPlan(xmlContent);

const modMap = new Map();
plan.modules.forEach(m => modMap.set(m.index, m));

const m6 = modMap.get(6);
const m7 = modMap.get(7);

console.log('M6:', m6);
console.log('M7:', m7);

console.log('M6 snaps:', SNAP_POINTS_DB['struct_arg_cross_01_macro']);
console.log('M7 snaps:', SNAP_POINTS_DB['hab_arg_l_01_macro']);
