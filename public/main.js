import { renderDashboard } from "./components/dashboard.js";

async function boot() {
  const root = document.querySelector("#app");
  root.innerHTML = `<div class="shell"><div class="loading card">正在载入最新数据…</div></div>`;

  try {
    const response = await fetch("./data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`请求失败（状态码 ${response.status}）`);
    const payload = await response.json();
    renderDashboard(root, payload);
  } catch (error) {
    root.innerHTML = `
      <div class="shell">
        <div class="loading card">
          <strong>数据载入失败</strong>
          <p>请先重新生成标准化数据并完成构建。</p>
          <p>${error instanceof Error ? error.message : "发生了未知错误"}</p>
        </div>
      </div>
    `;
  }
}

boot();
