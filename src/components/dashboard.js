import {
  escapeHtml,
  formatCompactNumber,
  formatCurrency,
  formatDateTime,
  formatExactNumber,
  formatPercent,
} from "../lib/format.js";
import { renderPlatformBars, renderTrendCards } from "./charts.js";

function kpiCard(label, value, exact, note, kind = "number") {
  const renderedValue = kind === "currency" ? formatCurrency(value, 0) : kind === "percent" ? formatPercent(value, 1) : formatCompactNumber(value, 2);
  return `
    <article class="kpi-card">
      <div class="section-kicker">${label}</div>
      <div class="kpi-card__value">${renderedValue}</div>
      <div class="kpi-card__meta">${exact}</div>
      <p>${note}</p>
    </article>
  `;
}

function comparisonTable(rows) {
  return `
    <div class="comparison-table">
      ${rows.map((row) => `
        <article class="comparison-table__card">
          <div class="platform-chip">${row.platform}</div>
          <h3>${escapeHtml(row.accountName)}</h3>
          <dl>
            <div><dt>发布数</dt><dd>${formatExactNumber(row.publishCount)}</dd></div>
            <div><dt>总播放</dt><dd>${formatExactNumber(row.totalPlays)}</dd></div>
            <div><dt>平均单条播放</dt><dd>${formatExactNumber(row.avgPlays, 0)}</dd></div>
            <div><dt>总互动</dt><dd>${formatExactNumber(row.totalInteractions)}</dd></div>
            <div><dt>互动率</dt><dd>${formatPercent(row.interactionRate, 1)}</dd></div>
            <div><dt>净增粉</dt><dd>${formatExactNumber(row.followerGain)}</dd></div>
            <div><dt>总投流消耗</dt><dd>${formatCurrency(row.totalSpend, 0)}</dd></div>
            <div><dt>平均单条消耗</dt><dd>${formatCurrency(row.avgSpend, 0)}</dd></div>
            <div><dt>CPM</dt><dd>${formatCurrency(row.cpm, 2)}</dd></div>
            <div><dt>CPE</dt><dd>${formatCurrency(row.cpe, 2)}</dd></div>
          </dl>
        </article>
      `).join("")}
    </div>
  `;
}

function rankingList(title, rows, formatter) {
  return `
    <article class="ranking-card">
      <div class="section-kicker">榜单</div>
      <h3>${title}</h3>
      <div class="ranking-card__list">
        ${rows.length ? rows.map((row, index) => `
          <div class="ranking-row">
            <div class="ranking-row__index">${index + 1}</div>
            <div class="ranking-row__content">
              <strong>${escapeHtml(row.title)}</strong>
              <span>${escapeHtml(formatDateTime(row.publishAt))} · ${escapeHtml(row.embedStrength ?? "—")}</span>
            </div>
            <div class="ranking-row__value">${formatter(row.value)}</div>
          </div>
        `).join("") : `<div class="empty-card">暂无有效数据。</div>`}
      </div>
    </article>
  `;
}

function embedRows(rows) {
  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.embedStrength)}</td>
      <td>${formatExactNumber(row.videoCount)}</td>
      <td>${formatExactNumber(row.avgPlays, 0)}</td>
      <td>${formatExactNumber(row.avgInteractions, 0)}</td>
      <td>${formatExactNumber(row.avgFollowerGain, 1)}</td>
      <td>${formatCurrency(row.avgSpend, 0)}</td>
      <td>${formatCurrency(row.avgCpm, 2)}</td>
      <td>${formatCurrency(row.avgCpe, 2)}</td>
    </tr>
  `).join("");
}

function tableRows(rows) {
  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(formatDateTime(row.publishAt))}</td>
      <td class="title-cell">${escapeHtml(row.title)}</td>
      <td>${escapeHtml(row.embedStrength ?? "—")}</td>
      <td>${formatExactNumber(row.plays)}</td>
      <td>${formatExactNumber(row.interactions)}</td>
      <td>${formatExactNumber(row.followerGain)}</td>
      <td>${formatCurrency(row.spend, 0)}</td>
      <td>${formatCurrency(row.cpm, 2)}</td>
      <td>${formatCurrency(row.cpe, 2)}</td>
    </tr>
  `).join("");
}

function platformContentSections(groups) {
  return groups.map((group) => `
    <article class="platform-section">
      <div class="platform-section__head">
        <span class="platform-chip">${escapeHtml(group.platform)}</span>
        <h3>${escapeHtml(group.platform)}内容表现</h3>
      </div>
      <div class="card table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>发布时间</th>
                <th>作品名称</th>
                <th>植入强度</th>
                <th>播放量</th>
                <th>互动量</th>
                <th>净增粉</th>
                <th>投流消耗</th>
                <th>CPM</th>
                <th>CPE</th>
              </tr>
            </thead>
            <tbody>
              ${group.rows.length ? tableRows(group.rows) : `<tr><td colspan="9">暂无有效内容记录。</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  `).join("");
}

function platformRankingSections(rankingsByPlatform) {
  return ["抖音", "快手"].map((platform) => {
    const rankings = rankingsByPlatform[platform] ?? {};
    return `
      <article class="platform-section">
        <div class="platform-section__head">
          <span class="platform-chip">${platform}</span>
          <h3>${platform}榜单区</h3>
        </div>
        <div class="ranking-grid ranking-grid--platform">
          ${rankingList("播放 TOP5", rankings.plays ?? [], (value) => formatCompactNumber(value, 2))}
          ${rankingList("互动 TOP5", rankings.interactions ?? [], (value) => formatCompactNumber(value, 2))}
          ${rankingList("低 CPM TOP5", rankings.lowCpm ?? [], (value) => formatCurrency(value, 2))}
          ${rankingList("低 CPE TOP5", rankings.lowCpe ?? [], (value) => formatCurrency(value, 2))}
        </div>
      </article>
    `;
  }).join("");
}

export function renderDashboard(root, payload) {
  const { meta, dashboard } = payload;
  const overview = dashboard.overview;
  root.innerHTML = `
    <div class="shell">
      <section class="hero card">
        <div class="hero__copy">
          <div class="section-kicker">创作者经营分析</div>
          <h1>抖音与快手内容表现看板</h1>
          <p>以当前 Excel 周报为唯一数据源，聚焦曝光、互动、涨粉与投流效率，不延伸到私信、成交或直播口径。</p>
        </div>
        <div class="hero__facts">
          <div class="fact-card">
            <span>官方生产地址</span>
            <strong>${escapeHtml(meta.fixedUrl)}</strong>
          </div>
          <div class="fact-card">
            <span>保留旧入口</span>
            <strong>${escapeHtml(meta.legacyUrl ?? "—")}</strong>
          </div>
          <div class="fact-card">
            <span>数据周期</span>
            <strong>${escapeHtml(meta.publishPeriod.label)}</strong>
          </div>
          <div class="fact-card">
            <span>最近生成</span>
            <strong>${escapeHtml(meta.generatedAt)}</strong>
          </div>
        </div>
      </section>

      <section class="section-grid section-grid--overview">
        ${kpiCard("总播放量", overview.totalPlays, `精确值 ${formatExactNumber(overview.totalPlays)}`, "按视频级记录直接汇总。")}
        ${kpiCard("总互动量", overview.totalInteractions, `精确值 ${formatExactNumber(overview.totalInteractions)}`, "已按平台口径分别计算互动。")}
        ${kpiCard("总粉丝数", overview.totalFollowers, `精确值 ${formatExactNumber(overview.totalFollowers)}`, overview.followerNote)}
        ${kpiCard("净增粉", overview.totalFollowerGain, `精确值 ${formatExactNumber(overview.totalFollowerGain)}`, overview.growthNote)}
        ${kpiCard("总投流消耗", overview.totalSpend, `精确值 ${formatCurrency(overview.totalSpend, 0)}`, "仅使用正消耗样本。", "currency")}
        ${kpiCard("发布数", overview.publishCount, overview.publishCountLabel, overview.publishCountNote)}
      </section>

      <section class="section-block card">
        <div class="section-head">
          <div>
            <div class="section-kicker">总览区</div>
            <h2>本周期核心结论先看效率，再看规模。</h2>
          </div>
          <div class="overview-inline">
            <div><span>整体 CPM</span><strong>${formatCurrency(overview.cpm, 2)}</strong></div>
            <div><span>整体 CPE</span><strong>${formatCurrency(overview.cpe, 2)}</strong></div>
          </div>
        </div>
      </section>

      <section class="section-block section-block--comparison">
        <div class="section-head">
          <div>
            <div class="section-kicker">平台对比区</div>
            <h2>抖音与快手的角色分工已经足够清楚。</h2>
          </div>
        </div>
        <div class="comparison-layout">
          <div class="card comparison-bars">${renderPlatformBars(dashboard.platformComparison)}</div>
          <div class="card comparison-side">
            ${comparisonTable(dashboard.platformComparison)}
            <div class="disclosure">
              ${dashboard.interactionDisclosures.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <div class="section-kicker">趋势区</div>
            <h2>趋势按发布时间聚合，只做内容节奏复盘。</h2>
          </div>
        </div>
        <div class="trend-grid">
          ${renderTrendCards(dashboard.trends)}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <div class="section-kicker">内容表现区</div>
            <h2>分平台看内容表现，避免把不同平台口径混在一起。</h2>
          </div>
          <div class="note-pill">${escapeHtml(dashboard.matchingPolicy.reason)}</div>
        </div>
        <div class="platform-stack">
          ${platformContentSections(dashboard.platformContentTables)}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <div class="section-kicker">榜单区</div>
            <h2>榜单按平台拆开，效率排序才更可读。</h2>
          </div>
        </div>
        <div class="platform-stack">
          ${platformRankingSections(dashboard.platformRankings)}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <div class="section-kicker">植入强度分析区</div>
            <h2>用最少的维度，先把强弱植入的效率差异看清楚。</h2>
          </div>
        </div>
        <div class="card table-card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>植入强度</th>
                  <th>视频数量</th>
                  <th>平均播放</th>
                  <th>平均互动</th>
                  <th>平均净增粉</th>
                  <th>平均投流消耗</th>
                  <th>平均 CPM</th>
                  <th>平均 CPE</th>
                </tr>
              </thead>
              <tbody>
                ${embedRows(dashboard.embedAnalysis)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="section-block section-block--insights">
        <div class="section-head">
          <div>
            <div class="section-kicker">结论区</div>
            <h2>本周期只保留三条可行动观察。</h2>
          </div>
        </div>
        <div class="insight-grid">
          ${dashboard.insights.map((item, index) => `
            <article class="card insight-card">
              <span>0${index + 1}</span>
              <p>${escapeHtml(item)}</p>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="section-block section-block--notes">
        <div class="section-head">
          <div>
            <div class="section-kicker">数据说明</div>
            <h2>口径、字段映射与异常提示全部留痕。</h2>
          </div>
        </div>
        <div class="notes-grid">
          <article class="card note-card">
            <h3>字段映射</h3>
            <ul>${meta.fieldMappings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </article>
          <article class="card note-card">
            <h3>数据提示</h3>
            <ul>${meta.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </article>
          <article class="card note-card">
            <h3>解析警告</h3>
            <ul>${(meta.warnings.length ? meta.warnings : ["未发现额外警告。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </article>
        </div>
      </section>
    </div>
  `;
}
