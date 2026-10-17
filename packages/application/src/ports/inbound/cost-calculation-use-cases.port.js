/**
 * Inbound (Primary) Port for Station and Module Resource Cost calculations.
 *
 * @interface ICostCalculationUseCases
 */
export class ICostCalculationUseCases {
  /**
   * Aggregate total resources required to build all modules in a station plan.
   * @param {object} plan - StationPlan entity or DTO
   * @returns {Record<string, number>} Map of resource name to required quantity
   */
  calculateStationCost(plan) {
    throw new Error('Not implemented: ICostCalculationUseCases.calculateStationCost');
  }

  /**
   * Get resource costs for a specific module macro.
   * @param {string} macro
   * @returns {Record<string, number>}
   */
  getModuleCost(macro) {
    throw new Error('Not implemented: ICostCalculationUseCases.getModuleCost');
  }
}
