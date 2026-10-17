import { ICostCalculationUseCases } from '../ports/inbound/cost-calculation-use-cases.port.js';

/**
 * Pure Application Service for station and module construction cost calculations.
 * Implements ICostCalculationUseCases.
 */
export class CostCalculator extends ICostCalculationUseCases {
  /**
   * @param {(macro: string) => Record<string, number>} estimateCostsFn
   */
  constructor(estimateCostsFn) {
    super();
    this.estimateCosts = typeof estimateCostsFn === 'function' ? estimateCostsFn : () => ({});
  }

  /**
   * Aggregate total resources required to build all modules in a station plan.
   * @param {object} plan - StationPlan entity or DTO with modules array
   * @returns {Record<string, number>} Map of resource name to required quantity
   */
  calculateStationCost(plan) {
    const totalResources = {};
    if (!plan) return totalResources;

    const modules = typeof plan.getModules === 'function' ? plan.getModules() : (plan.modules || []);
    for (const mod of modules) {
      const macro = mod.macro || '';
      const costs = this.getModuleCost(macro);
      for (const [resource, amount] of Object.entries(costs)) {
        if (amount > 0) {
          totalResources[resource] = (totalResources[resource] || 0) + amount;
        }
      }
    }

    return totalResources;
  }

  /**
   * Get resource costs for a specific module macro.
   * @param {string} macro
   * @returns {Record<string, number>}
   */
  getModuleCost(macro) {
    if (!macro) return {};
    return this.estimateCosts(macro) || {};
  }
}
