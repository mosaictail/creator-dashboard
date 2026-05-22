const DATA_URL = "./data/latest.json";

const metricCatalog = [
  ["followersTotal", "粉丝总量", "number"],
  ["newFollowers", "新增粉丝", "number"],
  ["netNewFollowers", "净增粉丝", "number"],
  ["playCount", "播放/曝光", "number"],
  ["homepageVisits", "主页访问", "number"],
  ["likeCount", "点赞", "number"],
  ["commentCount", "评论", "number"],
  ["shareCount", "分享", "number"],
  ["favoriteCount", "收藏", "number"],
  ["publishCount", "发布数量", "number"],
  ["averagePlayCount", "单条平均播放", "number"],
  ["totalInteractions", "总互动量", "number"],
  ["engagementRate", "互动率", "percent"],
  ["fanConversionRate", "涨粉转化率", "percent"],
  ["homepageConversionRate", "主页访问转化率", "percent"],
];

const comparisonMetrics = [
  ["playCount", "播放量", "number"],
  ["engagementRate", "互动率", "percent"],
  ["newFollowers", "新增粉丝", "number"],
  ["publishCount", "发布数量", "number"],
  ["averagePlayCount", "单条平均播放", "number"],
  ["fanConversionRate", "涨粉转化率", "percent"],
];

const rankLabels = {
  playCount: ["播放量 Top 10", "number"],
  engagementRate: ["互动率 Top 10", "percent"],
  newFollowers: ["涨粉 Top 10", "number"],
  favoriteCount: ["收藏 Top 10", "number"],
  shareCount: ["分享 Top 10", "number"],
};

let dashboardData = null;
let activeRank = "playCount";

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function formatNumber(value, digits = 0) {
  if (!hasValue(value)) return "N/A";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(Number(value));
}

function formatPercent(value) {
  if (!hasValue(value)) return "N/A";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatValue(value, type) {
  if (type === "percent") return formatPercent(value);
  if (type === "duration") return hasValue(value) ? `${Number(value).toFixed(1)}s` : "N/A";
  return formatNumber(value);
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHTML(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}

function platformClass(platform) {
  return platform === "快手" ? "kuaishou" : "douyin";
}

function renderHero(data) {
  $("#last-updated").textContent = data.meta?.dataUpdatedAt || data.meta?.generatedAt || "N/A";
  $("#data-period").textContent = data.meta?.dataPeriod?.label || "N/A";
}

function renderOverview(data) {
  const platforms = ["抖音", "快手", "全平台"];
  const summariesByPlatform = new Map(data.platformSummaries.map((item) => [item.platform, item]));
  const html = platforms.map((platform) => {
    const summary = summariesByPlatform.get(platform) || { platform, metrics: {} };
    const metrics = summary.metrics || {};
    const primaryMetric = platform === "全平台" ? "playCount" : "followersTotal";
    return `
      <article class="platform-panel" aria-label="${escapeHTML(platform)}核心数据">
        <h3 class="platform-panel__title">${escapeHTML(platform)}核心数据</h3>
        <div class="metric metric--wide">
          <div class="metric__label">${primaryMetric === "playCount" ? "全平台播放/曝光" : "账号粉丝总量"}</div>
          <div class="metric__value">${formatValue(metrics[primaryMetric], "number")}</div>
          <div class="metric__sub">${escapeHTML(summary.accountName || summary.note || "基于当前 Excel 可用字段")}</div>
        </div>
        ${metricCatalog.map(([key, label, type]) => `
          <div class="metric">
            <div class="metric__label">${label}</div>
            <div class="metric__value">${formatValue(metrics[key], type)}</div>
          </div>
        `).join("")}
      </article>
    `;
  }).join("");
  $("#overview-grid").innerHTML = html;
}

function renderComparison(data) {
  const summariesByPlatform = new Map(data.platformSummaries.map((item) => [item.platform, item.metrics || {}]));
  const douyin = summariesByPlatform.get("抖音") || {};
  const kuaishou = summariesByPlatform.get("快手") || {};

  $("#comparison-bars").innerHTML = comparisonMetrics.map(([key, label, type]) => {
    const d = Number(douyin[key]);
    const k = Number(kuaishou[key]);
    const total = (Number.isFinite(d) ? d : 0) + (Number.isFinite(k) ? k : 0);
    const dShare = total > 0 ? Math.max(d, 0) / total : 0.5;
    const kShare = total > 0 ? Math.max(k, 0) / total : 0.5;
    return `
      <div class="bar-row">
        <div class="bar-row__head"><span>${label}</span><span>抖音 / 快手</span></div>
        <div class="bar-row__track" style="--douyin:${dShare}; --kuaishou:${kShare}">
          <span aria-hidden="true"></span><span aria-hidden="true"></span>
        </div>
        <div class="bar-row__values">
          <span>${formatValue(douyin[key], type)}</span>
          <span>${formatValue(kuaishou[key], type)}</span>
        </div>
      </div>
    `;
  }).join("");

  renderRadarChart("radar-chart", comparisonMetrics, douyin, kuaishou);
}

function renderRadarChart(id, metrics, douyin, kuaishou) {
  const svg = document.getElementById(id);
  const cx = 260;
  const cy = 176;
  const radius = 118;
  const maxByMetric = Object.fromEntries(metrics.map(([key]) => {
    const max = Math.max(Number(douyin[key]) || 0, Number(kuaishou[key]) || 0);
    return [key, max || 1];
  }));

  const point = (index, value) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index / metrics.length);
    const r = radius * Math.max(0, Math.min(1, value));
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  const polygon = (source) => metrics.map(([key], index) => {
    const value = (Number(source[key]) || 0) / maxByMetric[key];
    return point(index, value).join(",");
  }).join(" ");

  const axes = metrics.map(([key, label], index) => {
    const [x, y] = point(index, 1);
    const labelX = cx + (x - cx) * 1.22;
    const labelY = cy + (y - cy) * 1.22;
    return `
      <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="chart-grid" />
      <text x="${labelX}" y="${labelY}" text-anchor="middle" class="chart-label">${label}</text>
    `;
  }).join("");

  const rings = [0.25, 0.5, 0.75, 1].map((scale) => {
    const pts = metrics.map((_, index) => point(index, scale).join(",")).join(" ");
    return `<polygon points="${pts}" fill="none" class="chart-grid" />`;
  }).join("");

  svg.innerHTML = `
    ${rings}
    ${axes}
    <polygon points="${polygon(douyin)}" fill="rgba(29,29,31,0.11)" stroke="#1d1d1f" stroke-width="2" />
    <polygon points="${polygon(kuaishou)}" fill="rgba(15,98,254,0.12)" stroke="#0f62fe" stroke-width="2" />
    <circle cx="176" cy="318" r="5" fill="#1d1d1f" />
    <text x="190" y="322" class="chart-label">抖音</text>
    <circle cx="258" cy="318" r="5" fill="#0f62fe" />
    <text x="272" y="322" class="chart-label">快手</text>
  `;
}

function renderTrend(data) {
  const trend = data.trends || [];
  const empty = $("#trend-empty");
  const chart = $("#trend-chart");
  if (trend.length <= 1) {
    empty.hidden = false;
    chart.innerHTML = "";
    chart.closest(".trend").hidden = true;
    return;
  }

  empty.hidden = true;
  chart.closest(".trend").hidden = false;

  const width = 980;
  const height = 360;
  const pad = { left: 62, right: 28, top: 34, bottom: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxPlay = Math.max(...trend.map((row) => Number(row.playCount) || 0), 1);
  const maxFollowers = Math.max(...trend.map((row) => Number(row.newFollowers) || 0), 1);
  const x = (index) => pad.left + (trend.length === 1 ? innerW / 2 : (innerW * index / (trend.length - 1)));
  const yPlay = (value) => pad.top + innerH - (innerH * (Number(value) || 0) / maxPlay);
  const yFollowers = (value) => pad.top + innerH - (innerH * (Number(value) || 0) / maxFollowers);
  const playPoints = trend.map((row, index) => `${x(index)},${yPlay(row.playCount)}`).join(" ");
  const followerPoints = trend.map((row, index) => `${x(index)},${yFollowers(row.newFollowers)}`).join(" ");

  const grid = [0, 0.25, 0.5, 0.75, 1].map((scale) => {
    const y = pad.top + innerH * scale;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="chart-grid" />`;
  }).join("");

  const labels = trend.map((row, index) => {
    const show = trend.length <= 8 || index % Math.ceil(trend.length / 8) === 0 || index === trend.length - 1;
    return show ? `<text x="${x(index)}" y="${height - 22}" text-anchor="middle" class="chart-label">${shortDate(row.date)}</text>` : "";
  }).join("");

  const dots = trend.map((row, index) => `
    <circle cx="${x(index)}" cy="${yPlay(row.playCount)}" r="4" fill="#1d1d1f" />
    <circle cx="${x(index)}" cy="${yFollowers(row.newFollowers)}" r="4" fill="#0f62fe" />
  `).join("");

  chart.innerHTML = `
    ${grid}
    <text x="${pad.left}" y="24" class="chart-label">播放/曝光</text>
    <text x="${width - pad.right}" y="24" text-anchor="end" class="chart-label">新增粉丝</text>
    <polyline points="${playPoints}" fill="none" stroke="#1d1d1f" stroke-width="2.5" />
    <polyline points="${followerPoints}" fill="none" stroke="#0f62fe" stroke-width="2.5" />
    ${dots}
    ${labels}
    <circle cx="70" cy="328" r="5" fill="#1d1d1f" />
    <text x="84" y="332" class="chart-label">播放/曝光</text>
    <circle cx="168" cy="328" r="5" fill="#0f62fe" />
    <text x="182" y="332" class="chart-label">新增粉丝</text>
  `;
}

function renderRanking() {
  const [label, type] = rankLabels[activeRank];
  const rows = [...(dashboardData.videos || [])]
    .filter((video) => hasValue(video[activeRank]))
    .sort((a, b) => Number(b[activeRank]) - Number(a[activeRank]))
    .slice(0, 10);

  $("#ranking-list").innerHTML = rows.length ? rows.map((video, index) => `
    <article class="ranking-item">
      <div class="ranking-item__rank">#${index + 1}</div>
      <div class="ranking-item__title">
        <strong title="${escapeHTML(video.videoTitle)}">${escapeHTML(video.videoTitle || "N/A")}</strong>
        <span>${escapeHTML(video.platform || "N/A")} · ${escapeHTML(video.accountName || "N/A")} · ${shortDate(video.publishTime)}</span>
      </div>
      <div class="ranking-item__value">${formatValue(video[activeRank], type)}</div>
    </article>
  `).join("") : `<div class="empty-state">${label} 暂无可用数据。</div>`;
}

function setupRankingTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeRank = button.dataset.rank;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("is-active", item === button));
      renderRanking();
    });
  });
}

function setupFilters(data) {
  const platforms = ["全部", ...new Set(data.videos.map((video) => video.platform).filter(Boolean))];
  const accounts = ["全部", ...new Set(data.videos.map((video) => video.accountName).filter(Boolean))];
  $("#platform-filter").innerHTML = platforms.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
  $("#account-filter").innerHTML = accounts.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("");
  ["platform-filter", "account-filter", "sort-select", "search-input"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderVideoTable);
    document.getElementById(id).addEventListener("change", renderVideoTable);
  });
}

function renderVideoTable() {
  const platform = $("#platform-filter").value;
  const account = $("#account-filter").value;
  const sort = $("#sort-select").value;
  const query = $("#search-input").value.trim().toLowerCase();

  const rows = [...(dashboardData.videos || [])]
    .filter((video) => platform === "全部" || video.platform === platform)
    .filter((video) => account === "全部" || video.accountName === account)
    .filter((video) => !query || String(video.videoTitle || "").toLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === "publishTime") {
        return new Date(b.publishTime || 0) - new Date(a.publishTime || 0);
      }
      return (Number(b[sort]) || 0) - (Number(a[sort]) || 0);
    });

  $("#video-table").innerHTML = rows.length ? rows.map((video) => {
    const title = escapeHTML(video.videoTitle || "N/A");
    const titleHTML = video.videoLink
      ? `<a href="${escapeHTML(video.videoLink)}" target="_blank" rel="noreferrer">${title}</a>`
      : title;
    return `
      <tr>
        <td><span class="badge">${escapeHTML(video.platform || "N/A")}</span></td>
        <td>${escapeHTML(video.accountName || "N/A")}</td>
        <td class="video-title">${titleHTML}</td>
        <td>${formatDate(video.publishTime)}</td>
        <td>${formatNumber(video.playCount)}</td>
        <td>${formatNumber(video.likeCount)}</td>
        <td>${formatNumber(video.commentCount)}</td>
        <td>${formatNumber(video.shareCount)}</td>
        <td>${formatNumber(video.favoriteCount)}</td>
        <td>${formatPercent(video.completionRate)}</td>
        <td>${formatValue(video.averageWatchDuration, "duration")}</td>
        <td>${formatNumber(video.newFollowers)}</td>
        <td>${formatNumber(video.homepageVisits)}</td>
        <td>${formatPercent(video.engagementRate)}</td>
        <td>${formatPercent(video.fanConversionRate)}</td>
        <td>${escapeHTML(video.trafficSource || "N/A")}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="16">暂无符合条件的视频。</td></tr>`;
}

function renderInsights(data) {
  $("#insights").innerHTML = (data.insights || []).map((item) => `
    <article class="insight">
      <div class="insight__label">${escapeHTML(item.type || "洞察")}</div>
      <h3>${escapeHTML(item.title || "N/A")}</h3>
      <p>${escapeHTML(item.description || "")}</p>
    </article>
  `).join("");
}

function renderNotes(data) {
  const meta = data.meta || {};
  const missing = meta.missingFields || [];
  const mappings = meta.fieldMappings || [];
  const warnings = meta.warnings || [];
  const recognized = [
    `Excel 文件：${meta.sourceFile || "N/A"}`,
    `识别 Sheet：${(meta.sheets || []).join("、") || "N/A"}`,
    `账号数量：${formatNumber(meta.accountCount)}`,
    `视频数量：${formatNumber(meta.videoCount)}`,
    `数据来源：${meta.dataSource || "N/A"}`,
    `数据更新时间：${meta.dataUpdatedAt || "N/A"}`,
  ];

  const block = (title, rows) => `
    <article class="note-block">
      <h3>${escapeHTML(title)}</h3>
      <ul>${rows.length ? rows.map((row) => `<li>${escapeHTML(row)}</li>`).join("") : "<li>无</li>"}</ul>
    </article>
  `;

  $("#data-notes").innerHTML = [
    block("读取结果", recognized),
    block("字段缺失", missing),
    block("字段映射", mappings),
    block("处理提醒", warnings),
  ].join("");
}

async function boot() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
    dashboardData = await response.json();
    renderHero(dashboardData);
    renderOverview(dashboardData);
    renderComparison(dashboardData);
    renderTrend(dashboardData);
    renderRanking();
    setupRankingTabs();
    setupFilters(dashboardData);
    renderVideoTable();
    renderInsights(dashboardData);
    renderNotes(dashboardData);
  } catch (error) {
    document.body.innerHTML = `<main class="shell hero"><h1>数据暂不可用</h1><p>${escapeHTML(error.message)}</p></main>`;
  }
}

boot();
