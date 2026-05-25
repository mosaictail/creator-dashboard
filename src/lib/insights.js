function maxBy(items, selector) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return selector(item) > selector(best) ? item : best;
  }, null);
}

function minBy(items, selector) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return selector(item) < selector(best) ? item : best;
  }, null);
}

function formatPercent(value) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function buildInsights({ platformComparison, embedAnalysis }) {
  const insights = [];
  const validPlatforms = platformComparison.filter((item) => item.publishCount > 0);
  const lowestCpePlatform = minBy(validPlatforms.filter((item) => item.cpe != null), (item) => item.cpe);
  const highestAvgPlayPlatform = maxBy(validPlatforms.filter((item) => item.avgPlays != null), (item) => item.avgPlays);

  if (lowestCpePlatform && highestAvgPlayPlatform) {
    if (lowestCpePlatform.platform === highestAvgPlayPlatform.platform) {
      insights.push(`${lowestCpePlatform.platform}本周期同时拿到更优效率与更高单条曝光，是当前更稳的主阵地。`);
    } else {
      insights.push(`本周期${lowestCpePlatform.platform}互动效率更优，但${highestAvgPlayPlatform.platform}单条曝光更高，平台分工已经比较清晰。`);
    }
  }

  const embedCandidates = embedAnalysis.filter((item) => item.videoCount > 0);
  const bestEmbed = minBy(
    embedCandidates.filter((item) => item.avgCpe != null),
    (item) => item.avgCpe,
  ) ?? maxBy(embedCandidates.filter((item) => item.avgInteractions != null), (item) => item.avgInteractions);

  if (bestEmbed) {
    insights.push(`${bestEmbed.embedStrength}内容在当前样本里更平衡，兼顾互动与投流效率，适合作为下一轮复用方向。`);
  }

  const topInteractionPlatform = maxBy(validPlatforms.filter((item) => item.interactionRate != null), (item) => item.interactionRate);
  if (topInteractionPlatform) {
    insights.push(`当前趋势只适合按发布时间聚合复盘；其中${topInteractionPlatform.platform}互动率为 ${formatPercent(topInteractionPlatform.interactionRate)}，更适合继续验证选题与表达模板。`);
  }

  while (insights.length < 3) {
    insights.push("当前样本更适合做内容复盘，不适合延伸解读成逐日账号监测。");
  }

  return insights.slice(0, 3);
}

