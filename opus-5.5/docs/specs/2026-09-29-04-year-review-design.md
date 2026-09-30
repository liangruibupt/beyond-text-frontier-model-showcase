# 04 · 有集 Youji Year in Review — Design

Date: 2026-09-29 · Status: storyboard approved by the user; this document fills in the engineering · Branch: `opus55-04-year-review`

## 1. Goal

Fourth case of the Opus 5.5 showcase, scenario B of `factory/Video-Factory.md`: a personalised year-in-review film,
the kind a shopping platform sends every customer in December ("Wrapped" style), rendered from that customer's orders.

It demonstrates two things on top of 03:

1. **Data → film.** Every number, every lit tile, every bar height and the donut's slices come from an order file.
   A different customer is a different JSON file, not a different film.
2. **Factory Level 3.** Claude Opus 5.5 on Bedrock writes the words (the title of the year, the phrasing of each caption,
   the narration and the 双11 recommendation) from statistics that code computed. Code fills in every number, checks
   that the words fit the caption zones and the voice-over slots, and sends failures back for a rewrite. The result is
   cached in the repo, so rendering never calls a model.

The pitch for a platform team is the last step: drop in one customer's orders, run three commands, get that customer's
three videos.

## 2. Decisions (approved storyboard, 2026-09-29)

| Topic | Decision |
|---|---|
| Brand | Fictional platform **有集 Youji** |
| First axis | `user`: `coffee` · `baby` · `camp` · `gamer`, four fictional customers, one order file each |
| Other axes | `lang` (`zh`, `en`), `cut` (`15`, `6`), `promo` (`none`, `1111`, `launch`), per the fixed deliverables |
| Scene axes | `['user']` |
| Shots | `open` · `count` · `months` · `top` · `title` · `end` (§4) |
| Grid | 80 bpm, a 3 s bar, every hit on a 0.75 s beat |
| Level 3 split | Code computes all numbers. The model gets the statistics and writes only words, with placeholders where numbers go. Fit is checked with `approxMeasure`; a failure goes back to the model. Output is committed as `stories/<user>.json` |
| Voice-over | Kokoro, voices chosen by audition (ask the user before any Kokoro call) |
| Rendering | Cloud GPU via `factory/cloud.mjs` (built and verified on 2026-09-29) |
| Deliverables | 4 users × 3 videos = 12 |

## 3. Scope

**In scope**
- Engine: `factory/engine/say.js` (numbers, years and months read aloud; `sayNum` moves here from 03),
  `factory/engine/story.js` (pure helpers for Level 3) and `factory/story.mjs` (the Bedrock step). Each has engine tests.
- Film `04-year-review/`: order generator and four order files, statistics, catalogue, stories, six shots, procedural
  models (tile, parcel, bar, donut, five product kinds, cart, medal), per-user palettes, score with data-driven notes,
  voice-over, the three promo end cards.
- Chinese README for the film; a row in the showcase index; the factory README and `new-film` skill gain the Level 3
  contract.

**Out of scope**
- Real customer data, real platforms or trademarks.
- 9:16 review (rough rows only, as in every film), languages beyond zh/en.
- An automated production pipeline (S3 in, Batch/ECS out). `cloud.mjs` renders batches; a queue-driven pipeline is a
  separate piece of work if the user wants it.
- Prompt → storyboard (the model writing shots). Level 3 here means data → words; the storyboard stays human-approved.

## 4. The film

### 4.1 Shots (15 s cut)

Numbers in examples are for `coffee` (林一); all of them are computed (§5).

| Time | Shot | Picture | Caption | Hit |
|---|---|---|---|---|
| 0–2.25 | `open` | 365 rounded tiles stand in a wall, backs to the camera, laid along the strokes of the year's four digits. They flip in day order along the strokes (0.15–1.85 s), so the year writes itself; days with orders face the camera in the accent colour and glow, the rest in the user's base tone, a step darker than the background (a step lighter on the dark palette). The backs are close to the background, so before the flips the year is only a faint ghost on the wall. Slow push-in | 林一的 2026 / 有集年度购物报告 | — |
| 2.25–4.5 | `count` | Continuous camera. The lit tiles lift off the wall on staggered arcs and land as parcels in a pile; the pale tiles sink away. A big number rolls from 0 to the order count and lands at 0.75 s | 146 (rolling) / model line that annotates the big number, no placeholder | 3.0 land |
| 4.5–7.5 | `months` | Hard cut on the bar line. Twelve bars rise one after another (0.1–1.3 s), heights from the monthly counts; the busiest bar peaks and glows at 1.5 s. Month numbers 1–12 under the bars are made of small tiles in the same stroke font | model line with `{month}` and `{monthOrders}` | 6.0 peak |
| 7.5–10.5 | `top` | Continuous camera. The bars sink while donut slices (categories, sized by order share) sweep up out of the floor (0–0.9 s). The largest slice slides out (0.9–1.2 s), the favourite product rises from it and flies an arc into a shopping cart, landing at 1.5 s | model line with `{top}` and `{repeat}` | 9.0 cart |
| 10.5–12 | `title` | Flash cut. A medal drops, lands at 0.25 s, settles and turns to face the camera; a few sparkles | 年度称号 / the model's title | 10.5 medal |
| 12–15 | `end` | Dissolve. `none` and `launch`: the medal to one side, the logo and the promo lines. `1111`: the recommended product on a turntable beside the price card | §7.3 | 12.0 logo |

The `open` digits come from the orders' year, drawn from a stroke font of the ten digits (lines and arcs in a unit box,
`js/digits.js`), sampled by arc length into 365 positions in two lanes. Nothing depends on canvas font rasterising.

### 4.2 Cuts as data

```js
15: { shots: [
  { shot: 'open', dur: 2.25 }, { shot: 'count', dur: 2.25 }, { shot: 'months', dur: 3 }, { shot: 'top', dur: 3 },
  { shot: 'title', dur: 1.5, transition: { type: 'flash', dur: 0.2 } },
  { shot: 'end', dur: 3, transition: { type: 'dissolve', dur: 0.4 } } ],
  hits: { land: 3.0, peak: 6.0, cart: 9.0, medal: 10.5, logo: 12.0 }, cover: 9.4 },
6: { shots: [
  { shot: 'count', dur: 1.5 },
  { shot: 'top', dur: 1.5, from: 0.75, transition: { type: 'flash', dur: 0.2 } },
  { shot: 'end', dur: 3, transition: { type: 'dissolve', dur: 0.3 } } ],
  hits: { land: 0.75, cart: 2.25, logo: 3.0 }, cover: 3.4 },
```

`open → count` and `months → top` are cuts in the edit list but continuous on screen: the second shot starts from the
first one's final pose and scene state (a `blend` camera intent from the previous framing), so the join is invisible.
Events inside shots are in `meta.js` as `EV` (shot-local seconds), shared by the shots, the captions and the score.

## 5. Data

### 5.1 Users — `users.js`

| id | Name | Story in the data | Palette |
|---|---|---|---|
| `coffee` | 林一 Lin Yi | 146 orders; November busiest (38, 双11); coffee beans bought 13 times; many orders before 9 am | espresso, cream, caramel |
| `baby` | 陈安 Chen An | ~210 orders; March busiest (the baby arrives); diapers the favourite; late-night orders | peach, mint, soft navy |
| `camp` | 周野 Zhou Ye | ~70 orders; May busiest (五一 trips); gas canisters; weekend-heavy | forest, orange, sand |
| `gamer` | 许星 Xu Xing | ~100 orders; November busiest; energy drinks; mostly after midnight | violet, neon cyan, ink |

Each entry holds the name in both languages, the palette, and the generator profile (§5.2). Colours are per user, so
`user` is the only scene axis.

### 5.2 Orders — `data/<user>.json`, generated by `data/gen.mjs`

An order is `{ id, at, item, qty, paid }`: `at` is local time `2026-11-11T00:03`, `item` a catalogue id, `paid` CNY.
The file is the input a real platform would supply, so the film reads nothing else about the customer.

The four files are generated from a profile per user (`users.js` `gen`) and committed. The generator is exact: the
profile gives the orders per month and the orders per item, both adding up to the total, so the totals, the busiest
month and the favourite come out as designed. The seed (`factory/engine/rng.js`) only decides which order falls in
which month, the day (with a weekend probability and optional spike days such as 11-11), the time (from time-of-day
weights) and the quantity. Orders on 11.1–11.11 and 6.1–6.18 are paid at the deal price. A test regenerates the files
and compares them byte for byte, and checks that the favourite item and the largest category are strictly the largest,
so 最爱 is true.

### 5.3 Statistics — `stats.js` (pure, shared by the page, the tests and the story step)

`statsOf(orders, catalog)` returns the **facts**:
- `year`; `orders`; `activeDays` and the per-day set (for `open`); `months[12]` and `busiest { month, orders }`
  (ties go to the earlier month);
- `categories` sorted by orders, each `{ id, orders, share }`; `top { category, item, count, repeat }`, where the
  favourite item is the most-ordered item of the largest category and `repeat = count − 1` (the first purchase is not a
  re-buy);
- colour for the model: `spend`, `lateNight` (orders 00:00–05:00), `earlyBird` (05:00–09:00), `weekendShare`,
  `longestStreak` (consecutive days with orders), `firstOrder`, `biggestDay`.

The colour facts never appear on screen as numbers. They are there so the model can find a title with some truth in
it ("深夜补给站" for someone who orders at 2 am).

### 5.4 Catalogue — `catalog.js`

About twenty fictional items in six to eight categories. Each has `{ id, cat, name: {zh, en}, kind, colors,
price: {CNY, USD}, deal: {CNY, USD} }`. `kind` is one of the procedural models: `pouch` (coffee beans, nuts), `box`
(drip bags, a controller, a lantern), `pack` (diapers, wipes, tissues), `can` (gas canister, energy drink) and `bottle`
(baby bottle, detergent). Category names are the short spoken forms used in captions (咖啡豆 / coffee beans).

## 6. Level 3: the story step

### 6.1 Who does what

| Code | Model |
|---|---|
| All numbers: counts, months, shares, prices | The title of the year, zh and en |
| Which days light up, bar heights, slice sizes | The phrasing of the three stat captions, around placeholders |
| Filling placeholders (digits on screen, words in narration) | Two narration lines, around placeholders |
| Fit and speech-length checks, the retry loop | The 双11 pick, from the catalogue, with a one-line reason (kept for review, not shown) |
| Brand lines, labels, promo cards (templates in `copy.js`) | — |

### 6.2 Fields and placeholders

The model returns one object through a tool call (`write_story`, JSON schema input), so there is no free-text
parsing. `toolChoice` is `auto`: Bedrock Converse rejects a forced `tool`/`any` choice for `us.anthropic.claude-opus-5-5`,
so the system prompt asks for the call, and a reply that is only text counts as a failed attempt and is retried with a
nudge:

```json
{ "title":    { "zh": "咖啡续命官", "en": "Chief Caffeine Officer" },
  "captions": { "count":  { "zh": "单，大多在早饭前", "en": "orders, most before breakfast" },
                "months": { "zh": "{month}最忙：{monthOrders} 单", "en": "Busiest month: {month}, {monthOrders} orders" },
                "top":    { "zh": "最爱{top}，回购 {repeat} 次", "en": "Your #1: {top}, {repeat} repeat buys" } },
  "vo":       { "intro": { "zh": "{name}，{year}年，你在有集下单{orders}次。", "en": "{name}, this year you ordered {orders} times." },
                "top":   { "zh": "最爱的还是{top}，回购了{repeat}次。", "en": "{top}, again and again: {repeat} times." } },
  "pick": "cf-geisha", "why": "…" }
```

Required placeholders per field: `count` none (the rolling number sits right above it, so the line only annotates it; decided 2026-09-29); `months` {month} {monthOrders}; `top` {top} {repeat};
`vo.intro` {name} {orders} ({year} optional); `vo.top` {top} {repeat}. Titles take none.

Values differ by medium. On screen: `146`, `11月` / `November`, `咖啡豆` / `coffee beans`. In narration they are spelt
out, because Kokoro reads digits unreliably: `一百四十六` / `one hundred forty-six`, `十一月`, `二零二六` /
`twenty twenty-six` (`factory/engine/say.js`).

### 6.3 Checks (the film's `check`, run on every attempt and in the tests)

1. Every field present; exactly the required placeholders, no unknown ones.
2. **No numbers written by the model**: no digits anywhere; in English no number words (`one` … `twenty`, `hundred`,
   `thousand`, `dozen`, …); in Chinese none of 〇零两二三四五六七八九十百千万. (一 is allowed; it is in too many
   ordinary words.) Numbers only enter through placeholders, so a hallucinated statistic cannot reach the screen.
3. Title: zh 2–6 characters, en at most 4 words; no punctuation.
4. **Fit**: each caption, filled in, is laid out with `approxMeasure` in its zone for every variant of that user in
   `16x9`, `1x1` and `9x16`. It must not overflow and must keep at least 85% of its design size. The error says which
   zone and how many characters to cut.
5. **Speech length**: each narration line, filled in, is estimated at 4.8 zh characters or 4 English syllables per
   second, plus 0.15 s per pause. The estimate may be up to the slot × `MAX_RATE` (1.15, from `vo.mjs`): measured
   against 03's Kokoro clips it runs 5–29% long in Chinese, and `vo.mjs` measures the real clip later and can speed
   up to 1.15×, so this only has to catch clearly long lines. The budgets in the prompt use the plain slot.
6. `pick` is a catalogue id.

The prompt also carries **budgets** computed from the same layouts, such as "count.zh: at most 9 characters besides
the placeholders". The model usually gets it right first time, and the check is the backstop.

### 6.4 The call — `factory/story.mjs`

```
node factory/story.mjs <film> [--user coffee] [--force] [--dry] [--model us.anthropic.claude-opus-5-5] [--tries 3]
```

- It reads the film's `story.js`, which exports `STORY = { axis, ids, facts(id), schema, system, prompt(id), check(id, story) }`.
  The engine owns the loop, the Bedrock call, caching and the file format. The film owns the facts, the fields, the
  prompt and the checks.
- For each id, it skips the story if `stories/<id>.json` exists, its `key` matches `storyKey(facts)` and it passes
  `check`. Otherwise it calls Bedrock.
- The call is `aws bedrock-runtime converse --cli-input-json file://…`, with the system prompt, the user message (facts,
  catalogue, budgets, rules), `toolConfig` holding the one tool, and `toolChoice: auto` (forcing it is rejected for
  opus-5.5). Going through the AWS CLI means no SDK dependency, the same credentials as the rest of the showcase
  (`AWS_REGION`, plus `AWS_PROFILE` off an instance-role machine), and no key in the repo.
- If `check` fails, the errors go back as a `toolResult` with `status: "error"` on the same conversation, and the model
  tries again, up to `--tries`. If the last attempt also fails, the step exits 1 and names the fields.
- `--dry` prints the system prompt and the first user message, and calls nothing.
- The output is `stories/<id>.json`: `{ id, key, model, tries, usage, story }`, pretty-printed and committed. It holds
  no timestamps, so rerunning with `--force` shows a real diff only when the words changed.
- The Bedrock call is injected, so the tests run the loop with a fake model (bad attempt, then good) and never touch AWS.

### 6.5 Staleness is loud

The page asserts in `setup` that the user's story exists and its key matches the facts. If not, it throws
`story for coffee is missing or stale: node factory/story.mjs 04-year-review --user coffee`. So the preview,
`check.mjs` and `render.mjs` all stop on it. The film tests also run `check` on every committed story, so a layout
change that makes a story overflow fails `npm test` with the same command.

Until the user approves the Bedrock calls, the build uses hand-written stories with `"model": "draft"`. They pass the
same checks. The acceptance criteria require every story to come from the model.

### 6.6 A new customer

1. Put `data/<id>.json` in place, add the user to `users.js` (name, palette) and `meta.js` axis values.
2. `node factory/story.mjs 04-year-review --user <id>`: one Bedrock call, usually one attempt.
3. `node factory/vo.mjs 04-year-review --user <id>`: the narration.
4. `node factory/cloud.mjs render 04-year-review --user <id>`: three videos.

## 7. Variants and copy

### 7.1 Axes and names

`META.axes = { user: ['coffee', 'baby', 'camp', 'gamer'], lang: ['zh', 'en'], cut: [15, 6], promo: ['none', '1111', 'launch'] }`,
`sceneAxes: ['user']`, file name `youji_${user}_${cut}s_${ar}_${lang}[_${promo}][_novo]`. The manifest is 03's with
`sku` renamed to `user`.

### 7.2 Fonts

zh: Noto Sans SC 900 (display) and 500 (body). en: Inter 800 and 500. The rolling number uses Inter 800 in both
languages, and its subset always includes `0–9`, because the rolling number shows digits that are in no caption.
It rolls through values no wider than the final one, so its fitted size never changes mid-roll. Prices use the
language's display font: the zh price tag reads 到手价 ¥69, and Inter has no CJK glyphs (a fallback face would fail
the page's font-weight check).

### 7.3 End card and promos (templates, not model-written)

| promo | Lines |
|---|---|
| `none` | 有集 / YOUJI · 记得你的每一次喜欢 / Every like, remembered · ［查看完整报告］/ ［See your year］ |
| `launch` | ribbon 年度报告上线 / Your Year in Review is here · 分享得 5 元券 / Share it for a $5 coupon · ［查看我的］/ ［See yours］ |
| `1111` | ribbon 双11 为你推荐 / 11.11 picked for you · the pick's name · 到手价 ¥69 (pop) · 日常价 ¥99 (struck through) |

The 1111 card is delivered as 1:1 at 1080 × 1080, so its zones are sized for that first.

### 7.4 Voice-over

| Line | Slot (cut s) · max | Source |
|---|---|---|
| `intro` | 0.3 · 4.6 | model, `vo.intro`; may run into the start of `months` (the peak lights at 6.0) |
| `top` | 7.55 · 2.9 | model, `vo.top`; done before the flash at 10.5 |
| `end_<promo>` | 11.9 · 2.8 | template: 有集，记得你的每一次喜欢。/ 有集年度报告，现已上线。/ 双十一，到手{deal}元。 |
| 6 s `one_<promo>` | 0.5 · 5.1 | template: {name}，为你挑的{pick}，双十一到手{deal}元。 and the none/launch forms |

The slots were widened from the storyboard's after timing 03's real clips: the storyboard's own example lines did not
fit. The 15 s 11.11 end line names only the price, as 03's does; the product's name is on the card. The 6 s line names
the pick as 为你挑的 / picked for you, not 你爱的: the pick is often something the customer never bought.

Line ids are `${user}_${lang}_${cut}_${key}`, so each id has one text. `vo: off` gives no lines. Voices are picked with
`vo.mjs --audition` (candidates as in 03). Starting points are `zm_yunxi` and `bf_emma`, 03's voices, pending the
audition.

## 8. Look

- **Style:** soft "clay toy" 3D. Rounded, bevelled shapes. `MeshPhysicalMaterial` with a little clearcoat on tiles and
  parcels. A studio environment from `RoomEnvironment`. A gradient background in the user's palette. Soft shadows on
  a shadow-catcher floor.
- **Models** (`js/models/*.js`, all procedural, no assets):
  - tile: rounded box, front and back materials;
  - parcel: box with a tape band;
  - bar: rounded column;
  - donut slice: extruded ring sector with rounded edges;
  - products `pouch`, `box`, `pack`, `can`, `bottle`, parametric, with label colours from the catalogue;
  - cart: wire basket from tubes, handle and wheels;
  - medal: bevelled disc, a raised star, a two-strip ribbon.
- **Instancing:** the 365 tiles, the parcels and the month-label tiles are `InstancedMesh`. Their per-frame matrices are
  written from closed-form functions of `lt`, with no per-frame state. `reset` restores visibility and the subjects'
  poses.
- **Tone:** PBR Neutral (the engine's `tone: 'neutral'`, Khronos' tone mapper for e-commerce) instead of AgX. AgX greys
  and desaturates pastels (the coffee cream #f6ead8 comes out #c7c2bc), and all four palettes are pastel or saturated.
  The background gradient goes through the engine's `ungrade`: each row stores the linear colour that the grade turns
  back into the palette colour, so the background shows exactly the designed hex values. Bloom's threshold sits above
  the background's brightest row.
- **Post:** the engine defaults with more bloom on lit tiles and the medal, and a light grain. The flash is the engine's.
- **Framing:** each shot has a `VIEW` row (box, pitch, yaw range, fov) in `meta.js`, as in 03. The layouts put the
  subject beside the text in 16:9 and above it in 1:1.
- **Determinism:** randomness comes from `rng.js`; sparkles use `particles.drift`. check.mjs's forward and backward pass
  covers the continuous joins.

## 9. Architecture

```
factory/
  engine/say.js           sayNum (0–99 999), sayYear, sayMonth, MONTHS: engine, used by 03 and 04
  engine/story.js         storyKey(facts), fill(tpl, values), slotsOf(tpl), writtenNumbers(s, lang), speechSec(s, lang)
  engine/grade.js         the grade in JS (agx, neutral, grade, ungrade) and the tone GLSL that post.js uses
  story.mjs               the Bedrock step (§6.4); top level, like cloud.mjs
  test/say.test.mjs, story.test.mjs, grade.test.mjs
04-year-review/
  meta.js                 axes, cuts, EV, VIEW, BOX, fileName
  film.js                 the contract object
  users.js catalog.js     people and products (data)
  data/gen.mjs, data/<user>.json
  stats.js                facts from orders
  story.js                STORY for factory/story.mjs: facts, schema, system, prompt, check
  stories/<user>.json     committed model output
  copy.js captions.js promos.js layouts.js
  index.html
  js/digits.js js/models/*.js js/shots.js js/score.js js/scene.js
  assets/vo/              committed clips
  test/*.test.mjs
  README.md
```

**Engine changes are one commit of their own, with their tests.** `03-perfume/copy.js` imports `sayNum` from
`factory/engine/say.js` instead of defining it. `post.js` gains a `tone` option (`agx`, the default, or `neutral`); the
AgX constants and GLSL move to `grade.js` unchanged, so 03's pixels don't change. Changing `factory/engine` changes every film's render fingerprint, so
03's existing renders count as stale and would re-render on the next batch (5 minutes on the cloud). 03 doesn't need a
new batch, so nothing is rerun now.

`film.js` gains no new contract fields. The story is ordinary film data that the captions and `voLines` read. Only
`factory/story.mjs` knows about `story.js`.

## 10. Audio — `js/score.js`

- **Key and tempo:** D major, 80 bpm, a 3 s bar; notes on the sixteenth grid.
- **open:** a rising pluck arpeggio over the tile flips, one note per 0.1875 s. The pitch follows the tiles' position
  along the year.
- **count:** clicks that speed up with the rolling number (the click times come from the same easing), then a bell on
  the landing (3.0).
- **months:** a pad enters. Each bar's rise plays a pluck whose pitch is that month's count mapped onto the pentatonic
  scale, so the chart is also a melody and every user's melody is different. The peak gets a bell (6.0).
- **top:** a noise whoosh on the product's arc; click and plink on the cart landing (9.0).
- **title:** a bell chord with the flash (10.5).
- **end:** a three-note brand motif (12.0), then the fade.
- **Mixing:** as in 03: the music bus ducks under speech; −14 LUFS and true peak ≤ −1 dBTP after encoding.

## 11. Rendering and review

- **Previews:** local. `sheet.mjs`, `snap.mjs` and the live page at `http://127.0.0.1:8765/04-year-review/?ar=16x9`.
- **Batch:** `node factory/cloud.mjs up`, `run node factory/check.mjs 04-year-review`, `render 04-year-review`, `down`.
- **Gallery:** `factory/gallery.html?film=04-year-review`.

## 12. Testing and acceptance

**Engine tests:**
- say.js: sayNum and sayYear against tables, including 0, 10, 11, 20, 101, 110, 1000, 1010 and 2026;
- story.js: fill, slotsOf, writtenNumbers for both languages, including 一 allowed and 两 rejected, and speechSec
  monotonic;
- grade.js: the JS grade matches the shader's steps; Neutral against reference values; `ungrade` round-trips palette
  colours within half a code value under five grades, and gets closer for colours a grade can't show;
- story.mjs: with a fake model, a bad-then-good run writes the good story and records tries = 2; three bad attempts
  exit 1 naming the field; a current story is skipped; `--dry` makes no call.

**Film tests:**
- the generator reproduces the four committed files; coffee's facts are 146 / November 38 / repeat 12;
- every committed story is current and passes `check`;
- text fit for every variant (the check in §6.3 plus the fixed captions and promo cards);
- the tile positions lie along the strokes, stay inside the box and never overlap, for every year 2020–2039;
- the flips run in day order inside their window, a flipping tile stays inside the box, and each user's wall has one
  lit tile per active day;
- the subjects fill their framing boxes;
- every hit is on the 0.75 s grid; a mix renders the same samples twice;
- every voice-over line has a current clip inside its slot.

**Pre-flight:** `node factory/check.mjs 04-year-review` passes on the cloud GPU.

**Acceptance:**
1. The page previews every variant of the four users.
2. The default batch renders the 6 MP4s in `manifest.json` (16x9 zh 15 s none for coffee and baby, 16x9 en 15 s launch
   for camp and gamer, 1x1 zh 6 s 1111 for baby and gamer), and they pass the loudness and ffprobe checks.
3. Every story was written by the model (`model` is not `draft`), in at most three attempts, and passes its checks.
4. `npm test` passes.
5. The film README is in Chinese, the showcase index has a row, and the factory README and skill document Level 3.

## 13. Risks

| Risk | Mitigation |
|---|---|
| The model writes numbers or overlong copy | Placeholders only; digit and number-word check; budgets in the prompt; errors fed back; three tries |
| The model's Chinese title reads oddly | Stories are committed and reviewed like any copy; rerun one user with `--force`, or edit the JSON (it stays current, because the key is the facts) |
| Kokoro misreads a name or 二零二六 | The audition covers the intro line; reword the template or the story, then regenerate that clip |
| 365 instanced tiles plus shadows are slow at 1080p | One `InstancedMesh`, one shadow-casting light, a small shadow map; measure with check.mjs's speed line |
| The continuous joins show a pop (state or pose mismatch) | The second shot builds its start from the first shot's end functions; a test compares the two poses and tile matrices at the join |
| Years with two 1s (2041) crowd the short strokes | The digit tests cover 2020–2039; a later year needs a wider 1 or smaller tiles first |
| Engine change makes 03 stale | Expected; noted in the commit; 03 re-renders only if its own content changes |

## 14. Build order

1. Engine: `say.js` (03 switches to it), `story.js`, `story.mjs` with a fake-model test. Factory README and skill:
   the Level 3 section.
2. Data: `users.js`, `catalog.js`, generator and the four order files, `stats.js`; tests.
3. Scaffold: meta, layouts, fonts, draft stories, `story.js` with its checks, placeholder shots (`fit` on each box plus
   the captions), text-fit test, `check.mjs` green.
4. Shots in order, reviewed with sheets: `open` → `count` → `months` → `top` → `title` → `end`, including the three
   promo cards.
5. Score and sound.
6. Bedrock: `story.mjs --dry` for review, then the real call (after the user approves), and review of the four
   stories.
7. Voice-over: audition, then the user picks voices, then generation (after the user approves).
8. Cloud render, gallery review, README, index row.
