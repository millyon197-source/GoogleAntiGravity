import fs from 'fs';
import { parseConstructionPlan } from '../../src/parser.js';

const p1 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion.xml";
const p2 = "C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Mega Ship yard with room for expansion2.xml";

const plan1 = parseConstructionPlan(fs.readFileSync(p1, 'utf8'));
const plan2 = parseConstructionPlan(fs.readFileSync(p2, 'utf8'));

console.log('Comparing modules between Plan 1 and Plan 2...');

// Find non-equipment modules in Plan 2
const baseMods2 = plan2.modules.filter(m => !m.macro.startsWith('shield_') && !m.macro.startsWith('turret_'));

// Look at root module of Plan 1 vs Plan 2
console.log('Plan 1 roots:', plan1.modules.filter(m => !m.predecessor).map(m => ({ index: m.index, macro: m.macro, pos: m.position, rot: m.rotation })));
console.log('Plan 2 roots:', baseMods2.filter(m => !m.predecessor).map(m => ({ index: m.index, macro: m.macro, pos: m.position, rot: m.rotation })));
