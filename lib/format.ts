export function formatCurrency(n: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(n)) return "$0";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard",
  });
  return formatter.format(n);
}

export function formatNumber(n: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(n)) return "0";
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard",
  });
  return formatter.format(n);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

const PLATE_MIN = 2;
const PLATE_MAX = 10;

export function normalizePlate(input: string): string {
  return (input || "")
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidPlate(input: string): boolean {
  const n = normalizePlate(input);
  return n.length >= PLATE_MIN && n.length <= PLATE_MAX;
}

export function normalizeState(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

export function anonymizePlate(plate: string): string {
  const n = normalizePlate(plate);
  if (n.length <= 3) return n.slice(0, 1) + "*".repeat(Math.max(0, n.length - 1));
  return n.slice(0, 3) + "*".repeat(n.length - 3);
}

export function ordinalRank(rank: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  const suffix = s[(v - 20) % 10] || s[v] || s[0];
  return `${formatNumber(rank)}${suffix}`;
}
