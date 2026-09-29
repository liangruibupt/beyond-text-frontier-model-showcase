// story.mjs — Level 3：Bedrock 上的 Claude 按成片算好的统计写文案，代码查过才存；出片时不再调模型
//   node factory/story.mjs <film> [--<axis> a,b] [--force] [--dry] [--model id] [--tries 3]
// 成片的 story.js 导出 STORY = { axis, ids, facts(id), schema, system, prompt(id), check(id, story) }：
//   facts 是代码算好的统计；schema 是模型要填的字段（JSON Schema）；check 返回错误描述，空数组 = 通过
// 模型经由强制的工具调用（write_story）交回一个对象；check 不过就把错误作为工具结果发回同一段对话，让它改，最多 --tries 次
// 结果写进 <film>/stories/<id>.json（入库）：{ id, key, model, tries, usage, story }。key = storyKey(facts)，统计变了就算过期；
// model 为 "draft" 的是手写的占位稿，不带 --force 也会被替换
// 调用走 AWS CLI（aws bedrock-runtime converse），账号和区域用 AWS_PROFILE、AWS_REGION；--dry 只打印提示词，不调用
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs, isMain } from './lib/args.mjs';
import { ROOT } from './lib/serve.mjs';
import { storyKey } from './engine/story.js';

export const MODEL = 'us.anthropic.claude-opus-5-5', TOOL = 'write_story';

export const storyFile = (dir, id) => path.join(dir, 'stories', `${id}.json`);

/** 已存的文案：missing（没有）、draft（手写占位稿）、stale（统计变了）、failing（check 不过）、current */
export function storyState(dir, STORY, id) {
  const f = storyFile(dir, id);
  if (!fs.existsSync(f)) return { state: 'missing' };
  const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (rec.key !== storyKey(STORY.facts(id))) return { state: 'stale', rec };
  const errors = STORY.check(id, rec.story);
  if (errors.length) return { state: 'failing', rec, errors };
  return { state: rec.model === 'draft' ? 'draft' : 'current', rec };
}

/** Converse 的请求：系统提示、对话、唯一的工具并强制调用它 */
export function request(STORY, { model, messages }) {
  return {
    modelId: model,
    system: [{ text: STORY.system }],
    messages,
    toolConfig: {
      tools: [{ toolSpec: { name: TOOL, description: STORY.toolDescription ?? 'Hand back the story fields.', inputSchema: { json: STORY.schema } } }],
      toolChoice: { tool: { name: TOOL } },
    },
    inferenceConfig: { maxTokens: 4000 },
  };
}

/** 一个 id 的完整来回。call(request) → Converse 的响应；测试里换成假模型 */
export async function runStory(STORY, id, { call, model = MODEL, tries = 3, log = () => {} }) {
  const messages = [{ role: 'user', content: [{ text: STORY.prompt(id) }] }], usage = { inputTokens: 0, outputTokens: 0 };
  let errors = [];
  for (let n = 1; n <= tries; n++) {
    const res = await call(request(STORY, { model, messages }));
    usage.inputTokens += res.usage?.inputTokens ?? 0; usage.outputTokens += res.usage?.outputTokens ?? 0;
    const msg = res.output?.message, use = msg?.content?.find(c => c.toolUse)?.toolUse;
    if (!use) throw new Error(`${id}: the model did not call ${TOOL} (stopReason: ${res.stopReason})`);
    errors = STORY.check(id, use.input);
    if (!errors.length) return { id, key: storyKey(STORY.facts(id)), model, tries: n, usage, story: use.input };
    log(`  ${id}: attempt ${n} has ${errors.length} problem(s)\n    ${errors.join('\n    ')}`);
    messages.push(msg, { role: 'user', content: [{ toolResult: { toolUseId: use.toolUseId, status: 'error',
      content: [{ text: `The story was rejected. Fix every problem below and call ${TOOL} again with the whole story:\n- ${errors.join('\n- ')}` }] } }] });
  }
  throw new Error(`${id}: no valid story after ${tries} attempts:\n  ${errors.join('\n  ')}`);
}

/** 真正的调用：请求写进临时文件交给 AWS CLI（请求里有中文和大段提示词，走命令行参数不稳） */
export function bedrock(input) {
  const f = path.join(os.tmpdir(), `story-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(f, JSON.stringify(input));
  try {
    return JSON.parse(execFileSync('aws', ['bedrock-runtime', 'converse', '--cli-input-json', `file://${f}`, '--cli-read-timeout', '300', '--output', 'json'],
      { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) { throw new Error(String(e.stderr || e.message).trim()); }
  finally { fs.rmSync(f, { force: true }); }
}

export async function main(argv, { call = bedrock, log = console.log, err = console.error } = {}) {
  const { pos: [film], o } = parseArgs(argv);
  const dir = film && path.resolve(ROOT, film);
  if (!film || !fs.existsSync(path.join(dir, 'story.js'))) {
    err('usage: node factory/story.mjs <film> [--<axis> a,b] [--force] [--dry] [--model id] [--tries 3]  (the film needs a story.js)');
    return 2;
  }
  const { STORY } = await import(pathToFileURL(path.join(dir, 'story.js')).href);
  const pick = o[STORY.axis], ids = typeof pick === 'string' ? pick.split(',') : STORY.ids;
  for (const id of ids) if (!STORY.ids.includes(id)) { err(`unknown ${STORY.axis}: ${id} (expected ${STORY.ids.join(' | ')})`); return 2; }
  const model = typeof o.model === 'string' ? o.model : MODEL, tries = +(o.tries ?? 3);
  if (!Number.isInteger(tries) || tries < 1) { err(`--tries must be a whole number ≥ 1, got ${o.tries}`); return 2; }
  const todo = [];
  for (const id of ids) {
    const s = storyState(dir, STORY, id);
    if (s.state === 'current' && !o.force) { log(`${id}: current (${s.rec.model}, ${s.rec.tries} attempt${s.rec.tries > 1 ? 's' : ''})`); continue; }
    log(`${id}: ${s.state}${s.errors ? ` (${s.errors.length} problem(s))` : ''}`);
    todo.push(id);
  }
  if (o.dry) {
    if (todo.length) log(`\n── system ──\n${STORY.system}\n\n── ${todo[0]} ──\n${STORY.prompt(todo[0])}\n\n── tool input schema ──\n${JSON.stringify(STORY.schema, null, 2)}`);
    log(`\n${todo.length} to write; --dry calls nothing`);
    return 0;
  }
  let failed = 0;
  for (const id of todo) {
    try {
      const rec = await runStory(STORY, id, { call, model, tries, log });
      fs.mkdirSync(path.dirname(storyFile(dir, id)), { recursive: true });
      fs.writeFileSync(storyFile(dir, id), `${JSON.stringify(rec, null, 2)}\n`);
      log(`${id}: written in ${rec.tries} attempt${rec.tries > 1 ? 's' : ''} (${rec.usage.inputTokens} in / ${rec.usage.outputTokens} out tokens) → ${path.relative(ROOT, storyFile(dir, id))}`);
    } catch (e) { failed++; err(e.message); }
  }
  return failed ? 1 : 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then(c => process.exit(c), e => { console.error(e.message); process.exit(1); });
