import { requireStockControl } from '@/lib/permissions'

/**
 * Stock control: the owner, managers, and staff with manager access. The route
 * group keeps the /stock/... addresses; /stock/locations (moving stock) stays
 * open to all staff outside it.
 */
export default async function StockControlLayout({ children }: { children: React.ReactNode }) {
  await requireStockControl()
  return children
}
