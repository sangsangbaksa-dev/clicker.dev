/**
 * Presentation helpers for clicker UI. Re-exports domain format/view utilities so
 * components depend on the application layer instead of domain services directly.
 */
export { formatNumber } from "@/domain/services/clicker-format"
export {
  bulkAffordable,
  bulkCostText,
  type CurrencyCostView,
  type SkillNodeView,
} from "@/domain/services/clicker-view"
