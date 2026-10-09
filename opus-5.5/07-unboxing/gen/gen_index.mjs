// gen_index.mjs — build out/films/<name>.json sidecars + out/index.json for the
// method-2 (LTX) silk-scarf films, matching the factory render.mjs schema so
// factory/gallery.html?film=07-unboxing lists them.
//
//   FFMPEG=/abs/ffmpeg FFPROBE=/abs/ffprobe node gen_index.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FF = process.env.FFMPEG || 'ffmpeg';
const FP = process.env.FFPROBE || 'ffprobe';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'out');
const FILMS = path.join(OUT, 'films');

// kaiwu_<scarf>_<cut>s_<ar>_<lang>[_<promo>].mp4
function parseVariant(file) {
  const m = file.match(/^kaiwu_([a-z]+)_(\d+)s_(\d+x\d+)_([a-z]+)(?:_([a-z0-9]+))?\.mp4$/);
  if (!m) return null;
  return { item: m[1], cut: +m[2], ar: m[3], lang: m[4], promo: m[5] || 'none' };
}

function probe(file) {
  const r = spawnSync(FP, ['-v', 'error', '-count_packets', '-show_entries',
    'stream=codec_type,width,height,r_frame_rate,nb_read_packets:format=duration,size',
    '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find(s => s.codec_type === 'video');
  const [a, b] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  return {
    duration: +j.format.duration, bytes: +j.format.size, width: v?.width, height: v?.height,
    fps: b ? a / b : 0, frames: +(v?.nb_read_packets ?? 0),
    audio: j.streams.some(s => s.codec_type === 'audio'),
  };
}

function measureLoudness(file) {
  const r = spawnSync(FF, ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1));
    return { I: +j.input_i, TP: +j.input_tp };
  } catch { return null; }
}

function cover(file, out, dur) {
  const t = Math.max(0.5, Math.min(dur * 0.4, dur - 0.2));
  const r = spawnSync(FF, ['-y', '-ss', `${t}`, '-i', file, '-frames:v', '1',
    '-vf', 'scale=640:-1', '-q:v', '3', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cover ${file}: ${r.stderr.trim().split('\n').slice(-2).join(' | ')}`);
}

const files = fs.readdirSync(FILMS).filter(f => f.endsWith('.mp4') && f.startsWith('kaiwu_')).sort();
let n = 0;
for (const file of files) {
  const variant = parseVariant(file);
  if (!variant) { console.log(`SKIP (unparsed): ${file}`); continue; }
  const name = file.replace(/\.mp4$/, '');
  const abs = path.join(FILMS, file);
  const pr = probe(abs);
  const coverFile = `${name}_cover.jpg`;
  cover(abs, path.join(FILMS, coverFile), pr.duration);
  const loud = pr.audio ? measureLoudness(abs) : null;
  const meta = {
    name, file: `films/${file}`, cover: `films/${coverFile}`, variant,
    duration: Math.round(pr.duration * 100) / 100, width: pr.width, height: pr.height,
    fps: Math.round(pr.fps * 1000) / 1000, frames: pr.frames, bytes: pr.bytes,
    audio: pr.audio,
    lufs: loud && Number.isFinite(loud.I) ? Math.round(loud.I * 10) / 10 : null,
    tp: loud && Number.isFinite(loud.TP) ? Math.round(loud.TP * 10) / 10 : null,
    method: 'ltx-2.5',
  };
  fs.writeFileSync(path.join(FILMS, `${name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  n++;
  console.log(`OK ${name}  ${pr.width}x${pr.height} ${meta.duration}s ${(pr.bytes / 1e6).toFixed(1)}MB lufs=${meta.lufs}`);
}

// aggregate -> index.json (writeIndex schema)
const videos = fs.readdirSync(FILMS)
  .filter(f => f.endsWith('.json') && f !== 'index.json').sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(FILMS, f), 'utf8')))
  .filter(m => m.file && fs.existsSync(path.join(OUT, m.file)));
const index = {
  film: '07-unboxing', group: 'item',
  axes: { item: ['laptop', 'drone'], cut: [15, 6], ar: ['16x9', '1x1'], lang: ['zh', 'en'], promo: ['none', 'launch', '1111'] },
  method: 'ltx-2.5', failed: [], videos,
};
fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`\nINDEX_DONE ${videos.length} films -> ${path.join(OUT, 'index.json')}`);
