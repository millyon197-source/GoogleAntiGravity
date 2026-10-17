/**
 * Outbound (Secondary) Port for parsing X4 Station Blueprints.
 *
 * @interface IBlueprintParserPort
 */
export class IBlueprintParserPort {
  /**
   * Parse raw blueprint string into domain StationPlan.
   * @param {string} raw
   * @returns {object} StationPlan
   */
  parse(raw) {
    throw new Error('Not implemented: IBlueprintParserPort.parse');
  }
}
