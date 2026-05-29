import { COST_RULES, EMBED_STRENGTH_ORDER, MATCHING_POLICY, PLATFORM_RULES } from "./config.js";

function sum(records, field) {
  return records.reduce((total, item) => total + (Number.isFinite(item[field]) ? item[field] : 0), 0);
}

function average(records, field) {
  const valid = records.map((item) => item[field]).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function safeDivide(numerator, denominator, multiplier = 1) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * multiplier;
}

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function byPlatform(records, platform) {
  return records.filter((record) => record.platform === platform);
}

function computeCostMetrics(spend, plays, interactions) {
  const computedCpm = spend > 0 ? safeDivide(spend, plays, COST_RULES.cpm.multiplier) : null;
  const computedCpe = spend > 0 ? safeDivide(spend, interactions, COST_RULES.cpe.multiplier) : null;
  return {
    computedCpm: round(computedCpm, 6),
    computedCpe: round(computedCpe, 6),
  };
}

function summarizePlatform(records, accounts, platform) {
  const platformRecords = byPlatform(records, platform);
  const account = accounts.find((item) => item.platform === platform) ?? null;
  const plays = sum(platformRecords, "plays");
  const interactions = sum(platformRecords, "computedInteractions");
  const followerGain = sum(platformRecords, "followerGain");
  const spend = sum(platformRecords, "spend");
  const publishCount = platformRecords.length;
  const { computedCpm, computedCpe } = computeCostMetrics(spend, plays, interactions);

  return {
    platform,
    accountName: account?.accountName ?? platform,
    accountFollowers: account?.accountFollowers ?? null,
    accountLikes: account?.accountLikes ?? null,
    publishCount,
    totalPlays: plays,
    avgPlays: publishCount ? plays / publishCount : null,
    totalInteractions: interactions,
    interactionRate: safeDivide(interactions, plays, 1),
    followerGain,
    totalSpend: spend,
    avgSpend: publishCount ? spend / publishCount : null,
    cpm: computedCpm,
    cpe: computedCpe,
    interactionFormula: PLATFORM_RULES[platform].interactionFields
      .map((field) => ({
        likes: "点赞",
        comments: "评论",
        shares: "分享",
        favorites: "收藏",
      }[field]))
      .join(" + "),
  };
}

function groupByDate(records) {
  return records.reduce((accumulator, record) => {
    const key = record.publishDate;
    if (!key) return accumulator;
    if (!accumulator.has(key)) accumulator.set(key, []);
    accumulator.get(key).push(record);
    return accumulator;
  }, new Map());
}

function buildTrendRows(records) {
  const grouped = groupByDate(records);
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => {
      const plays = sum(items, "plays");
      const interactions = sum(items, "computedInteractions");
      const followerGain = sum(items, "followerGain");
      const spend = sum(items, "spend");
      const { computedCpm, computedCpe } = computeCostMetrics(spend, plays, interactions);
      return {
        date,
        publishCount: items.length,
        plays,
        interactions,
        followerGain,
        spend,
        cpm: computedCpm,
        cpe: computedCpe,
      };
    });
}

function rankingItems(records, field, direction = "desc", limit = 5, predicate = () => true) {
  return records
    .filter(predicate)
    .slice()
    .sort((left, right) => {
      const lv = Number.isFinite(left[field]) ? left[field] : direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const rv = Number.isFinite(right[field]) ? right[field] : direction === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return direction === "asc" ? lv - rv : rv - lv;
    })
    .slice(0, limit)
    .map((record) => ({
      id: record.id,
      platform: record.platform,
      title: record.title,
      publishAt: record.publishAt,
      embedStrength: record.embedStrength,
      plays: record.plays,
      interactions: record.computedInteractions,
      followerGain: record.followerGain,
      spend: record.spend,
      cpm: record.computedCpm,
      cpe: record.computedCpe,
      value: record[field],
    }));
}

function buildEmbedAnalysis(records) {
  return EMBED_STRENGTH_ORDER.map((embedStrength) => {
    const items = records.filter((record) => record.embedStrength === embedStrength);
    if (!items.length) {
      return {
        embedStrength,
        videoCount: 0,
        avgPlays: null,
        avgInteractions: null,
        avgFollowerGain: null,
        avgSpend: null,
        avgCpm: null,
        avgCpe: null,
      };
    }

    const validCpm = items.map((item) => item.computedCpm).filter(Number.isFinite);
    const validCpe = items.map((item) => item.computedCpe).filter(Number.isFinite);

    return {
      embedStrength,
      videoCount: items.length,
      avgPlays: average(items, "plays"),
      avgInteractions: average(items, "computedInteractions"),
      avgFollowerGain: average(items, "followerGain"),
      avgSpend: average(items, "spend"),
      avgCpm: validCpm.length ? average(items.filter((item) => Number.isFinite(item.computedCpm)), "computedCpm") : null,
      avgCpe: validCpe.length ? average(items.filter((item) => Number.isFinite(item.computedCpe)), "computedCpe") : null,
    };
  });
}

function buildContentTable(records) {
  return records.map((record) => ({
    id: record.id,
    platform: record.platform,
    publishAt: record.publishAt,
    title: record.title,
    embedStrength: record.embedStrength,
    plays: record.plays,
    interactions: record.computedInteractions,
    followerGain: record.followerGain,
    spend: record.spend,
    cpm: record.computedCpm,
    cpe: record.computedCpe,
  }));
}

function groupContentByPlatform(records) {
  return ["抖音", "快手"].map((platform) => ({
    platform,
    rows: buildContentTable(records.filter((record) => record.platform === platform)),
  }));
}

function buildRankingsByPlatform(records) {
  return Object.fromEntries(["抖音", "快手"].map((platform) => {
    const platformRecords = records.filter((record) => record.platform === platform);
    return [platform, {
      plays: rankingItems(platformRecords, "plays"),
      interactions: rankingItems(platformRecords, "computedInteractions"),
      lowCpm: rankingItems(
        platformRecords,
        "computedCpm",
        "asc",
        5,
        (record) => record.spend > 0 && record.plays > 0 && Number.isFinite(record.computedCpm),
      ),
      lowCpe: rankingItems(
        platformRecords,
        "computedCpe",
        "asc",
        5,
        (record) => record.spend > 0 && record.computedInteractions > 0 && Number.isFinite(record.computedCpe),
      ),
    }];
  }));
}

function publishCountSummary(platformSummaries) {
  return platformSummaries.map((item) => `${item.platform} ${item.publishCount} 条`).join(" / ");
}

export function buildDashboardMetrics(normalized) {
  const platformSummaries = ["抖音", "快手"].map((platform) => summarizePlatform(normalized.records, normalized.accounts, platform));
  const totalFollowers = normalized.accounts.reduce((total, account) => total + (Number.isFinite(account.accountFollowers) ? account.accountFollowers : 0), 0);
  const totalPlays = sum(normalized.records, "plays");
  const totalInteractions = sum(normalized.records, "computedInteractions");
  const totalFollowerGain = sum(normalized.records, "followerGain");
  const totalSpend = sum(normalized.records, "spend");
  const publishCount = normalized.records.length;
  const { computedCpm, computedCpe } = computeCostMetrics(totalSpend, totalPlays, totalInteractions);

  return {
    overview: {
      totalPlays,
      totalInteractions,
      totalFollowers,
      totalFollowerGain,
      totalSpend,
      publishCount,
      publishCountLabel: publishCountSummary(platformSummaries),
      cpm: computedCpm,
      cpe: computedCpe,
      publishCountNote: "未做跨平台去重，按平台原始记录分别统计。",
      followerNote: "粉丝总数为抖音与快手账号粉丝相加。",
      growthNote: "净增粉基于视频级涨粉累计，不含取关口径。",
    },
    platformComparison: platformSummaries.map((summary) => ({
      ...summary,
      avgPlays: round(summary.avgPlays, 2),
      interactionRate: round(summary.interactionRate, 6),
      avgSpend: round(summary.avgSpend, 2),
    })),
    interactionDisclosures: [
      "抖音互动 = 点赞 + 评论 + 分享 + 收藏",
      "快手互动 = 点赞 + 评论 + 收藏",
    ],
    trends: buildTrendRows(normalized.records),
    rankings: {
      plays: rankingItems(normalized.records, "plays"),
      interactions: rankingItems(normalized.records, "computedInteractions"),
      lowCpm: rankingItems(
        normalized.records,
        "computedCpm",
        "asc",
        5,
        (record) => record.spend > 0 && record.plays > 0 && Number.isFinite(record.computedCpm),
      ),
      lowCpe: rankingItems(
        normalized.records,
        "computedCpe",
        "asc",
        5,
        (record) => record.spend > 0 && record.computedInteractions > 0 && Number.isFinite(record.computedCpe),
      ),
    },
    platformRankings: buildRankingsByPlatform(normalized.records),
    embedAnalysis: buildEmbedAnalysis(normalized.records).map((item) => ({
      ...item,
      avgPlays: round(item.avgPlays, 2),
      avgInteractions: round(item.avgInteractions, 2),
      avgFollowerGain: round(item.avgFollowerGain, 2),
      avgSpend: round(item.avgSpend, 2),
      avgCpm: round(item.avgCpm, 6),
      avgCpe: round(item.avgCpe, 6),
    })),
    contentTable: buildContentTable(normalized.records),
    platformContentTables: groupContentByPlatform(normalized.records),
    matchingPolicy: MATCHING_POLICY,
  };
}
