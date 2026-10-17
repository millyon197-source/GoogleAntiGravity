import {
  XmlBlueprintParser,
  XmlBlueprintExporter,
  parseConstructionPlan,
  generatePlanXML,
  detectDlcPatches,
  formatXmlString,
  escapeXml
} from '@x4/adapter-xml';

import {
  parseConstructionPlan as facadeParseConstructionPlan
} from '../src/parser.js';

import {
  generatePlanXML as facadeGeneratePlanXML,
  detectDlcPatches as facadeDetectDlcPatches
} from '../src/blueprint-exporter.js';

import { StationPlan, StationModule, Vector3D, EulerRotation } from '@x4/domain';
import { IBlueprintParserPort, IBlueprintExporterPort } from '@x4/application';

console.log('[*] Testing Hexagonal XML Adapter (@x4/adapter-xml)...');

let allPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    allPassed = false;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Port Interface Compliance
console.log('\n--- Test Group 1: Port Implementation Compliance ---');
const parser = new XmlBlueprintParser();
const exporter = new XmlBlueprintExporter();

assert(parser instanceof IBlueprintParserPort, 'XmlBlueprintParser implements IBlueprintParserPort');
assert(exporter instanceof IBlueprintExporterPort, 'XmlBlueprintExporter implements IBlueprintExporterPort');

// 2. XML Parsing (DOM & Fallback)
console.log('\n--- Test Group 2: XML Parsing ---');
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="test_station_alpha" name="Paranid Mega Hub" description="Testing Hexagonal XML">
    <patches>
      <patch extension="ego_dlc_terran" version="900" name="Cradle of Humanity"/>
    </patches>
    <entry index="1" macro="dock_ter_m_01_macro" connection="connectionsnap001">
      <offset>
        <position x="100.5" y="-50.25" z="300"/>
        <rotation yaw="90" pitch="0" roll="180"/>
      </offset>
    </entry>
    <entry index="2" macro="prod_gen_energycells_macro">
      <offset>
        <position x="0" y="0" z="0"/>
        <rotation yaw="0" pitch="45" roll="0"/>
      </offset>
    </entry>
  </plan>
</plans>`;

const parsedDto = parseConstructionPlan(sampleXml);
assert(parsedDto.id === 'test_station_alpha', 'Parsed plan id correctly');
assert(parsedDto.name === 'Paranid Mega Hub', 'Parsed plan name correctly');
assert(parsedDto.modules.length === 2, 'Parsed 2 modules');
assert(parsedDto.modules[0].macro === 'dock_ter_m_01_macro', 'Parsed entry 1 macro');
assert(parsedDto.modules[0].position.x === 100.5, 'Parsed entry 1 position X');
assert(parsedDto.modules[0].rotation.yaw === 90, 'Parsed entry 1 rotation yaw');

// Test Domain Entity parsing via Adapter
const planEntity = parser.parse(sampleXml);
assert(planEntity instanceof StationPlan, 'parser.parse returns StationPlan domain entity');
assert(planEntity.moduleCount === 2, 'StationPlan has 2 modules');
assert(planEntity.modules[0].macro === 'dock_ter_m_01_macro', 'First module is correct entity');
assert(planEntity.modules[0].position instanceof Vector3D, 'Module position is Vector3D value object');
assert(planEntity.modules[0].rotation instanceof EulerRotation, 'Module rotation is EulerRotation value object');

// 3. DLC Detection
console.log('\n--- Test Group 3: DLC Detection ---');
const patches = detectDlcPatches([
  { macro: 'dock_ter_m_01' },
  { macro: 'dock_spl_s_01' },
  { macro: 'dock_bor_l_01' },
  { macro: 'dock_pir_m_01' },
  { macro: 'module_timelines_01' }
]);
assert(patches.length === 5, 'Detected all 5 DLC patches');
assert(patches.some(p => p.includes('ego_dlc_terran')), 'Detected Terran DLC');
assert(patches.some(p => p.includes('ego_dlc_split')), 'Detected Split DLC');
assert(patches.some(p => p.includes('ego_dlc_boron')), 'Detected Boron DLC');
assert(patches.some(p => p.includes('ego_dlc_pirate')), 'Detected Pirate DLC');
assert(patches.some(p => p.includes('ego_dlc_timelines')), 'Detected Timelines DLC');

// 4. XML Exporting & FEFB Predecessor Anchor
console.log('\n--- Test Group 4: XML Exporting & FEFB Predecessor Anchor ---');
const exportedXml = exporter.export(planEntity, {
  name: 'Exported Test Plan',
  fefbModuleIndex: 1
});
assert(typeof exportedXml === 'string', 'Exporter produces string output');
assert(exportedXml.includes('name="Exported Test Plan"'), 'Exported XML includes plan name');
assert(exportedXml.includes('ego_dlc_terran'), 'Exported XML includes detected DLC patch');
assert(exportedXml.includes('predecessor index="1"'), 'Non-FEFB module contains predecessor reference to FEFB');

// 5. Facade Forwarding
console.log('\n--- Test Group 5: Backward-Compatible Facades ---');
const facadeParsed = facadeParseConstructionPlan(sampleXml);
assert(facadeParsed.id === parsedDto.id, 'src/parser.js facade produces identical output');

const facadeExported = facadeGeneratePlanXML('Facade Plan', planEntity);
assert(facadeExported.includes('name="Facade Plan"'), 'src/blueprint-exporter.js facade forwards correctly');

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n[PASS] All Adapter XML tests completed successfully!');
}
