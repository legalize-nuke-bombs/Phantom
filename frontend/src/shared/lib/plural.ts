// Russian number formatting + count-agreement helpers — so counts read naturally
// ("1 участник" / "2 участника" / "5 участников"), the way a Telegram-style UI does it,
// instead of a fixed "N участников".

/** Group digits the Russian way: 1234 → "1 234". */
export const ru = (n: number): string => n.toLocaleString('ru-RU');

/**
 * Russian count agreement. `forms` = [one, few, many]:
 *   • one  — 1, 21, 31 … (but NOT the teens 11)
 *   • few  — 2-4, 22-24 … (but NOT 12-14)
 *   • many — 0, 5-20, 25-30 …
 */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** "1 участник" / "2 участника" / "5 участников". */
export function participants(n: number): string {
  return `${ru(n)} ${plural(n, ['участник', 'участника', 'участников'])}`;
}
