export type RecipeLine = {
  stock_item_id: string
  quantity: number
}

export type StockCostInfo = {
  id: string
  name: string
  unit: string
  cost_price: number | null
}

/** Compute the cost of a recipe given the current cost prices of its ingredients. */
export function computeRecipeCost(
  recipe: RecipeLine[],
  stockById: Map<string, StockCostInfo>,
): number {
  return recipe.reduce((total, line) => {
    const item = stockById.get(line.stock_item_id)
    if (!item || item.cost_price == null) return total
    return total + Number(item.cost_price) * line.quantity
  }, 0)
}

export function gpPercent(sellPrice: number, costPrice: number): number {
  if (sellPrice <= 0) return 0
  return ((sellPrice - costPrice) / sellPrice) * 100
}

export const COMMON_ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
]
