import XLSX from "xlsx";
import { CANONICAL_FIELD_LABELS, PLATFORM_RULES } from "./config.js";

const HEADER_MATCH_KEYS = ["标题", "作品名称", "作品", "发布时间", "播放量", "完播率"];

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[:：]/g, "")
    .trim();
}

function toMatrix(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
}

function detectPlatform(sheetName) {
  return Object.keys(PLATFORM_RULES).find((platform) => sheetName.includes(platform)) ?? sheetName;
}

function findHeaderRow(rows, platform) {
  const rule = PLATFORM_RULES[platform];
  for (let index = 0; index < rows.length; index += 1) {
    const labels = rows[index].map(cleanLabel).filter(Boolean);
    const hitCount = HEADER_MATCH_KEYS.filter((key) => labels.includes(key)).length;
    const hasTitle = rule.titleFieldHints.some((hint) => labels.includes(cleanLabel(hint)));
    if (hasTitle && hitCount >= 3) {
      return index;
    }
  }
  return -1;
}

function extractAccountInfo(rows) {
  const info = {
    accountName: null,
    accountLikes: null,
    accountFollowers: null,
  };

  for (const row of rows.slice(0, 6)) {
    for (let index = 0; index < row.length; index += 1) {
      const label = cleanLabel(row[index]);
      const value = row[index + 1];
      if (label === "昵称" && value != null) info.accountName = String(value).trim();
      if (label === "获赞" && value != null) info.accountLikes = value;
      if (label === "粉丝" && value != null) info.accountFollowers = value;
    }
  }

  return info;
}

function buildHeaderIndex(headers) {
  return headers.reduce((accumulator, header, index) => {
    const key = cleanLabel(header) || `__empty_${index}`;
    if (!accumulator.has(key)) accumulator.set(key, []);
    accumulator.get(key).push(index);
    return accumulator;
  }, new Map());
}

function chooseColumnIndex(headerIndex, field, platform) {
  const rule = PLATFORM_RULES[platform];
  const labels = rule.fieldLabels[field] ?? [];
  const preferredMode = rule.canonicalDuplicateHeaders?.[field] ?? "first";

  for (const label of labels) {
    const indices = headerIndex.get(cleanLabel(label));
    if (!indices?.length) continue;
    return preferredMode === "last" ? indices.at(-1) : indices[0];
  }

  return -1;
}

function buildColumnMap(headers, platform) {
  const headerIndex = buildHeaderIndex(headers);
  const mapping = {};
  const mappingNotes = [];

  for (const field of Object.keys(PLATFORM_RULES[platform].fieldLabels)) {
    const columnIndex = chooseColumnIndex(headerIndex, field, platform);
    if (columnIndex >= 0) {
      mapping[field] = columnIndex;
      const header = headers[columnIndex];
      if (String(header) !== field) {
        mappingNotes.push(`${platform}：${header} -> ${CANONICAL_FIELD_LABELS[field] ?? field}`);
      }
    }
  }

  const duplicateCompleteRateColumns = headerIndex.get("完播率");
  if (platform === "快手" && duplicateCompleteRateColumns?.length > 1) {
    mappingNotes.push("快手：检测到重复“完播率”列，已将后一个“完播率”作为规范字段。");
  }

  return { mapping, mappingNotes };
}

export function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, {
    dense: true,
    raw: true,
    cellDates: false,
  });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const platform = detectPlatform(sheetName);
    const rows = toMatrix(workbook.Sheets[sheetName]);
    const headerRowIndex = findHeaderRow(rows, platform);
    const headers = headerRowIndex >= 0 ? rows[headerRowIndex] : [];
    const account = extractAccountInfo(rows);
    const { mapping, mappingNotes } = buildColumnMap(headers, platform);

    return {
      platform,
      sheetName,
      rows,
      headerRowIndex,
      headers,
      mapping,
      mappingNotes,
      account,
    };
  });

  return {
    workbookName: filePath.split("/").at(-1),
    sheetNames: workbook.SheetNames,
    sheets,
  };
}
