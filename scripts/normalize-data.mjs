import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIXED_PRODUCTION_URL,
  HISTORY_DIRECTORY,
  NORMALIZED_DATA_PATH,
  SOURCE_WORKBOOK_PATH,
} from "../src/lib/config.js";
import { parseWorkbook } from "../src/lib/parseWorkbook.js";
import { normalizeWorkbook } from "../src/lib/normalize.js";
import { buildDashboardMetrics } from "../src/lib/metrics.js";
import { buildInsights } from "../src/lib/insights.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function resolveRepoPath(target) {
  return path.resolve(repoRoot, target);
}

function nowShanghai() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date()).replace(" ", "T");
}

function buildPeriod(records) {
  const dates = records.map((item) => item.publishDate).filter(Boolean).sort();
  if (!dates.length) return { start: null, end: null, label: "—" };
  const start = dates[0];
  const end = dates.at(-1);
  return {
    start,
    end,
    label: start === end ? start : `${start} 至 ${end}`,
  };
}

async function ensureWorkbook(sourceArgument) {
  const targetPath = resolveRepoPath(SOURCE_WORKBOOK_PATH);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  if (!sourceArgument) {
    return targetPath;
  }

  const sourcePath = path.resolve(sourceArgument);
  await fs.copyFile(sourcePath, targetPath);
  return targetPath;
}

async function writeJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const workbookArgument = process.argv[2];
const workbookPath = await ensureWorkbook(workbookArgument);
const parsed = parseWorkbook(workbookPath);
const normalized = normalizeWorkbook(parsed);
const dashboard = buildDashboardMetrics(normalized);
const insights = buildInsights(dashboard);
const generatedAt = nowShanghai().replace("T", " ");
const period = buildPeriod(normalized.records);

const payload = {
  meta: {
    sourceFile: path.basename(workbookPath),
    fixedUrl: FIXED_PRODUCTION_URL,
    generatedAt,
    publishPeriod: period,
    sheetNames: parsed.sheetNames,
    accountCount: normalized.accounts.length,
    recordCount: normalized.records.length,
    fieldMappings: normalized.mappingNotes,
    warnings: normalized.warnings,
    matchingPolicy: dashboard.matchingPolicy,
    notes: [
      "趋势图按发布时间聚合，不代表逐日账号监测。",
      "CPM = spend / plays * 1000；CPE = spend / interactions。",
      "当消耗小于等于 0 时，CPM 与 CPE 统一显示为“—”。",
    ],
  },
  normalized,
  dashboard: {
    ...dashboard,
    insights,
  },
};

const normalizedPath = resolveRepoPath(NORMALIZED_DATA_PATH);
await writeJson(normalizedPath, payload);

const timestamp = generatedAt.replace(/[-: ]/g, "").slice(0, 14);
const historyPath = resolveRepoPath(path.join(HISTORY_DIRECTORY, `${timestamp}-${path.basename(workbookPath, path.extname(workbookPath))}.json`));
await writeJson(historyPath, payload);

console.log(JSON.stringify(payload.meta, null, 2));

