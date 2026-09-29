import test from 'node:test';
import assert from 'node:assert/strict';
import { META, CUTS } from '../meta.js';
import { LAYOUTS } from '../layouts.js';
import { layersFor, fontsFor } from '../captions.js';
import { FONTS, CLOCK, SONG, screenText } from '../copy.js';
import { ASPECTS, MIN_TEXT, expandJobs } from '../../factory/engine/variant.js';
import { prepareLayer, layout, approxMeasure } from '../../factory/engine/text.js';

const all = expandJobs(META, { jobs: [] }, { all: true });
const key = f => `${f.weight} ${f.family}`;

// 每个变体 × 每个镜头 × 每个图层，用偏宽的字宽模型排版：必须放得下，且不低于最小字号
test('every caption fits its zone at or above the minimum size', () => {
  let n = 0;
  const bad = [];
  for (const v of all) {
    const [W, H] = ASPECTS[v.ar];
    for (const e of CUTS[v.cut].shots) {
      const row = LAYOUTS[v.ar][e.shot];
      for (const spec of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur, row })) {
        const L = prepareLayer(spec, { lt: 99, zones: row.zones, W, H, minFrac: MIN_TEXT[v.ar] }), r = layout(approxMeasure, L);
        n++;
        if (r.overflow) bad.push(`${v.ar} ${v.theme} ${v.lang} ${v.promo} ${e.shot}.${spec.id}: "${spec.text}"`);
        assert.ok(r.size >= L.min - 1e-9);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(n > 300, `only ${n} layouts checked`);
});

// 引擎只加载 fontsFor 列出的字体和字；漏掉的字会落到系统字体上，本机和云端画出来不一样
test('the fonts list covers every character drawn, in the face it is drawn in', () => {
  for (const v of all) {
    const loaded = new Map(fontsFor(v).map(f => [key(f), new Set(f.text)]));
    const need = (f, s, what) => { const have = loaded.get(key(f)); assert.ok(have, `${v.lang}: ${key(f)} is not loaded (${what})`); for (const ch of s) assert.ok(have.has(ch), `${v.lang} ${v.promo}: "${ch}" of ${what} missing from ${key(f)}`); };
    for (const e of CUTS[v.cut].shots) for (const l of layersFor(v, { name: e.shot, from: e.from ?? 0, dur: e.dur })) need(l.font, l.text.replace(/\s/g, ''), `${e.shot}.${l.id}`);
    // ui.js：日期、城市、天气、星期、日程用本语言的字体；时钟和数字用 Inter 600；音乐小组件的歌名、歌手总是 Inter
    const S = screenText(v), F = FONTS[v.lang];
    need(F.body, S.date + S.cond + S.range, 'date / weather');
    need(F.display, S.city + S.week + S.event, 'widgets');
    need(FONTS.clock, `${CLOCK.hour}:${CLOCK.from}${CLOCK.to}${S.temp}${S.day}${S.time}${SONG.at}${SONG.left}`, 'clock / numbers');
    need(FONTS.en.display, SONG.title.replace(/\s/g, ''), 'song title');
    need(FONTS.en.body, SONG.artist.replace(/\s/g, ''), 'artist');
  }
});
