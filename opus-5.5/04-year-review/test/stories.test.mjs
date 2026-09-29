import test from 'node:test';
import assert from 'node:assert/strict';
import { META } from '../meta.js';
import { USER_IDS } from '../users.js';
import { storyOf, recordOf } from '../facts.js';
import { check, budgets, FIELDS } from '../story.js';

test('the user axis is exactly the customers in users.js', () => {
  assert.deepEqual(META.axes.user, USER_IDS);
});

// 入库的文案对得上现在的统计（key），并且过 check：放得下、念得完、没有自己写的数字
test('every committed story is current and passes its checks', () => {
  for (const u of USER_IDS) {
    const story = storyOf(u);                                         // 缺了或过期了就抛错，错误里带着重新生成的命令
    assert.deepEqual(check(u, story), [], `${u}: node factory/story.mjs 04-year-review --user ${u}`);
    assert.ok(recordOf(u).tries <= 3, `${u}: ${recordOf(u).tries} tries`);
  }
});

test('every field leaves the model room to write in', () => {
  for (const u of USER_IDS) {
    const B = budgets(u);
    for (const key of Object.keys(FIELDS)) for (const lang of META.axes.lang) assert.ok(B[`${key}.${lang}`] >= 4, `${u} ${key}.${lang}: budget ${B[`${key}.${lang}`]}`);
  }
});

test('check catches a written number, a long caption, a missing or extra placeholder and an unknown pick', () => {
  const s = storyOf('coffee'), with_ = (key, lang, text) => { const c = structuredClone(s), [a, b] = key.split('.'); (b ? c[a][b] : c[a])[lang] = text; return c; };
  assert.match(check('coffee', with_('captions.count', 'zh', '这一年你下的单，其中 12 单在早上')).join('\n'), /writes numbers itself \("12"\)/);
  assert.match(check('coffee', with_('captions.top', 'en', `{top} ${'again and again '.repeat(8)}{repeat}`)).join('\n'), /too long for its caption zone/);
  assert.match(check('coffee', with_('vo.intro', 'zh', '{name}，这一年辛苦了')).join('\n'), /orders/);
  assert.match(check('coffee', with_('captions.count', 'en', '{orders} orders this year')).join('\n'), /captions\.count.*orders/);   // 大数字已经在上面了
  assert.match(check('coffee', { ...s, pick: 'nope' }).join('\n'), /pick must be a catalogue id/);
});
