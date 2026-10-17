/**
 * Outbound (Secondary) Port for exporting X4 Station Blueprints.
 *
 * @interface IBlueprintExporterPort
 */
export class IBlueprintExporterPort {
  /**
   * Export domain StationPlan to standard X4 XML format.
   * @param {object} plan - StationPlan
   * @returns {string} XML string
   */
  export(plan) {
    throw new Error('Not implemented: IBlueprintExporterPort.export');
  }

  /**
   * Detect DLC extensions required by the plan modules.
   * @param {object[]} modules
   * @returns {string[]} Array of DLC patch tag strings
   */
  detectDlcPatches(modules) {
    throw new Error('Not implemented: IBlueprintExporterPort.detectDlcPatches');
  }
}
