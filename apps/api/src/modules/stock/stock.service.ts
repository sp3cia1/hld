import type { Catalog } from '../catalog/catalog.logic';
import { getCatalog } from '../catalog/catalog.loader';
import { withBookedStock } from './stock.logic';
import { loadBookedStock } from './stock.repository';

/**
 * The catalog as confirmed reservations have left it (S2): seats and rooms already booked are gone. Building a
 * package, its change choices, a change and the rules panel all use it, so none of them offers what can't be booked.
 */
export async function getBookedCatalog(): Promise<Catalog> {
  const { seatsLeft, roomsLeft } = await loadBookedStock();
  return withBookedStock(getCatalog(), seatsLeft, roomsLeft);
}
