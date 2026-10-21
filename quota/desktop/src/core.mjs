const finite = value => typeof value === 'number' && Number.isFinite(value);
export function unwrap(value) {
  if (value && typeof value.ok === 'boolean') {
    if (!value.ok) throw new Error('服务暂时不可用');
    return value.value;
  }
  return value;
}
export function parseBalance(value, now = Date.now()) {
  const data = unwrap(value);
  const provider = data?.providers?.find(p => p.provider === 'deepseek-official');
  const raw = provider?.balance?.totalBalance;
  if (!((typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw)) || finite(raw))) throw new Error('未读到 DeepSeek 账户余额');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('余额格式不可用');
  const currency = provider.balance.currency === 'USD' ? 'USD' : 'CNY';
  return { amount, currency, at: finite(provider.balance.updatedAt) ? provider.balance.updatedAt : now };
}
export function parseQuota(value, now = Date.now()) {
  const data = unwrap(value);
  const bucket = data?.buckets?.find(b => b.id === 'codex');
  if (!bucket) throw new Error('未读到 Codex 订阅额度，请检查 DSH 的订阅登录');
  const values = [...(bucket.windows || []), bucket.primary, bucket.secondary].filter(Boolean);
  const windows = {};
  for (const value of values) {
    if (!finite(value.usedPercent) || !finite(value.windowDurationMins)) continue;
    const key = value.windowDurationMins === 300 ? 'fiveHours' : value.windowDurationMins === 10080 ? 'week' : null;
    if (!key) continue;
    windows[key] = { remaining: Math.max(0, Math.min(100, 100 - value.usedPercent)),
      resetsAt: finite(value.resetsAt) && value.resetsAt > 0 ? value.resetsAt : null };
  }
  if (!windows.fiveHours && !windows.week) throw new Error('服务没有返回五小时或周额度');
  const at = finite(data.fetchedAt) && data.fetchedAt > 0 ? data.fetchedAt * (data.fetchedAt < 1e12 ? 1000 : 1) : now;
  return { ...windows, plan: typeof bucket.planType === 'string' ? bucket.planType : '', at, stale: data.stale === true };
}
export function isIdle(snapshot) {
  // sessionActive means the DSH session is mounted, not that a turn is running.
  const settled=snapshot?.phase==='idle'||(['done','failed'].includes(snapshot?.phase)&&snapshot?.animation==='idle');
  return Boolean(snapshot && settled
    && !(snapshot.sessions || []).some(s => ['waiting', 'thinking', 'tool', 'review'].includes(s.phase))
    && !['work', 'sleep'].includes(snapshot.gameplay?.mode));
}
export class IdleDirector {
  constructor({ now = Date.now, random = Math.random } = {}) {
    this.now = now; this.random = random; this.enabled = true; this.focusUntil = 0;
    this.busy = true; this.dragging = false; this.reduced = false; this.previous = '';
    this.activeUntil = 0; this.lastHover = -Infinity; this.defer();
  }
  defer() { this.nextIdle = this.now() + 12000 + this.random() * 8000; }
  update(snapshot) { const busy = !isIdle(snapshot); if (busy || this.busy !== busy) this.defer(); this.busy = busy; }
  canPlay() { return this.enabled && !this.reduced && !this.busy && !this.dragging && this.now() >= this.focusUntil && this.now() >= this.activeUntil; }
  hover() {
    if (!this.canPlay() || this.now() - this.lastHover < 4000) return null;
    this.lastHover = this.now(); this.activeUntil = this.now() + 1600; this.defer(); return 'wave';
  }
  tick() {
    if (!this.canPlay() || this.now() < this.nextIdle) return null;
    const choices = ['breathe', 'wave', 'jump'].filter(action => action !== this.previous);
    const action = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))];
    this.previous = action; this.activeUntil = this.now() + 2400; this.defer(); return action;
  }
  cancel() { this.activeUntil = 0; this.defer(); }
  focus(minutes = 25) { this.focusUntil = this.now() + minutes * 60000; this.cancel(); }
}
