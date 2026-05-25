# creator-dashboard

用于抖音与快手账号的固定生产数据看板，固定生产地址必须保持为：

`https://creator-dashboard.rubychoustar.workers.dev`

## 目录约定

```text
data/
  source/latest.xlsx
  normalized/latest.json
  normalized/history/
src/
  components/
  lib/
  index.html
  styles.css
scripts/
  normalize-data.mjs
  build.mjs
public/               # 构建产物，供现有 Cloudflare 项目继续发布
```

## 数据解析方式

- 直接读取 Excel 工作簿。
- 自动搜索表头行，不依赖固定行号。
- 保留顶部账号信息：昵称、获赞、粉丝。
- 忽略空行、`平均值`、`总计` 等汇总行。
- 只把存在作品标题的行视为有效内容行。
- 抖音 `发布时间` 按 Excel serial 转换为 ISO 时间。
- 快手 `发布时间` 按字符串时间解析。
- 快手重复 `完播率` 列默认取后一个列位作为规范字段，并在标准化结果里保留映射说明。

## 周更方式

1. 用新的周报覆盖原始文件，或在命令里传入新文件路径：

```bash
npm run normalize-data -- /path/to/本周数据.xlsx
```

2. 构建静态站产物：

```bash
npm run build
```

执行后会更新：

- `data/source/latest.xlsx`
- `data/normalized/latest.json`
- `data/normalized/history/*.json`
- `public/*`

## 构建与部署

安装依赖：

```bash
npm install
```

本地数据生成与构建：

```bash
npm run normalize-data -- /path/to/本周数据.xlsx
npm run build
```

保留现有 Cloudflare 项目与现有生产 URL 的前提下，可用现有 Cloudflare 工具尝试直接发布到同名项目：

```bash
npm run deploy
```

如果当前环境尚未登录 Cloudflare，请先执行：

```bash
WRANGLER_HOME=.wrangler npx --cache .npm-cache wrangler@4 login
```

如果当前生产链路仍然依赖 Git 集成、Worker 代理或既有映射，请继续沿用原拓扑，不要新建 Cloudflare 项目，也不要改动固定生产地址。
