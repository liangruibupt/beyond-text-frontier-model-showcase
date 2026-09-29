import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stableJson, storyKey, slotsOf, fill, slotErrors, writtenNumbers, speechSec } from '../engine/story.js';
import { runStory, storyState, storyFile, request, TOOL, MODEL } from '../story.mjs';

test('storyKey ignores key order and changes with any value', () => {
  assert.equal(stableJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
  const k = storyKey({ orders: 146, months: [1, 2] });
  assert.match(k, /^[0-9a-f]{16}$/);
  assert.equal(storyKey({ months: [1, 2], orders: 146 }), k);
  assert.notEqual(storyKey({ orders: 147, months: [1, 2] }), k);
  assert.notEqual(storyKey({ orders: 146, months: [2, 1] }), k);
});

test('placeholders: listed, filled, and checked for exactly the required ones', () => {
  assert.deepEqual(slotsOf('{month}最忙：{monthOrders} 单'), ['month', 'monthOrders']);
  assert.equal(fill('今年下单 {orders} 次', { orders: 146 }), '今年下单 146 次');
  assert.throws(() => fill('{top}', {}), /no value for \{top\}/);
  assert.deepEqual(slotErrors('count.zh', '今年下单 {orders} 次', { required: ['orders'] }), []);
  assert.deepEqual(slotErrors('count.zh', '今年下单', { required: ['orders'] }), ['count.zh must contain {orders} exactly once']);
  assert.deepEqual(slotErrors('count.zh', '{orders}{orders}', { required: ['orders'] }), ['count.zh must contain {orders} exactly once']);
  assert.deepEqual(slotErrors('vo.intro.zh', '{name}{orders}{year}', { required: ['name', 'orders'], optional: ['year'] }), []);
  assert.deepEqual(slotErrors('x', '{orders} {spend}', { required: ['orders'] }), ['x has an unknown placeholder {spend}']);
});

test('writtenNumbers catches numbers the model wrote itself, not placeholders or 一', () => {
  assert.deepEqual(writtenNumbers('今年下单 {orders} 次', 'zh'), []);
  assert.deepEqual(writtenNumbers('记得你的每一次喜欢', 'zh'), []);
  assert.deepEqual(writtenNumbers('一百四十六次', 'zh'), ['百', '四', '十', '六']);
  assert.deepEqual(writtenNumbers('两杯咖啡，12 次', 'zh'), ['12', '两']);
  assert.deepEqual(writtenNumbers('{orders} orders this year', 'en'), []);
  assert.deepEqual(writtenNumbers('Someone ordered One hundred times', 'en'), ['one', 'hundred']);
  assert.deepEqual(writtenNumbers('Top 3 picks', 'en'), ['3']);
});

test('speechSec: close to Kokoro for 03 lines, longer for longer lines, pauses count', () => {
  const zh = speechSec('闻境桂花，双十一到手四百九十九元。', 'zh');          // Kokoro: 2.80 s
  assert.ok(zh > 2.8 && zh < 3.6, `${zh}`);
  const en = speechSec('Wenjing Osmanthus, now sixty-nine dollars.', 'en');   // Kokoro: 2.50 s
  assert.ok(en > 2.5 && en < 3.6, `${en}`);
  assert.ok(speechSec('林一，你好。', 'zh') < speechSec('林一，今年你在有集下单很多次。', 'zh'));
  assert.ok(speechSec('a b c', 'en') < speechSec('a, b, c', 'en'));
});

// ── story.mjs：假模型跑完整个来回 ──
const STORY = {
  axis: 'user', ids: ['u1'], system: 'sys', toolDescription: 'd',
  schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  facts: () => ({ orders: 146 }),
  prompt: id => `write for ${id}`,
  check: (id, s) => (s.title?.length <= 6 ? [] : [`title "${s.title}" is longer than 6 characters`]),
};
const reply = (input, n) => ({ stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 10 }, output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: `t${n}`, name: TOOL, input } }] } } });

test('request forces the one tool and carries the schema', () => {
  const r = request(STORY, { model: 'm', messages: [] });
  assert.equal(r.modelId, 'm');
  assert.deepEqual(r.system, [{ text: 'sys' }]);
  assert.deepEqual(r.toolConfig.toolChoice, { tool: { name: TOOL } });
  assert.deepEqual(r.toolConfig.tools[0].toolSpec.inputSchema.json, STORY.schema);
});

test('a rejected attempt goes back as an error tool result; the next good one is kept', async () => {
  const seen = [];
  const call = async req => { seen.push(structuredClone(req)); return reply(seen.length === 1 ? { title: '咖啡续命官大人阁下' } : { title: '咖啡续命官' }, seen.length); };
  const rec = await runStory(STORY, 'u1', { call, model: 'm' });
  assert.deepEqual(rec, { id: 'u1', key: storyKey({ orders: 146 }), model: 'm', tries: 2, usage: { inputTokens: 200, outputTokens: 20 }, story: { title: '咖啡续命官' } });
  const second = seen[1].messages;
  assert.equal(second.length, 3);
  assert.equal(second[1].role, 'assistant');
  const tr = second[2].content[0].toolResult;
  assert.equal(tr.toolUseId, 't1');
  assert.equal(tr.status, 'error');
  assert.match(tr.content[0].text, /longer than 6 characters/);
});

test('three rejected attempts fail with the problems; no tool call fails at once', async () => {
  let n = 0;
  await assert.rejects(runStory(STORY, 'u1', { call: async () => reply({ title: 'far too long a title' }, ++n) }), /no valid story after 3 attempts:\n {2}title "far too long a title"/);
  assert.equal(n, 3);
  await assert.rejects(runStory(STORY, 'u1', { call: async () => ({ stopReason: 'end_turn', output: { message: { content: [{ text: 'hi' }] } } }) }), /did not call write_story/);
});

test('storyState: missing, draft, stale, failing, current', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  const put = rec => { fs.mkdirSync(path.join(dir, 'stories'), { recursive: true }); fs.writeFileSync(storyFile(dir, 'u1'), JSON.stringify(rec)); };
  const key = storyKey({ orders: 146 });
  assert.equal(storyState(dir, STORY, 'u1').state, 'missing');
  put({ key, model: 'draft', story: { title: '咖啡' } });
  assert.equal(storyState(dir, STORY, 'u1').state, 'draft');
  put({ key: 'x', model: 'm', story: { title: '咖啡' } });
  assert.equal(storyState(dir, STORY, 'u1').state, 'stale');
  put({ key, model: 'm', story: { title: 'far too long' } });
  assert.deepEqual(storyState(dir, STORY, 'u1').errors, ['title "far too long" is longer than 6 characters']);
  put({ key, model: 'm', story: { title: '咖啡' } });
  assert.equal(storyState(dir, STORY, 'u1').state, 'current');
  fs.rmSync(dir, { recursive: true });
});

test('story.mjs without a film prints usage and exits 2 without calling AWS', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../story.mjs', import.meta.url)), '03-perfume'], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^usage: node factory\/story\.mjs <film>/);
});

test('main: skips current stories, replaces drafts, --dry calls nothing, a failure exits 1', async () => {
  const { main } = await import('../story.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
  fs.writeFileSync(path.join(dir, 'story.js'), `export const STORY = {
    axis: 'user', ids: ['u1', 'u2'], system: 'SYSTEM PROMPT', schema: { type: 'object' },
    facts: id => ({ id }), prompt: id => 'PROMPT ' + id,
    check: (id, s) => (s.title?.length <= 6 ? [] : ['title is too long']) };\n`);
  fs.mkdirSync(path.join(dir, 'stories'));
  const put = (id, model) => fs.writeFileSync(storyFile(dir, id), JSON.stringify({ id, key: storyKey({ id }), model, tries: 1, story: { title: '咖啡' } }));
  put('u1', 'm'); put('u2', 'draft');
  const lines = [], log = s => lines.push(s), err = log;
  let calls = 0;
  const call = async () => reply({ title: `咖啡${++calls}` }, calls);

  assert.equal(await main([dir, '--dry'], { call, log, err }), 0);
  assert.equal(calls, 0);
  assert.match(lines.join('\n'), /u1: current[\s\S]*u2: draft[\s\S]*SYSTEM PROMPT[\s\S]*PROMPT u2/);

  assert.equal(await main([dir], { call, log, err }), 0);
  assert.equal(calls, 1, 'only the draft is rewritten');
  assert.equal(JSON.parse(fs.readFileSync(storyFile(dir, 'u2'), 'utf8')).model, MODEL);
  assert.equal(JSON.parse(fs.readFileSync(storyFile(dir, 'u1'), 'utf8')).model, 'm');

  assert.equal(await main([dir, '--user', 'u1', '--force', '--model', 'x'], { call, log, err }), 0);
  assert.equal(JSON.parse(fs.readFileSync(storyFile(dir, 'u1'), 'utf8')).model, 'x');

  const before = fs.readFileSync(storyFile(dir, 'u1'), 'utf8');
  const bad = async () => reply({ title: 'far too long' }, 1);
  assert.equal(await main([dir, '--user', 'u1', '--force', '--tries', '2'], { call: bad, log, err }), 1);
  assert.equal(fs.readFileSync(storyFile(dir, 'u1'), 'utf8'), before, 'a failed story leaves the old file alone');

  assert.equal(await main([dir, '--user', 'zz'], { call, log, err }), 2);
  assert.equal(await main([dir, '--tries', '0'], { call, log, err }), 2);
  fs.rmSync(dir, { recursive: true });
});
