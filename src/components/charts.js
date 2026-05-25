import {
  escapeHtml,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatPercent,
  hasNumber,
} from "../lib/format.js";

function svgLinePath(points) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function valueOrZero(value) {
  return hasNumber(value) ? value : 0;
}

function trendSvg(rows, field, options) {
  if (!rows.length) {
    return `<div class="empty-card">当前暂无可展示趋势。</div>`;
  }

  const width = 520;
  const height = 220;
  const padding = { top: 26, right: 24, bottom: 36, left: 16 };
  const max = Math.max(...rows.map((item) => valueOrZero(item[field])), 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const points = rows.map((row, index) => {
    const x = padding.left + (rows.length === 1 ? innerWidth / 2 : (innerWidth * index) / (rows.length - 1));
    const y = padding.top + innerHeight - (innerHeight * valueOrZero(row[field])) / max;
    return [x, y];
  });

  const areaPath = `${svgLinePath(points)} L ${points.at(-1)[0]} ${height - padding.bottom} L ${points[0][0]} ${height - padding.bottom} Z`;
  const labels = rows.map((row, index) => {
    const point = points[index];
    return `
      <text x="${point[0]}" y="${height - 10}" text-anchor="middle" class="chart-axis">${escapeHtml(formatDate(row.date))}</text>
    `;
  }).join("");

  const dots = rows.map((row, index) => {
    const point = points[index];
    return `
      <g class="chart-dot">
        <circle cx="${point[0]}" cy="${point[1]}" r="3.5"></circle>
        <title>${escapeHtml(formatDate(row.date))}：${escapeHtml(options.valueFormatter(row[field]))}</title>
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.title)}">
      <defs>
        <linearGradient id="${options.gradientId}" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${options.color}" stop-opacity="0.26"></stop>
          <stop offset="100%" stop-color="${options.color}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${options.gradientId})"></path>
      <path d="${svgLinePath(points)}" fill="none" stroke="${options.color}" stroke-width="2.5" stroke-linecap="round"></path>
      ${dots}
      ${labels}
    </svg>
  `;
}

export function renderTrendCards(rows) {
  const cards = [
    {
      title: "播放趋势",
      subtitle: "按发布时间聚合",
      field: "plays",
      gradientId: "trend-plays",
      color: "#8fb4ff",
      valueFormatter: (value) => formatCompactNumber(value, 2),
    },
    {
      title: "互动趋势",
      subtitle: "按发布时间聚合",
      field: "interactions",
      gradientId: "trend-interactions",
      color: "#7ce4c5",
      valueFormatter: (value) => formatCompactNumber(value, 2),
    },
    {
      title: "涨粉趋势",
      subtitle: "按发布时间聚合",
      field: "followerGain",
      gradientId: "trend-fans",
      color: "#ffd3a7",
      valueFormatter: (value) => formatCompactNumber(value, 2),
    },
    {
      title: "投流消耗趋势",
      subtitle: "按发布时间聚合",
      field: "spend",
      gradientId: "trend-spend",
      color: "#f3a8c8",
      valueFormatter: (value) => formatCurrency(value, 0),
    },
  ];

  return cards.map((card) => `
    <article class="trend-card">
      <div class="section-kicker">${card.subtitle}</div>
      <h3>${card.title}</h3>
      ${trendSvg(rows, card.field, card)}
    </article>
  `).join("");
}

export function renderPlatformBars(rows) {
  const metrics = [
    ["publishCount", "发布数", "number"],
    ["totalPlays", "总播放", "number"],
    ["avgPlays", "平均单条播放", "number"],
    ["totalInteractions", "总互动", "number"],
    ["interactionRate", "互动率", "percent"],
    ["followerGain", "净增粉", "number"],
    ["totalSpend", "总投流消耗", "currency"],
    ["avgSpend", "平均单条消耗", "currency"],
    ["cpm", "CPM", "currency"],
    ["cpe", "CPE", "currency"],
  ];

  const formatter = {
    number: (value) => formatCompactNumber(value, 2),
    percent: (value) => formatPercent(value, 1),
    currency: (value) => formatCurrency(value, 2),
  };

  return metrics.map(([field, label, type]) => {
    const first = valueOrZero(rows[0]?.[field]);
    const second = valueOrZero(rows[1]?.[field]);
    const total = first + second || 1;
    const firstRatio = first / total;
    const secondRatio = second / total;

    return `
      <div class="bar-card">
        <div class="bar-card__head">
          <span>${label}</span>
          <span>${rows[0]?.platform ?? "抖音"} / ${rows[1]?.platform ?? "快手"}</span>
        </div>
        <div class="bar-track">
          <span class="bar-track__fill bar-track__fill--primary" style="width:${(firstRatio * 100).toFixed(2)}%"></span>
          <span class="bar-track__fill bar-track__fill--secondary" style="width:${(secondRatio * 100).toFixed(2)}%"></span>
        </div>
        <div class="bar-card__values">
          <strong>${formatter[type](rows[0]?.[field])}</strong>
          <strong>${formatter[type](rows[1]?.[field])}</strong>
        </div>
      </div>
    `;
  }).join("");
}

