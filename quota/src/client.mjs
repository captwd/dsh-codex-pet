import { parseBalance, parseQuota, unwrap, IdleDirector } from './core.mjs';
import { mountCodexMini } from './codex-mini.mjs';
import { mainSessionId } from './mini-core.mjs';
import { mountDesktopMini } from './desktop-host.mjs';
import { taskPresentation } from './task-core.mjs';

export const inject = ['sessions', 'uiWorkspace'];

export function mountEnhancements(ctx) {
  window.__dshPetEnhancementDispose?.();
  const CLEANUP_KEY = '__dshPetEnhancementDispose';
  const PREF_KEY = 'dsh-pet-enhancements-v2';
  let prefs = { idle: true, drag: true, focusUntil: 0 };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch {}
  const director = new IdleDirector();
  director.enabled = prefs.idle !== false; director.focusUntil = Number(prefs.focusUntil) || 0;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  director.reduced = media.matches;
  let disposed = false, bound = null, snapshot = null, definitions = [], definitionsRequest = null;
  let pollTimer, idleTimer, quotaTimer, pendingBind = false, stateRequest = null;
  const requests = new Map();
  let actionTimer = null, motion = null, overlay = null, drag = null;
  const cache = { deepseek: null, codex: null };
  const errors = { deepseek: '', codex: '' };
  const lastRefresh = { deepseek: 0, codex: 0 };
  const removers = [];
  const taskHistory=new Map();
  const style = document.createElement('style');
  style.dataset.dshPetEnhancementStyle = '';
  style.textContent = `[data-dsh-pet-enhancement-active]{background-image:none!important}`;
  document.head.appendChild(style);
  // All account indicators now belong to the small DS companion.
  document.querySelectorAll('[data-dsh-quota-battery]').forEach(el => el.remove());
  const desktop=Boolean(window.dshPetDesktop);
  const carrierActive=()=>desktop||document.visibilityState!=='hidden';
  const mini = (desktop?mountDesktopMini:mountCodexMini)({
    mainBounds() {
      if (!bound || snapshot?.display?.visible === false) return null;
      const pet = bound.float.getBoundingClientRect();
      return { left:pet.left,right:pet.right,top:pet.top,bottom:pet.bottom };
    },
    onVisibleChange(value) { if(value) refreshAccounts(); },
    refreshQuota: () => refreshAccounts(true),
    newChat() { if(ctx?.uiWorkspace?.startSession) ctx.uiWorkspace.startSession(); else return 'DSH 对话服务尚未就绪，请使用侧栏“新建任务”。'; },
    voice() {
      // Reuse the installed DSH control and its recording/setup lifecycle.
      const labels = ['听写','开始录音','停止并识别','重新录音','打开语音输入引导','前往语音插件设置','Dictate','Start recording','Stop and transcribe','Open voice input setup'];
      const native = [...document.querySelectorAll('button')].find(button => button.getClientRects().length && !button.disabled && labels.includes(button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent.trim()));
      if (native) { native.click(); return; }
      // Some Codex-style DSH shells mount this optional service only while
      // their Plugins view is open. Probe it without throwing on absence.
      try { ctx?.reflect?.get?.('pluginNavigation')?.openBundle?.('@deepseek-ai/dsh-experimental-voice-input-bundle'); } catch {}
      return '请在 DSH“语音输入”插件中启用并准备识别模型；语音将转成当前对话草稿。';
    },
    openTask(requestedId) {
      const byId=ctx?.sessions?.list?.getSnapshot?.()?.byId;
      const id=typeof requestedId==='string'&&byId?.[requestedId]?requestedId:(snapshot?.tasks||[]).map(row=>row.id).find(id=>byId?.[id]);
      if(id){if(ctx?.sessions?.open)ctx.sessions.open(id);else ctx?.uiWorkspace?.openSession?.(id);}
    },
  });
  const mainSettings=document.createElement('details');mainSettings.className='main-prefs';
  const summary=document.createElement('summary');summary.textContent='主宠待机设置';mainSettings.appendChild(summary);
  function option(label,checked,onChange){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=checked;input.onchange=()=>onChange(input.checked);row.append(input,document.createTextNode(' '+label));mainSettings.appendChild(row);return input;}
  const idleOption=option('主宠空闲小动作',prefs.idle!==false,value=>{prefs.idle=value;director.enabled=value;cancelVisual();savePrefs();});
  option('主宠拖拽回弹',prefs.drag!==false,value=>{prefs.drag=value;cancelVisual();savePrefs();});
  function mainButton(label,action){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=action;mainSettings.appendChild(button);}
  mainButton('主宠安静专注 25 分钟',()=>{director.focus();prefs.focusUntil=director.focusUntil;cancelVisual();savePrefs();});
  mainButton('恢复主宠待机动作',()=>{director.focusUntil=0;prefs.focusUntil=0;prefs.idle=true;idleOption.checked=true;director.enabled=true;director.defer();savePrefs();});
  mini.addSettings(mainSettings);
  function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}}
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);return()=>target.removeEventListener(type,fn,options);}
  function render(){if(!disposed)mini.updateQuota(cache.codex,errors.codex,cache.deepseek,errors.deepseek);}
  function refreshAccounts(force=false){return Promise.all(['deepseek','codex'].map(provider=>refreshQuota(force,provider)));}
  async function json(url, init = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...init });
    if (!response.ok) throw new Error(response.status === 401 ? '请先在当前页面登录 DSH' : '额度接口暂不可用（HTTP ' + response.status + '）');
    return response.json();
  }
  async function refreshQuota(force = false, provider) {
    const needed = mini.visible;
    if (!provider || !needed || disposed || !carrierActive()) return;
    if (!force && Date.now() - lastRefresh[provider] < 60000) return;
    if (requests.has(provider)) return;
    const abort = new AbortController(); requests.set(provider,abort); lastRefresh[provider] = Date.now();
    const timeout = setTimeout(() => abort.abort(), 12000);
    try {
      const raw = provider === 'deepseek' ? await json('/api/dsh-usage/overview', { signal: abort.signal })
        : await json('/api/dsh-chatgpt-subscription/quota/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: abort.signal });
      if (disposed || abort.signal.aborted) return;
      cache[provider] = provider === 'deepseek' ? parseBalance(raw) : parseQuota(raw); errors[provider] = '';
    } catch (error) {
      if (!disposed) errors[provider] = error.name === 'AbortError' ? '刷新超时，请重试' : error.message;
    } finally { clearTimeout(timeout); if (requests.get(provider) === abort) requests.delete(provider); render(); }
  }
  function cancelVisual() {
    clearTimeout(actionTimer); actionTimer = null; motion?.cancel(); motion = null;
    overlay?.remove(); overlay = null; bound?.sprite.removeAttribute('data-dsh-pet-enhancement-active');
  }
  function play(action) {
    if (!bound || !snapshot || !isSafeIdle()) return;
    cancelVisual();
    const wrap = bound.sprite.parentElement;
    if (action === 'breathe') {
      motion = wrap.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.015,.985)' }, { transform: 'scale(1)' }], { duration: 2000, easing: 'ease-in-out' });
      return;
    }
    const definition = definitions.find(pet => pet.id === snapshot.pet?.id);
    if (!definition || definition.renderer !== 'sprite2d') return;
    const track = definition.tracks?.[action === 'wave' ? 'waving' : 'jumping'];
    const row = action === 'wave' ? 3 : 4;
    if (!track?.frames?.length) return;
    const height = bound.sprite.clientHeight, width = bound.sprite.clientWidth;
    overlay = document.createElement('span'); overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:absolute;inset:0;display:block;pointer-events:none;background-repeat:no-repeat;';
    // Use the already-loaded same-origin atlas and the host's own geometry.
    overlay.style.backgroundImage = getComputedStyle(bound.sprite).backgroundImage;
    overlay.style.backgroundSize = getComputedStyle(bound.sprite).backgroundSize;
    bound.sprite.appendChild(overlay); bound.sprite.setAttribute('data-dsh-pet-enhancement-active', action);
    let index = 0; const target = bound.sprite;
    function frame() {
      if (!overlay || disposed || target !== bound?.sprite || !isSafeIdle()) { cancelVisual(); return; }
      if (index >= track.frames.length) { cancelVisual(); return; }
      overlay.style.backgroundPosition = (-track.frames[index] * width) + 'px ' + (-row * height) + 'px';
      const duration = Math.max(60, Math.min(1000, track.durations[index] || 150)); index++;
      actionTimer = setTimeout(frame, duration);
    }
    frame();
  }
  function samePet() { return bound?.sprite.getAttribute('aria-label') === snapshot?.pet?.displayName; }
  function isSafeIdle() { return Boolean(['whale-girl-refined','long-niang'].includes(snapshot?.pet?.id) && samePet() && !director.busy && !director.dragging && !director.reduced && director.enabled && Date.now() >= director.focusUntil && nativeIdle()); }
  function nativeIdle() {
    if (!bound) return false;
    const y = Number.parseFloat(bound.sprite.style.backgroundPosition.split(/\s+/)[1] || '0');
    return Number.isFinite(y) && Math.abs(y) < 1;
  }
  function unbind() {
    cancelVisual(); bound?.cleanup(); bound = null; drag = null; director.dragging = false; director.cancel();
  }
  function bind() {
    pendingBind = false; if (disposed) return;
    const root = document.querySelector('[data-dsh-pet-root]');
    const sprite = root && [...root.querySelectorAll('[role="button"][aria-label]')].find(el => el.style.backgroundSize && !el.closest('[data-dsh-pet-enhancement-control]'));
    if (!sprite || !sprite.isConnected || !sprite.parentElement?.parentElement) { if (bound) unbind(); return; }
    if (bound?.sprite === sprite) return;
    unbind();
    const float = sprite.parentElement.parentElement;
    if (getComputedStyle(float).position !== 'fixed') return;
    bound = { sprite, float, cleanup() {} };
    const nativeObserver = new MutationObserver(() => {
      if (!nativeIdle() || !samePet()) { cancelVisual(); director.cancel(); }
    });
    nativeObserver.observe(sprite, { attributes: true, attributeFilter: ['style', 'aria-label'] });
    const positionObserver = new MutationObserver(mini.reposition); positionObserver.observe(float, { attributes: true, attributeFilter: ['style'] });
    const sizeObserver = new ResizeObserver(() => {
      // An idle overlay captures atlas dimensions when its action starts.
      // Remove that old geometry as soon as the native main pet is resized.
      cancelVisual();director.cancel();mini.reposition();
    }); sizeObserver.observe(sprite);
    const off = [listen(sprite, 'pointerenter', () => { if (nativeIdle()) { const action = director.hover(); if (action) play(action); } }),
      listen(sprite, 'pointerdown', event => {
        if (event.button !== 0) return; cancelVisual(); director.dragging = true;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }), listen(window, 'pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        if (prefs.drag !== false && !director.reduced && !director.busy) {
          motion?.cancel(); motion = sprite.parentElement.animate([{ transform: 'rotate(' + Math.max(-6, Math.min(6, dx * .03)) + 'deg)' }], { duration: 120, fill: 'forwards' });
        }
      }), listen(window, 'pointerup', event => endDrag(event, false)), listen(window, 'pointercancel', event => endDrag(event, true)),
      listen(window, 'blur', () => { drag = null; director.dragging = false; cancelVisual(); director.cancel(); })];
    bound.cleanup = () => { off.forEach(fn => fn()); nativeObserver.disconnect(); positionObserver.disconnect(); sizeObserver.disconnect(); };
    render();
  }
  function endDrag(event, cancelled) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved; drag = null; director.dragging = false; cancelVisual(); director.cancel();
    if (moved && !cancelled && bound && prefs.drag !== false && !director.reduced && !director.busy) {
      motion = bound.sprite.parentElement.animate([{ transform: 'scale(1.055,.945)' }, { transform: 'scale(.985,1.02)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    }
    mini.reposition();
  }
  const observer = new MutationObserver(() => { if (!pendingBind) { pendingBind = true; queueMicrotask(bind); } });
  observer.observe(document.body, { childList: true, subtree: true });
  async function poll() {
    if (disposed || !carrierActive()) return;
    if(!definitions.length) loadDefinitions();
    stateRequest?.abort(); const abort = new AbortController(); stateRequest = abort;
    const timeout = setTimeout(() => abort.abort(), 8000);
    try {
      const byId=ctx?.sessions?.list?.getSnapshot?.()?.byId||{};
      const current = mainSessionId(byId);
      const next = unwrap(await json('/api/pet/state' + (current ? '?current=' + encodeURIComponent(current) : ''), { signal: abort.signal }));
      if (disposed || abort.signal.aborted) return;
      const changedPet = snapshot?.pet?.id !== next?.pet?.id;
      snapshot = taskPresentation(next,byId,current,taskHistory); director.update(next);
      if (director.busy || changedPet) cancelVisual();
      bind(); render(); mini.update(snapshot,definitions);
    } catch { director.busy = true; cancelVisual(); mini.update({ ...snapshot, phase:'offline', animation:'idle', sessionActive:true },definitions); }
    finally {
      clearTimeout(timeout);
      if (stateRequest === abort) {
        stateRequest = null;
        if (!disposed && carrierActive()) pollTimer = setTimeout(poll, 2000);
      }
    }
  }
  async function loadDefinitions() {
    if(definitionsRequest || disposed) return;
    definitionsRequest = json('/api/pet/pets');
    try { const data=unwrap(await definitionsRequest); if(disposed)return; definitions=Array.isArray(data)?data:data.pets||[];mini.update(snapshot,definitions); }
    catch {} finally { definitionsRequest=null; }
  }
  function tick() {
    if (disposed || document.visibilityState === 'hidden') return;
    if (bound && nativeIdle()) { const action = director.tick(); if (action) play(action); }
    idleTimer = setTimeout(tick, 250);
  }
  function refreshLoop() { if (disposed || !carrierActive()) return; refreshAccounts(); render(); quotaTimer = setTimeout(refreshLoop, 15000); }
  function start() { clearTimeout(pollTimer); clearTimeout(idleTimer); clearTimeout(quotaTimer); poll(); tick(); refreshLoop(); }
  const visibility = () => { if(desktop)return;if (document.visibilityState === 'hidden') { clearTimeout(pollTimer); clearTimeout(idleTimer); clearTimeout(quotaTimer); cancelVisual(); requests.forEach(abort=>abort.abort()); stateRequest?.abort(); } else { director.defer(); start(); } };
  removers.push(listen(document, 'visibilitychange', visibility), listen(window, 'resize', mini.reposition),
    listen(media, 'change', () => { director.reduced = media.matches; cancelVisual(); director.defer(); }));
  function dispose() {
    if (disposed) return; disposed = true;
    clearTimeout(pollTimer); clearTimeout(idleTimer); clearTimeout(quotaTimer); requests.forEach(abort=>abort.abort()); stateRequest?.abort();
    observer.disconnect(); unbind(); mini.dispose(); removers.forEach(fn => fn()); style.remove();
    if (window[CLEANUP_KEY] === dispose) delete window[CLEANUP_KEY];
  }
  window[CLEANUP_KEY] = dispose;
  ctx?.effect?.(() => dispose, 'pet quota and idle lifecycle');
  loadDefinitions(); bind(); start();
  return dispose;
}
