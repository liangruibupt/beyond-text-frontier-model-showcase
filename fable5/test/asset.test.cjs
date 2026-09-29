const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const file = path.resolve(__dirname, '../solar-system/index.html');
const html = fs.readFileSync(file, 'utf8');

test('the self-contained animation script compiles', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert(scripts.length > 0);
  for (const [, code] of scripts) assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
});

test('classroom controls and the canvas are present', () => {
  for (const id of ['space', 'playBtn', 'resetBtn', 'tourBtn', 'raceBtn', 'keplerBtn', 'cbTrueSizes', 'cbProjector']) {
    assert(html.includes(`id="${id}"`), `Missing control: ${id}`);
  }
  assert(!html.includes('/workspaces/myagents/'), 'Must not depend on the old checkout');
});

test('local resources stay within this case and exist', () => {
  for (const [, reference] of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    if (/^(?:https?:|data:|#)/.test(reference)) continue;
    const resolved = path.resolve(path.dirname(file), reference.split(/[?#]/)[0]);
    assert(resolved.startsWith(path.dirname(file) + path.sep));
    assert(fs.existsSync(resolved), `Missing resource: ${reference}`);
  }
});
