#!/usr/bin/env python3
"""build_prompt_atlas.py — awesome-opus5-5-videos 提示词速查表生成器。

输入：videos.json（上游 data/videos.json）、groups.json（按提示词去重后的分组）、out1..6.json（逐条分类）
输出：opus55-prompt-atlas.md（速查表）+ opus55-prompt-atlas.csv（全量，可筛选）
用法：python3 build_prompt_atlas.py <工作目录> <输出目录>
"""
import csv, collections, json, sys
from pathlib import Path

W, OUT = Path(sys.argv[1]), Path(sys.argv[2])
REPO = "https://github.com/yihui-dev/awesome-opus5-5-videos/blob/main/prompts"
groups = {g["id"]: g for g in json.loads((W / "groups.json").read_text())}
rows = []
for f in sorted(W.glob("out*.json"), key=lambda p: int("".join(c for c in p.stem if c.isdigit()) or 0)):
    rows += json.loads(f.read_text())
rows.sort(key=lambda r: r["id"])
for r in rows:
    g = groups[r["id"]]
    r.update(category=g["category"], tech=g["tech"], n=g["n_videos"], authors=g["authors"],
             skillry=g["skillry"], prompt_url=f"{REPO}/{g['slug']}.md", partial=g["partial"])

CAT_ZH = {"motion": "动效", "explainer": "讲解", "3d": "3D", "interactive": "交互"}
Q_RANK = {"完整可复用": 0, "只给方向": 1, "部分公开": 2}
cell = lambda s: str(s).replace("|", "／").replace("\n", " ").strip()
link = lambda r: f"[{cell(r['title_zh'])}]({r['prompt_url']}) · [看片]({r['skillry']})"


def score(r):
    """代表作排序：可复用程度优先，其次是同一提示词被多少人复刻（热度），最后提示词越完整越好。"""
    return (Q_RANK.get(r["prompt_quality"], 3), -r["n"], r["partial"])


by_cap = collections.defaultdict(list)
for r in rows:
    for c in r["capability"]:
        by_cap[c].append(r)
cap_order = sorted(by_cap, key=lambda c: (c == "其他", -len(by_cap[c])))
tec_count = collections.Counter(t for r in rows for t in r["techniques"])

# 业务需求 → 能力映射（面向 opus-5.5 showcase 这类商业短片任务）
BRIEFS = [
    ("新品发布 / SaaS 上线快剪", ["产品发布/营销", "UI/交互演示", "动态排版"]),
    ("电商大促 / 直播秒杀 / 数据大屏", ["数据可视化", "产品发布/营销", "动态排版"]),
    ("品牌片尾 / Logo 演绎", ["品牌/Logo演绎", "动态排版"]),
    ("产品 3D 展示 / 开箱 / 物流旅程", ["3D场景/建筑", "产品发布/营销", "粒子/物理模拟"]),
    ("科普讲解 / 原理动画", ["科普讲解", "数据可视化", "模拟/仿真"]),
    ("视觉特效 / 抓眼球开场", ["着色器/视觉特效", "粒子/物理模拟", "动效作品集"]),
    ("音乐 MV / 音画同步", ["音乐可视化/音画同步"]),
    ("历史场景 / 地理重建", ["历史/地理重建", "3D场景/建筑"]),
    ("角色故事 / 叙事短片", ["角色/叙事动画"]),
    ("可玩 Demo / 交互展示", ["游戏/可玩", "UI/交互演示"]),
]

md = []
P = md.append
P("# Opus 5.5 爆款视频提示词速查表\n")
P(f"来源：[yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)（`data/videos.json`）。"
  f"共 **{sum(r['n'] for r in rows)} 个视频 / {len(rows)} 条不同提示词**（同一提示词被多人复刻的已合并，`复刻数` 列标出）。"
  "这些视频都是让 Claude Opus 5.5 用代码（HTML / Canvas / SVG / Three.js / GLSL）写动画再录屏。\n")
P("分类由 Opus 5.5 逐条阅读提示词完成，只依据提示词文本，**没有逐个看片**；`看片` 链接是 Skillry 上原片与复刻的对照页。"
  "可复用程度：**完整可复用** = 提示词本身就能直接跑；**只给方向** = 一句话命题，效果靠模型发挥；**部分公开** = 作者只放出了一部分。\n")
P("重新生成：在本目录运行 `python3 build_prompt_atlas.py data .`。分类数据在 `data/`（`groups.json` 为按提示词去重后的上游数据，`out1..6.json` 为逐条分类）；"
  "上游新增视频时，重新拉 `data/videos.json`、对新增提示词做同样的分类再追加进 `out*.json` 即可。全量明细见同目录 `opus55-prompt-atlas.csv`。\n")

P("## 1. 按新任务查（业务需求 → 先看哪几条）\n")
P("| 新任务类型 | 对应能力 | 先看这几条（可复用优先） |\n|---|---|---|")
used = collections.Counter()   # 同一条最多出现在 2 个任务里，避免几条「万金油」霸屏
for brief, caps in BRIEFS:
    seen, picks = set(), []
    # 按能力优先级取：先满足第一能力（主能力命中越多越靠前），再补后面的能力
    for ci, c in enumerate(caps):
        cand = sorted(by_cap.get(c, []), key=lambda r: (used[r["id"]] >= 2, -sum(x in caps for x in r["capability"]), score(r)))
        for r in cand:
            if len(picks) >= (3 if ci == 0 else 4):
                break
            if r["id"] in seen or used[r["id"]] >= 2:
                continue
            seen.add(r["id"]); picks.append(r)
    for r in picks:
        used[r["id"]] += 1
    P(f"| {brief} | {' · '.join(caps)} | {'<br>'.join(link(r) for r in picks)} |")
P("")

P("## 2. 能力总览\n")
P("| 能力 | 提示词数 | 最常用手法 | 代表作（可复用优先） |\n|---|---:|---|---|")
for c in cap_order:
    rs = by_cap[c]
    top_t = "、".join(t for t, _ in collections.Counter(t for r in rs for t in r["techniques"]).most_common(4))
    P(f"| {c} | {len(rs)} | {top_t} | {'<br>'.join(link(r) for r in sorted(rs, key=score)[:3])} |")
P("")

P("## 3. 手法出现频次（出彩视频最常要求的视觉手法）\n")
P("| 手法 | 提示词数 |\n|---|---:|")
for t, n in tec_count.most_common():
    P(f"| {t} | {n} |")
P("")

P("## 4. 全量对照表（按能力分组）\n")
P("同一条提示词有多个能力时，只放在第一个能力下。\n")
placed = set()
for c in cap_order:
    rs = [r for r in sorted(by_cap[c], key=score) if r["capability"][0] == c and r["id"] not in placed]
    if not rs:
        continue
    P(f"### {c}（{len(rs)}）\n")
    P("| 视频 | 类别 | 出彩点 | 手法 | 适合我们做 | 可复用 | 复刻数 | 备注 |\n|---|---|---|---|---|---|---:|---|")
    for r in rs:
        placed.add(r["id"])
        P(f"| {link(r)} | {CAT_ZH.get(r['category'], r['category'])} | {cell(r['highlights_zh'])} | {'、'.join(r['techniques'])} | "
          f"{cell(r['reuse_for_us'])} | {r['prompt_quality']} | {r['n']} | {cell(r['keep_note'])} |")
    P("")

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "opus55-prompt-atlas.md").write_text("\n".join(md) + "\n", encoding="utf-8")
with open(OUT / "opus55-prompt-atlas.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["id", "title_zh", "category", "capability", "highlights_zh", "techniques", "reuse_for_us",
                "prompt_quality", "n_videos", "keep_note", "tech_tags", "prompt_url", "skillry_url", "slug"])
    for r in rows:
        w.writerow([r["id"], r["title_zh"], r["category"], "、".join(r["capability"]), r["highlights_zh"],
                    "、".join(r["techniques"]), r["reuse_for_us"], r["prompt_quality"], r["n"], r["keep_note"],
                    " ".join(r["tech"]), r["prompt_url"], r["skillry"], r["slug"]])
print(f"rows {len(rows)} · placed {len(placed)} · md {len(md)} lines")
