/** `222`, `2.2k`, `33k`, `133.3k`, `1m`, `1.5m`. */
export function formatTokens(n: number): string {
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (n < 1000) return String(Math.round(n));
  if (Math.round(n / 100) < 10_000) return `${trim(n / 1000)}k`;
  return `${trim(n / 1_000_000)}m`;
}

/** One decimal, as in the legend: `0.2%`, `83.4%`. */
export function formatPercent(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%";
}
