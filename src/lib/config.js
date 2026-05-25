export const FIXED_PRODUCTION_URL = "https://creator-dashboard.rubychoustar.workers.dev";
export const SOURCE_WORKBOOK_PATH = "data/source/latest.xlsx";
export const NORMALIZED_DATA_PATH = "data/normalized/latest.json";
export const HISTORY_DIRECTORY = "data/normalized/history";

export const COST_RULES = {
  cpm: {
    label: "CPM",
    denominatorField: "plays",
    multiplier: 1000,
  },
  cpe: {
    label: "CPE",
    denominatorField: "computedInteractions",
    multiplier: 1,
  },
  spendMustBePositive: true,
};

export const PLATFORM_RULES = {
  抖音: {
    accountSheetKeyword: "抖音",
    titleFieldHints: ["作品名称", "作品", "标题"],
    summaryKeywords: ["平均值", "总计", "合计"],
    interactionFields: ["likes", "comments", "shares", "favorites"],
    fieldLabels: {
      embedStrength: ["标签"],
      title: ["作品名称", "作品", "标题"],
      publishAt: ["发布时间", "发布日期"],
      genre: ["体裁"],
      reviewStatus: ["审核状态"],
      plays: ["播放量"],
      completeRate: ["完播率"],
      completeRate5s: ["5s完播率"],
      bounceRate2s: ["2s跳出率"],
      avgWatchTime: ["平均播放时长", "平均观看时长"],
      likes: ["点赞量", "点赞数"],
      shares: ["分享量", "分享数"],
      comments: ["评论量", "评论数"],
      favorites: ["收藏量", "收藏数"],
      profileVisits: ["主页访问量", "主页访问"],
      followerGain: ["粉丝增量", "涨粉量"],
      spend: ["投放金额"],
      sourceCpm: ["CPM"],
      sourceCpe: ["CPE"],
    },
    parseDateMode: "excel-serial",
  },
  快手: {
    accountSheetKeyword: "快手",
    titleFieldHints: ["作品", "作品名称", "标题"],
    summaryKeywords: ["平均值", "总计", "合计"],
    interactionFields: ["likes", "comments", "favorites"],
    fieldLabels: {
      embedStrength: ["标签"],
      title: ["作品", "作品名称", "标题"],
      publishAt: ["发布时间", "发布日期"],
      plays: ["播放量"],
      completeRate: ["完播率"],
      completeRate5s: ["5秒完播", "5s完播率"],
      bounceRate2s: ["2秒跳出", "2s跳出率"],
      avgWatchTime: ["平均播放", "平均播放时长", "平均观看时长"],
      likes: ["点赞量", "点赞数"],
      comments: ["评论量", "评论数"],
      favorites: ["收藏量", "收藏数"],
      followerGain: ["涨粉量", "粉丝增量"],
      spend: ["投放金额"],
      sourceCpm: ["CPM"],
      sourceCpe: ["CPE"],
    },
    parseDateMode: "datetime-string",
    canonicalDuplicateHeaders: {
      completeRate: "last",
    },
  },
};

export const EMBED_STRENGTH_ORDER = ["弱植入", "中植入", "强植入"];

export const MATCHING_POLICY = {
  enabled: false,
  reason: "当前两平台标题与记录数不稳定，不做强制一一匹配，统一使用平台分开展示。",
};

