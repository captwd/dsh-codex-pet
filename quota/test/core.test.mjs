import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBalance, parseQuota, isIdle, IdleDirector } from '../src/core.mjs';

test('money and subscription accounts reject each other’s data instead of being mixed', () => {
  assert.throws(()=>parseBalance({buckets:[{id:'codex',primary:{usedPercent:20,windowDurationMins:300}}]}));
  assert.throws(()=>parseQuota({providers:[{provider:'deepseek-official',balance:{totalBalance:'10.72'}}]}));
});
test('DeepSeek reads only the official account balance and preserves its money unit', () => {
  assert.deepEqual(parseBalance({ providers: [{ provider: 'other', balance: { totalBalance: 500 } },
    { provider: 'deepseek-official', balance: { totalBalance: '11.1836', currency: 'CNY' } }] }, 123),
    { amount: 11.1836, currency: 'CNY', at: 123 });
  assert.equal(parseBalance({ providers: [{ provider: 'deepseek-official', balance: { totalBalance: '0' } }] }).amount, 0);
  assert.throws(() => parseBalance({ providers: [{ provider: 'other', balance: { totalBalance: 500 } }] }));
  assert.throws(() => parseBalance({ providers: [{ provider: 'deepseek-official', balance: { totalBalance: null } }] }));
});
test('Codex chooses the Codex bucket and identifies windows by duration instead of ordering', () => {
  const value = parseQuota({ ok: true, value: { buckets: [
    { id: 'code-review', primary: { usedPercent: 0, windowDurationMins: 300 } },
    { id: 'codex', primary: { usedPercent: 17, windowDurationMins: 10080 }, secondary: { usedPercent: 11, windowDurationMins: 300 } },
  ] } }, 100);
  assert.equal(value.fiveHours.remaining, 89); assert.equal(value.week.remaining, 83); assert.equal(value.at, 100);
});
test('missing usage never appears as 100 percent and missing windows remain unknown', () => {
  assert.throws(() => parseQuota({ buckets: [{ id: 'codex', primary: { usedPercent: null, windowDurationMins: 300 } }] }));
  const data = parseQuota({ buckets: [{ id: 'codex', windows: [{ usedPercent: 100, windowDurationMins: 300 }] }] });
  assert.equal(data.fiveHours.remaining, 0); assert.equal(data.week, undefined);
});
test('backend timestamps and stale flags survive refresh instead of being relabeled fresh', () => {
  const balance = parseBalance({ providers: [{ provider: 'deepseek-official', balance: { totalBalance: '3.5', updatedAt: 1234 } }] }, 50000);
  assert.equal(balance.at, 1234);
  const quota = parseQuota({ fetchedAt: 1792500000, stale: true, buckets: [{ id: 'codex', primary: { usedPercent: 20, windowDurationMins: 300 } }] }, 50000);
  assert.equal(quota.at, 1792500000000); assert.equal(quota.stale, true);
});
test('all native task phases and work or sleep modes suppress decorations', () => {
  for (const phase of ['thinking', 'tool', 'waiting', 'review', 'done', 'failed']) assert.equal(isIdle({ phase, sessionActive: false }), false);
  assert.equal(isIdle({ phase: 'idle', sessionActive: true }), true);
  assert.equal(isIdle({ phase: 'idle', gameplay: { mode: 'sleep' } }), false);
  assert.equal(isIdle({ phase: 'idle', sessions: [{ phase: 'tool' }] }), false);
  assert.equal(isIdle({ phase: 'idle', sessionActive: false }), true);
});
function fixture() { let time = 0; const director = new IdleDirector({ now: () => time, random: () => .4 }); return { director, advance: ms => time += ms }; }
test('idle adds a quiet interval, does not repeat immediately, and task start wins', () => {
  const { director: d, advance } = fixture(); d.update({ phase: 'idle' });
  advance(14000); assert.equal(d.tick(), null); advance(2000); assert.ok(d.tick());
  assert.equal(d.tick(), null); d.update({ phase: 'thinking', sessionActive: true }); advance(100000); assert.equal(d.tick(), null);
  d.update({ phase: 'idle' }); assert.equal(d.tick(), null);
});
test('hover cooldown, reduced motion, quiet focus and dragging prevent repeated actions', () => {
  const { director: d, advance } = fixture(); d.update({ phase: 'idle' });
  assert.equal(d.hover(), 'wave'); advance(2000); assert.equal(d.hover(), null);
  advance(3000); assert.equal(d.hover(), 'wave'); d.cancel(); d.reduced = true; advance(30000); assert.equal(d.tick(), null);
  d.reduced = false; d.focus(25); advance(60000); assert.equal(d.hover(), null);
  advance(25 * 60000); d.dragging = true; assert.equal(d.tick(), null); d.dragging = false; assert.ok(d.hover());
});
