/**
 * Adapter XML Layer Public API
 * X4 Station Construction Plan XML Parser & Exporter implementing Hexagonal Outbound Ports.
 */
export { XmlBlueprintParser, parseConstructionPlan, quaternionToEulerYXZ } from './xml-blueprint-parser.js';
export {
  resolveBlueprintXmlPath,
  readBlueprintXml,
  USER_CONSTRUCTION_PLANS_DIR
} from './blueprint-file-resolver.js';
export {
  XmlBlueprintExporter,
  generatePlanXML,
  detectDlcPatches,
  formatXmlString,
  escapeXml,
  setFefbModuleIndex,
  getFefbModuleIndex
} from './xml-blueprint-exporter.js';
