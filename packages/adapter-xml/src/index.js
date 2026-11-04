/**
 * Adapter XML Layer Public API
 * X4 Station Construction Plan XML Parser & Exporter implementing Hexagonal Outbound Ports.
 */
export { XmlBlueprintParser, parseConstructionPlan, quaternionToEulerYXZ } from './xml-blueprint-parser.js';
export {
  XmlBlueprintExporter,
  generatePlanXML,
  detectDlcPatches,
  formatXmlString,
  escapeXml,
  setFefbModuleIndex,
  getFefbModuleIndex
} from './xml-blueprint-exporter.js';
