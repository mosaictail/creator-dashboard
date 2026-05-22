#!/usr/bin/env python3
"""Parse creator performance Excel files into the fixed dashboard JSON."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo

import pandas as pd


CANONICAL_VIDEO_FIELDS = {
    "platform": "平台",
    "accountName": "账号名称",
    "videoTitle": "视频标题",
    "videoLink": "视频链接",
    "publishTime": "发布时间",
    "videoDuration": "视频时长",
    "playCount": "播放量 / 曝光量",
    "likeCount": "点赞数",
    "commentCount": "评论数",
    "shareCount": "分享数",
    "favoriteCount": "收藏数",
    "completionRate": "完播率",
    "averageWatchDuration": "平均观看时长",
    "newFollowers": "新增粉丝",
    "homepageVisits": "主页访问量",
    "trafficSource": "流量来源",
}

CANONICAL_ACCOUNT_FIELDS = {
    "followersTotal": "粉丝总量",
    "newFollowers": "新增粉丝",
    "netNewFollowers": "净增粉丝",
    "playCount": "播放量 / 曝光量",
    "homepageVisits": "主页访问量",
    "likeCount": "点赞数",
    "commentCount": "评论数",
    "shareCount": "分享数",
    "favoriteCount": "收藏数",
    "publishCount": "发布数量",
    "averagePlayCount": "单条平均播放量",
    "totalInteractions": "总互动量",
    "engagementRate": "互动率",
    "fanConversionRate": "涨粉转化率",
    "homepageConversionRate": "主页访问转化率",
}

FIELD_SYNONYMS = {
    "platform": ["平台", "渠道"],
    "accountName": ["账号名称", "账号", "昵称", "达人昵称"],
    "videoTitle": ["视频标题", "作品名称", "作品", "标题", "内容标题"],
    "videoLink": ["视频链接", "链接", "作品链接", "URL", "url"],
    "publishTime": ["发布时间", "发布日期", "发布于", "时间"],
    "videoDuration": ["视频时长", "时长", "体裁"],
    "playCount": ["播放量", "曝光量", "播放/曝光", "播放量/曝光量"],
    "likeCount": ["点赞数", "点赞量", "获赞"],
    "commentCount": ["评论数", "评论量"],
    "shareCount": ["分享数", "分享量"],
    "favoriteCount": ["收藏数", "收藏量"],
    "completionRate": ["完播率"],
    "averageWatchDuration": ["平均观看时长", "平均播放时长", "平均播放", "平均观看"],
    "newFollowers": ["新增粉丝", "粉丝增量", "涨粉量", "涨粉"],
    "homepageVisits": ["主页访问量", "主页访问", "主页访问人数"],
    "trafficSource": ["流量来源", "来源", "主要流量来源"],
}

NUMERIC_VIDEO_FIELDS = {
    "playCount",
    "likeCount",
    "commentCount",
    "shareCount",
    "favoriteCount",
    "averageWatchDuration",
    "newFollowers",
    "homepageVisits",
}

RATE_FIELDS = {"completionRate"}


def normalize_label(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    text = re.sub(r"\.\d+$", "", text)
    text = re.sub(r"\s+", "", text)
    return text


def cell_text(value: object) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def to_number(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if math.isnan(float(value)):
            return None
        return float(value)

    text = str(value).strip()
    if not text or text.upper() in {"N/A", "NA", "-"}:
        return None

    multiplier = 1
    if "亿" in text:
        multiplier = 100000000
    elif "万" in text:
        multiplier = 10000

    text = text.replace(",", "").replace(" ", "")
    text = text.replace("亿", "").replace("万", "").replace("+", "")
    text = re.sub(r"[^0-9.\-%]", "", text)
    if not text or text in {".", "-", "%"}:
        return None

    is_percent = text.endswith("%")
    text = text.rstrip("%")
    try:
        number = float(text) * multiplier
    except ValueError:
        return None
    if is_percent:
        number /= 100
    return number


def to_rate(value: object) -> float | None:
    number = to_number(value)
    if number is None:
        return None
    if number > 1 and number <= 100:
        return number / 100
    return number


def to_int_or_float(value: float | None) -> int | float | None:
    if value is None:
        return None
    if abs(value - round(value)) < 0.0000001:
        return int(round(value))
    return round(value, 6)


def safe_divide(numerator: float | int | None, denominator: float | int | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return round(float(numerator) / float(denominator), 8)


def parse_datetime(value: object) -> str | None:
    if value is None or pd.isna(value):
        return None
    try:
        parsed = pd.to_datetime(value)
    except Exception:
        return cell_text(value)
    if pd.isna(parsed):
        return cell_text(value)
    return parsed.isoformat()


def date_key(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return pd.to_datetime(value).date().isoformat()
    except Exception:
        return None


def display_date(value: str | None) -> str | None:
    key = date_key(value)
    return key


def infer_platform(sheet_name: str, row_platform: str | None = None) -> str:
    if row_platform:
        return row_platform
    if "抖音" in sheet_name.lower() or "douyin" in sheet_name.lower():
        return "抖音"
    if "快手" in sheet_name.lower() or "kuaishou" in sheet_name.lower():
        return "快手"
    return sheet_name


def make_headers(row: pd.Series) -> list[str]:
    counts: dict[str, int] = {}
    headers: list[str] = []
    for index, value in enumerate(row.tolist()):
        base = cell_text(value) or f"Unnamed:{index}"
        if base in counts:
            counts[base] += 1
            headers.append(f"{base}.{counts[base]}")
        else:
            counts[base] = 0
            headers.append(base)
    return headers


def find_video_header_row(df: pd.DataFrame) -> int | None:
    for index, row in df.iterrows():
        labels = {normalize_label(value) for value in row.tolist()}
        has_title = any(label in labels for label in ["作品名称", "作品", "视频标题", "标题"])
        has_time = "发布时间" in labels or "发布日期" in labels
        has_metric = any(label in labels for label in ["播放量", "曝光量", "点赞量", "点赞数"])
        if has_title and has_time and has_metric:
            return int(index)
    return None


def map_columns(headers: list[str]) -> tuple[dict[str, str], list[str]]:
    normalized = [(header, normalize_label(header)) for header in headers]
    mapping: dict[str, str] = {}
    duplicate_notes: list[str] = []

    for field, synonyms in FIELD_SYNONYMS.items():
        matches = [header for header, label in normalized if label in synonyms]
        if matches:
            mapping[field] = matches[0]
            if len(matches) > 1:
                duplicate_notes.append(f"字段“{CANONICAL_VIDEO_FIELDS.get(field, field)}”出现重复列，已优先使用“{matches[0]}”。")

    return mapping, duplicate_notes


def extract_account_basics(df: pd.DataFrame) -> dict[str, object]:
    basics: dict[str, object] = {}
    for _, row in df.iterrows():
        cells = row.tolist()
        for index, value in enumerate(cells[:-1]):
            label = normalize_label(value)
            next_value = cells[index + 1] if index + 1 < len(cells) else None
            if label in {"昵称", "账号名称", "账号"} and next_value is not None:
                basics["accountName"] = cell_text(next_value)
            if label == "粉丝" and next_value is not None:
                basics["followersTotal"] = to_int_or_float(to_number(next_value))
            if label == "获赞" and next_value is not None:
                basics["accountLikesTotal"] = to_int_or_float(to_number(next_value))
    return basics


def parse_video_sheet(
    sheet_name: str,
    df: pd.DataFrame,
    mappings_report: list[str],
    warnings: list[str],
) -> tuple[list[dict[str, object]], dict[str, object]]:
    basics = extract_account_basics(df)
    header_row = find_video_header_row(df)
    if header_row is None:
        return [], basics

    headers = make_headers(df.iloc[header_row])
    mapping, duplicate_notes = map_columns(headers)
    warnings.extend(duplicate_notes)

    for field, source in mapping.items():
        label = CANONICAL_VIDEO_FIELDS.get(field, field)
        if source != label:
            mappings_report.append(f"{sheet_name}：{source} -> {label}")

    records: list[dict[str, object]] = []
    account_name = basics.get("accountName")

    for row_index in range(header_row + 1, len(df)):
        row_values = df.iloc[row_index].tolist()
        if all(cell_text(value) is None for value in row_values):
            continue

        row = {headers[index]: row_values[index] if index < len(row_values) else None for index in range(len(headers))}
        title_col = mapping.get("videoTitle")
        title = cell_text(row.get(title_col)) if title_col else None
        if not title:
            continue

        row_platform = cell_text(row.get(mapping.get("platform"))) if mapping.get("platform") else None
        platform = infer_platform(sheet_name, row_platform)
        record: dict[str, object] = {
            "platform": platform,
            "accountName": cell_text(row.get(mapping.get("accountName"))) if mapping.get("accountName") else account_name,
            "videoTitle": title,
            "videoLink": cell_text(row.get(mapping.get("videoLink"))) if mapping.get("videoLink") else None,
            "publishTime": parse_datetime(row.get(mapping.get("publishTime"))) if mapping.get("publishTime") else None,
            "videoDuration": cell_text(row.get(mapping.get("videoDuration"))) if mapping.get("videoDuration") else None,
            "trafficSource": cell_text(row.get(mapping.get("trafficSource"))) if mapping.get("trafficSource") else None,
            "sourceSheet": sheet_name,
        }

        for field in NUMERIC_VIDEO_FIELDS:
            record[field] = to_int_or_float(to_number(row.get(mapping.get(field)))) if mapping.get(field) else None

        for field in RATE_FIELDS:
            record[field] = to_rate(row.get(mapping.get(field))) if mapping.get(field) else None

        interaction_parts = [record.get(field) for field in ["likeCount", "commentCount", "shareCount", "favoriteCount"]]
        record["totalInteractions"] = sum(interaction_parts) if all(value is not None for value in interaction_parts) else None
        record["engagementRate"] = safe_divide(record["totalInteractions"], record.get("playCount"))
        record["fanConversionRate"] = safe_divide(record.get("newFollowers"), record.get("playCount"))
        records.append(record)

    return records, basics


def aggregate_platforms(
    videos: list[dict[str, object]],
    account_basics: dict[tuple[str, str], dict[str, object]],
) -> list[dict[str, object]]:
    grouped: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for video in videos:
        key = (str(video.get("platform") or "N/A"), str(video.get("accountName") or "N/A"))
        grouped[key].append(video)

    summaries: list[dict[str, object]] = []
    for key in sorted(grouped.keys()):
        platform, account_name = key
        records = grouped[key]
        basics = account_basics.get(key, {})
        metrics = summarize_records(records, basics)
        summaries.append(
            {
                "platform": platform,
                "accountName": account_name,
                "metrics": metrics,
                "accountLikesTotal": basics.get("accountLikesTotal"),
            }
        )

    platform_merged: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in summaries:
        platform_merged[str(item["platform"])].append(item)

    platform_summaries: list[dict[str, object]] = []
    for platform in ["抖音", "快手"]:
        items = platform_merged.get(platform, [])
        if not items:
            continue
        if len(items) == 1:
            platform_summaries.append(items[0])
        else:
            platform_summaries.append(
                {
                    "platform": platform,
                    "accountName": "多账号合计",
                    "metrics": combine_metrics([item["metrics"] for item in items], require_all=True),
                }
            )

    all_metrics = combine_metrics([item["metrics"] for item in platform_summaries], require_all=True)
    platform_summaries.append({"platform": "全平台", "accountName": "抖音 + 快手", "metrics": all_metrics})
    return platform_summaries


def sum_if_all(records: list[dict[str, object]], field: str) -> int | float | None:
    values = [record.get(field) for record in records]
    if not values or any(value is None for value in values):
        return None
    return to_int_or_float(sum(float(value) for value in values))


def summarize_records(records: list[dict[str, object]], basics: dict[str, object]) -> dict[str, object]:
    metrics = {field: None for field in CANONICAL_ACCOUNT_FIELDS.keys()}
    metrics["followersTotal"] = basics.get("followersTotal")
    metrics["playCount"] = sum_if_all(records, "playCount")
    metrics["homepageVisits"] = sum_if_all(records, "homepageVisits")
    metrics["likeCount"] = sum_if_all(records, "likeCount")
    metrics["commentCount"] = sum_if_all(records, "commentCount")
    metrics["shareCount"] = sum_if_all(records, "shareCount")
    metrics["favoriteCount"] = sum_if_all(records, "favoriteCount")
    metrics["newFollowers"] = sum_if_all(records, "newFollowers")
    metrics["publishCount"] = len(records)
    metrics["averagePlayCount"] = safe_divide(metrics["playCount"], metrics["publishCount"])

    interaction_parts = [metrics.get(field) for field in ["likeCount", "commentCount", "shareCount", "favoriteCount"]]
    metrics["totalInteractions"] = sum(interaction_parts) if all(value is not None for value in interaction_parts) else None
    metrics["engagementRate"] = safe_divide(metrics["totalInteractions"], metrics["playCount"])
    metrics["fanConversionRate"] = safe_divide(metrics["newFollowers"], metrics["playCount"])
    metrics["homepageConversionRate"] = safe_divide(metrics["newFollowers"], metrics["homepageVisits"])
    return {key: to_int_or_float(value) if isinstance(value, float) else value for key, value in metrics.items()}


def combine_metrics(metrics_list: list[dict[str, object]], require_all: bool) -> dict[str, object]:
    combined = {field: None for field in CANONICAL_ACCOUNT_FIELDS.keys()}
    additive = [
        "followersTotal",
        "playCount",
        "homepageVisits",
        "likeCount",
        "commentCount",
        "shareCount",
        "favoriteCount",
        "newFollowers",
        "publishCount",
    ]

    for field in additive:
        values = [item.get(field) for item in metrics_list]
        if not values or (require_all and any(value is None for value in values)):
            combined[field] = None
        else:
            available = [float(value) for value in values if value is not None]
            combined[field] = to_int_or_float(sum(available)) if available else None

    combined["averagePlayCount"] = safe_divide(combined["playCount"], combined["publishCount"])
    interaction_parts = [combined.get(field) for field in ["likeCount", "commentCount", "shareCount", "favoriteCount"]]
    combined["totalInteractions"] = sum(interaction_parts) if all(value is not None for value in interaction_parts) else None
    combined["engagementRate"] = safe_divide(combined["totalInteractions"], combined["playCount"])
    combined["fanConversionRate"] = safe_divide(combined["newFollowers"], combined["playCount"])
    combined["homepageConversionRate"] = safe_divide(combined["newFollowers"], combined["homepageVisits"])
    return {key: to_int_or_float(value) if isinstance(value, float) else value for key, value in combined.items()}


def build_trends(videos: list[dict[str, object]]) -> list[dict[str, object]]:
    by_date: dict[str, list[dict[str, object]]] = defaultdict(list)
    for video in videos:
        key = date_key(video.get("publishTime"))
        if key:
            by_date[key].append(video)

    trend_rows: list[dict[str, object]] = []
    for key in sorted(by_date.keys()):
        records = by_date[key]
        trend_rows.append(
            {
                "date": key,
                "videoCount": len(records),
                "playCount": sum_if_all(records, "playCount"),
                "totalInteractions": sum_if_all(records, "totalInteractions"),
                "newFollowers": sum_if_all(records, "newFollowers"),
            }
        )
    return trend_rows


def percentile(values: list[float], ratio: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * ratio)))
    return ordered[index]


def clip_title(title: str | None, limit: int = 28) -> str:
    if not title:
        return "N/A"
    return title if len(title) <= limit else f"{title[:limit]}…"


def fmt_number(value: object) -> str:
    if value is None:
        return "N/A"
    return f"{int(round(float(value))):,}"


def fmt_rate(value: object) -> str:
    if value is None:
        return "N/A"
    return f"{float(value) * 100:.2f}%"


def first_or_none(records: list[dict[str, object]]) -> dict[str, object] | None:
    return records[0] if records else None


def build_insights(videos: list[dict[str, object]]) -> list[dict[str, str]]:
    playable = [video for video in videos if video.get("playCount") is not None]
    with_engagement = [video for video in videos if video.get("engagementRate") is not None]
    with_conversion = [video for video in videos if video.get("fanConversionRate") is not None]

    insights: list[dict[str, str]] = []

    top_play = first_or_none(sorted(playable, key=lambda item: float(item.get("playCount") or 0), reverse=True))
    if top_play:
        insights.append(
            {
                "type": "爆款视频",
                "title": clip_title(str(top_play.get("videoTitle"))),
                "description": f"{top_play.get('platform')}播放 {fmt_number(top_play.get('playCount'))}，是本次样本最高。建议复盘开头节奏、标题关键词和投放节点，优先做同主题延展。",
            }
        )

    if playable:
        low_pool = with_engagement if with_engagement else playable
        low_candidates = list(low_pool)
        low_candidates.sort(key=lambda item: (float(item.get("engagementRate") or 0), float(item.get("playCount") or 0)))
        low = first_or_none(low_candidates)
        if low:
            insights.append(
                {
                    "type": "低效视频",
                    "title": clip_title(str(low.get("videoTitle"))),
                    "description": f"播放 {fmt_number(low.get('playCount'))}，互动率 {fmt_rate(low.get('engagementRate'))}。建议压缩铺垫，前 3 秒更早给出冲突或结果。",
                }
            )

    if with_engagement and playable:
        play_median = median([float(video.get("playCount") or 0) for video in playable])
        engagement_p75 = percentile([float(video.get("engagementRate") or 0) for video in with_engagement], 0.75)
        candidates = [
            video for video in with_engagement
            if float(video.get("engagementRate") or 0) >= float(engagement_p75 or 0)
            and float(video.get("playCount") or 0) <= play_median
        ]
        candidates.sort(key=lambda item: float(item.get("engagementRate") or 0), reverse=True)
        high_eng_low_play = first_or_none(candidates)
        if high_eng_low_play:
            insights.append(
                {
                    "type": "高互动低播放",
                    "title": clip_title(str(high_eng_low_play.get("videoTitle"))),
                    "description": f"互动率 {fmt_rate(high_eng_low_play.get('engagementRate'))}，但播放仅 {fmt_number(high_eng_low_play.get('playCount'))}。建议换封面标题再投一轮，验证是否是分发入口问题。",
                }
            )

    if with_conversion and playable:
        play_median = median([float(video.get("playCount") or 0) for video in playable])
        conversion_median = median([float(video.get("fanConversionRate") or 0) for video in with_conversion])
        candidates = [
            video for video in with_conversion
            if float(video.get("playCount") or 0) >= play_median
            and float(video.get("fanConversionRate") or 0) <= conversion_median
        ]
        candidates.sort(key=lambda item: float(item.get("playCount") or 0), reverse=True)
        high_play_low_conversion = first_or_none(candidates)
        if high_play_low_conversion:
            insights.append(
                {
                    "type": "高播放低转化",
                    "title": clip_title(str(high_play_low_conversion.get("videoTitle"))),
                    "description": f"播放 {fmt_number(high_play_low_conversion.get('playCount'))}，涨粉转化 {fmt_rate(high_play_low_conversion.get('fanConversionRate'))}。建议在结尾加入更明确的关注理由和账号定位。",
                }
            )

    return insights


def missing_fields_by_platform(videos: list[dict[str, object]], platform_summaries: list[dict[str, object]]) -> list[str]:
    messages: list[str] = []
    by_platform: dict[str, list[dict[str, object]]] = defaultdict(list)
    for video in videos:
        by_platform[str(video.get("platform") or "N/A")].append(video)

    for platform, records in sorted(by_platform.items()):
        missing_video = []
        for field, label in CANONICAL_VIDEO_FIELDS.items():
            if field in {"platform", "accountName", "videoTitle"}:
                continue
            if all(record.get(field) is None for record in records):
                missing_video.append(label)
        if missing_video:
            messages.append(f"{platform}视频级缺失：{'、'.join(missing_video)}。")

    for summary in platform_summaries:
        platform = str(summary.get("platform"))
        if platform == "全平台":
            continue
        metrics = summary.get("metrics", {})
        missing_account = [label for field, label in CANONICAL_ACCOUNT_FIELDS.items() if metrics.get(field) is None]
        if missing_account:
            messages.append(f"{platform}账号级缺失或无法完整计算：{'、'.join(missing_account)}。")

    if not messages:
        messages.append("未发现关键字段缺失。")
    return messages


def data_period(videos: list[dict[str, object]]) -> dict[str, str | None]:
    dates = [date_key(video.get("publishTime")) for video in videos]
    dates = [date for date in dates if date]
    if not dates:
        return {"start": None, "end": None, "label": "N/A"}
    start = min(dates)
    end = max(dates)
    label = start if start == end else f"{start} 至 {end}"
    return {"start": start, "end": end, "label": label}


def parse_workbook(input_path: Path, fixed_url: str) -> dict[str, object]:
    excel = pd.ExcelFile(input_path)
    mappings_report: list[str] = []
    warnings: list[str] = []
    all_videos: list[dict[str, object]] = []
    account_basics: dict[tuple[str, str], dict[str, object]] = {}

    for sheet_name in excel.sheet_names:
        df = pd.read_excel(input_path, sheet_name=sheet_name, header=None, dtype=object)
        videos, basics = parse_video_sheet(sheet_name, df, mappings_report, warnings)
        all_videos.extend(videos)
        if videos:
            platform = infer_platform(sheet_name)
            account_name = str(basics.get("accountName") or videos[0].get("accountName") or "N/A")
            account_basics[(platform, account_name)] = basics
            if sheet_name in {"抖音", "快手"}:
                mappings_report.append(f"{sheet_name} sheet -> {platform}平台数据")

    platform_summaries = aggregate_platforms(all_videos, account_basics)
    trends = build_trends(all_videos)
    period = data_period(all_videos)
    now = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S")

    requested_sheets = {"account_summary", "video_detail", "data_notes"}
    actual_sheets = set(excel.sheet_names)
    if requested_sheets.isdisjoint(actual_sheets):
        warnings.append("Excel 未使用 account_summary / video_detail / data_notes 命名，已按实际 sheet 结构自动识别。")

    if not all_videos:
        warnings.append("未识别到视频明细，网页将只显示可用说明。")

    missing = missing_fields_by_platform(all_videos, platform_summaries)
    if "净增粉丝" in " ".join(missing):
        warnings.append("净增粉丝需要流失或取关数据，本次 Excel 未提供，已保留为 N/A。")

    return {
        "meta": {
            "sourceFile": input_path.name,
            "dataSource": "Excel 上传文件",
            "generatedAt": now,
            "dataUpdatedAt": now,
            "dataPeriod": period,
            "sheets": excel.sheet_names,
            "accountCount": len([item for item in platform_summaries if item.get("platform") != "全平台"]),
            "videoCount": len(all_videos),
            "fixedUrl": fixed_url,
            "missingFields": missing,
            "fieldMappings": sorted(set(mappings_report)),
            "warnings": sorted(set(warnings)),
        },
        "platformSummaries": platform_summaries,
        "videos": all_videos,
        "trends": trends,
        "insights": build_insights(all_videos),
    }


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse Excel into dashboard JSON.")
    parser.add_argument("input", type=Path, help="Excel file path")
    parser.add_argument("--out", type=Path, default=Path("public/data/latest.json"), help="Output latest JSON path")
    parser.add_argument("--history-dir", type=Path, default=Path("public/data/history"), help="History directory")
    parser.add_argument("--fixed-url", default="https://creator-dashboard.rubychoustar.workers.dev", help="Fixed dashboard URL")
    args = parser.parse_args()

    payload = parse_workbook(args.input, args.fixed_url)
    write_json(args.out, payload)

    timestamp = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y%m%d-%H%M%S")
    history_path = args.history_dir / f"{timestamp}-{args.input.stem}.json"
    write_json(history_path, payload)

    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
