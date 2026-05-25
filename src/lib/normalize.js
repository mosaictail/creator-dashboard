import { COST_RULES, EMBED_STRENGTH_ORDER, PLATFORM_RULES } from "./config.js";

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/￥/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!normalized) return null;

  const multiplier = normalized.includes("万") ? 10000 : normalized.includes("亿") ? 100000000 : 1;
  const numeric = Number.parseFloat(normalized.replace(/[万亿%]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (normalized.includes("%")) return numeric / 100;
  return numeric * multiplier;
}

function roundMetric(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatIsoParts(year, month, day, hour = 0, minute = 0, second = 0) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return `${year}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
}

function excelSerialToIso(value) {
  const serial = toNumber(value);
  if (serial == null) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + serial * 86400000);
  return formatIsoParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}

function stringDateToIso(value) {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return text;
  return formatIsoParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0),
  );
}

function normalizeDate(value, platform) {
  return PLATFORM_RULES[platform].parseDateMode === "excel-serial"
    ? excelSerialToIso(value)
    : stringDateToIso(value);
}

function isoDateKey(value) {
  return cleanText(value)?.slice(0, 10) ?? null;
}

function safeDivide(numerator, denominator, multiplier = 1) {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return roundMetric((numerator / denominator) * multiplier, 6);
}

function computeCostMetric(spend, denominator, multiplier) {
  if (COST_RULES.spendMustBePositive && !(spend > 0)) return null;
  return safeDivide(spend, denominator, multiplier);
}

function isSummaryRow(title, rowValues, platform) {
  const summaryKeywords = PLATFORM_RULES[platform].summaryKeywords;
  if (summaryKeywords.includes(cleanText(title) ?? "")) return true;
  return rowValues.some((cell) => summaryKeywords.includes(cleanText(cell) ?? ""));
}

function compareOptionalRates(first, second) {
  if (first == null || second == null) return null;
  return Math.abs(first - second) <= 0.000001;
}

function normalizeRecord({
  platform,
  account,
  mapping,
  row,
  rowIndex,
  warnings,
}) {
  const getCell = (field) => (mapping[field] >= 0 ? row[mapping[field]] : null);
  const title = cleanText(getCell("title"));
  if (!title) return null;
  if (isSummaryRow(title, row, platform)) return null;

  const plays = toNumber(getCell("plays"));
  const likes = toNumber(getCell("likes"));
  const comments = toNumber(getCell("comments"));
  const shares = toNumber(getCell("shares"));
  const favorites = toNumber(getCell("favorites"));
  const spend = toNumber(getCell("spend"));
  const completeRate = toNumber(getCell("completeRate"));
  const record = {
    id: `${platform}-${rowIndex + 1}`,
    platform,
    accountName: account.accountName,
    accountLikes: toNumber(account.accountLikes),
    accountFollowers: toNumber(account.accountFollowers),
    embedStrength: cleanText(getCell("embedStrength")),
    title,
    publishAt: normalizeDate(getCell("publishAt"), platform),
    publishDate: isoDateKey(normalizeDate(getCell("publishAt"), platform)),
    genre: cleanText(getCell("genre")),
    reviewStatus: cleanText(getCell("reviewStatus")),
    plays,
    completeRate,
    completeRate5s: toNumber(getCell("completeRate5s")),
    bounceRate2s: toNumber(getCell("bounceRate2s")),
    avgWatchTime: toNumber(getCell("avgWatchTime")),
    likes,
    comments,
    shares,
    favorites,
    profileVisits: toNumber(getCell("profileVisits")),
    followerGain: toNumber(getCell("followerGain")),
    spend,
    sourceCpm: toNumber(getCell("sourceCpm")),
    sourceCpe: toNumber(getCell("sourceCpe")),
    sourceSheet: platform,
    sourceRow: rowIndex + 1,
  };

  const interactionFields = PLATFORM_RULES[platform].interactionFields;
  const interactionTotal = interactionFields.reduce((sum, field) => {
    const current = record[field];
    return current == null ? sum : sum + current;
  }, 0);
  record.computedInteractions = interactionTotal;
  record.computedCpm = computeCostMetric(spend, plays, COST_RULES.cpm.multiplier);
  record.computedCpe = computeCostMetric(spend, interactionTotal, COST_RULES.cpe.multiplier);

  if (platform === "快手") {
    const duplicateRate = toNumber(row.find((cell, index) => index !== mapping.completeRate && String(cell ?? "") !== ""));
    if (duplicateRate != null && !compareOptionalRates(duplicateRate, completeRate)) {
      warnings.push(`快手第 ${rowIndex + 1} 行存在双“完播率”差异，已保留后列为规范值。`);
    }
  }

  return record;
}

function compareEmbedStrength(a, b) {
  return EMBED_STRENGTH_ORDER.indexOf(a) - EMBED_STRENGTH_ORDER.indexOf(b);
}

export function normalizeWorkbook(parsedWorkbook) {
  const warnings = [];
  const mappingNotes = [];
  const accounts = [];
  const records = [];

  for (const sheet of parsedWorkbook.sheets) {
    if (sheet.headerRowIndex < 0) {
      warnings.push(`${sheet.sheetName} 未找到有效表头，已跳过。`);
      continue;
    }

    accounts.push({
      platform: sheet.platform,
      accountName: cleanText(sheet.account.accountName) ?? sheet.platform,
      accountLikes: toNumber(sheet.account.accountLikes),
      accountFollowers: toNumber(sheet.account.accountFollowers),
    });

    mappingNotes.push(...sheet.mappingNotes);

    for (let rowIndex = sheet.headerRowIndex + 1; rowIndex < sheet.rows.length; rowIndex += 1) {
      const row = sheet.rows[rowIndex];
      if (!row?.some((cell) => cell != null && String(cell).trim() !== "")) continue;
      const record = normalizeRecord({
        platform: sheet.platform,
        account: sheet.account,
        mapping: sheet.mapping,
        row,
        rowIndex,
        warnings,
      });
      if (record) records.push(record);
    }
  }

  records.sort((left, right) => String(right.publishAt ?? "").localeCompare(String(left.publishAt ?? "")));
  accounts.sort((left, right) => left.platform.localeCompare(right.platform, "zh-CN"));
  records.sort((left, right) => {
    const timeCompare = String(right.publishAt ?? "").localeCompare(String(left.publishAt ?? ""));
    if (timeCompare !== 0) return timeCompare;
    return compareEmbedStrength(left.embedStrength ?? "", right.embedStrength ?? "");
  });

  return {
    accounts,
    records,
    warnings: [...new Set(warnings)],
    mappingNotes: [...new Set(mappingNotes)],
  };
}

