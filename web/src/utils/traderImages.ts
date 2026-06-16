import traderImages from '../data/trader-images.json';
import type { Trader } from '../types';

const images = traderImages as Record<string, string>;

export function getTraderImagePath(trader: Pick<Trader, 'id' | 'normalizedName'>): string | null {
  return images[trader.normalizedName] ?? images[trader.id] ?? null;
}
