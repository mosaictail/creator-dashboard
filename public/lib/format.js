export function hasNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatCompactNumber(value, digits = 2) {
  if (!hasNumber(value)) return "—";
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(digits)}亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(digits)}万`;
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value);
}

export function formatExactNumber(value, digits = 0) {
  if (!hasNumber(value)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value, digits = 1) {
  if (!hasNumber(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCurrency(value, digits = 0) {
  if (!hasNumber(value) || value <= 0) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMetricWithUnit(value, kind) {
  if (kind === "currency") return formatCurrency(value, 0);
  if (kind === "percent") return formatPercent(value, 1);
  return formatCompactNumber(value, 2);
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

