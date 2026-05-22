# creator-dashboard

固定网址短视频运营数据看板，用于展示抖音和快手账号与视频表现。

固定生产地址：

https://creator-dashboard.rubychoustar.workers.dev

## 项目结构

```text
public/
  index.html
  assets/
    app.js
    styles.css
  data/
    latest.json
    history/
scripts/
  parse_excel.py
```

## 更新数据

后续每次收到新的 Excel，只更新同一个项目里的数据文件：

```bash
/Users/a149548/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/parse_excel.py /path/to/new.xlsx
```

脚本会生成：

- `public/data/latest.json`：看板固定读取的数据源
- `public/data/history/`：本次更新的历史快照

Cloudflare Pages 项目 `creator-dashboard` 会自动部署 `main` 分支，最终网址保持不变。
