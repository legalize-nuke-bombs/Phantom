// Crypto rail naming. Toncoin rebranded to "Gram" (ticker GRAM) on 2026-06-15.
// The chain itself stays The Open Network (TON), and the backend CoinType enum
// stays TON — ONLY the user-facing display changes. Everywhere we show the coin
// to a user, go through these helpers so a future rebrand is a one-line edit.
//
// (Internal balances remain USD — see shared/lib/money.ts. This is purely about
// labelling the deposit/withdrawal coin.)

/** Backend CoinType enum. Only TON exists today; kept as a union for extensibility. */
export type CoinType = 'TON';

interface CoinInfo {
  /** Human display name. */
  name: string;
  /** Short ticker symbol. */
  ticker: string;
}

export const COINS: Record<CoinType, CoinInfo> = {
  TON: { name: 'Gram', ticker: 'GRAM' },
};

/** Display name for a coin, e.g. "Gram". Defaults to the only coin, TON. */
export function coinName(coin: CoinType = 'TON'): string {
  return COINS[coin].name;
}

/** Ticker for a coin, e.g. "GRAM". Defaults to the only coin, TON. */
export function coinTicker(coin: CoinType = 'TON'): string {
  return COINS[coin].ticker;
}
