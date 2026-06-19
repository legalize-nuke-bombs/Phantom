// Universal time formatting for the app.
// Backend timestamps are epoch SECONDS. This module is the single place that
// decides how dates/times render, so call sites just pick a style.

const MS_PER_SEC = 1000;
const LOCALE = 'ru-RU';

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let formatter = dtfCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, options);
    dtfCache.set(key, formatter);
  }
  return formatter;
}

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_557_600],
  ['month', 2_629_800],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export type TimeStyle =
  | 'date' //      19 июня 2026 г.
  | 'datetime' //  19 июня 2026 г., 04:30
  | 'time' //      04:30
  | 'short' //     19.06.2026
  | 'relative'; // 2 дня назад

/** epoch-seconds → Date */
export function fromEpoch(seconds: number): Date {
  return new Date(seconds * MS_PER_SEC);
}

function formatRelative(date: Date): string {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / MS_PER_SEC);
  if (Math.abs(diffSeconds) < 45) return 'только что';
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= unitSeconds) {
      return relativeFormat.format(Math.round(diffSeconds / unitSeconds), unit);
    }
  }
  return relativeFormat.format(Math.round(diffSeconds / 60), 'minute');
}

/**
 * Format a backend epoch-seconds timestamp.
 * @param seconds epoch seconds (nullable — renders an em dash)
 * @param style   presentation style (default: 'datetime')
 */
export function formatTime(
  seconds: number | null | undefined,
  style: TimeStyle = 'datetime',
): string {
  if (seconds == null) return '—';
  const date = fromEpoch(seconds);

  switch (style) {
    case 'date':
      return dateFormat({ day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    case 'datetime':
      return dateFormat({
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    case 'time':
      return dateFormat({ hour: '2-digit', minute: '2-digit' }).format(date);
    case 'short':
      return dateFormat({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    case 'relative':
      return formatRelative(date);
  }
}
