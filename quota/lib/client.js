window.__ModuleLoader__.load({id:"dsh-pet-quota-desktop",factory:()=>{
"use strict";
const finite = value => typeof value === 'number' && Number.isFinite(value);
function unwrap(value) {
  if (value && typeof value.ok === 'boolean') {
    if (!value.ok) throw new Error('服务暂时不可用');
    return value.value;
  }
  return value;
}
function parseBalance(value, now = Date.now()) {
  const data = unwrap(value);
  const provider = data?.providers?.find(p => p.provider === 'deepseek-official');
  const raw = provider?.balance?.totalBalance;
  if (!((typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw)) || finite(raw))) throw new Error('未读到 DeepSeek 账户余额');
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('余额格式不可用');
  const currency = provider.balance.currency === 'USD' ? 'USD' : 'CNY';
  return { amount, currency, at: finite(provider.balance.updatedAt) ? provider.balance.updatedAt : now };
}
function parseQuota(value, now = Date.now()) {
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
function isIdle(snapshot) {
  // sessionActive means the DSH session is mounted, not that a turn is running.
  const settled=snapshot?.phase==='idle'||(['done','failed'].includes(snapshot?.phase)&&snapshot?.animation==='idle');
  return Boolean(snapshot && settled
    && !(snapshot.sessions || []).some(s => ['waiting', 'thinking', 'tool', 'review'].includes(s.phase))
    && !['work', 'sleep'].includes(snapshot.gameplay?.mode));
}
class IdleDirector {
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

const MINI_PET_ID = 'deepseek-whale-v2';
const MINI_TRACKS = ['idle','running-right','running-left','waving','jumping','failed','waiting','running','review'];
// Codex 26.1013's active sprite timing, applied only to this companion.
// A brief idle blink/shift is separated by resting poses instead of holding
// every intermediate pose for half a second as the DSH import does.
function miniAnimationDefinition(definition) {
  const timing={
    idle:[900,110,110,140,140,1000],
    'running-right':[120,120,120,120,120,120,120,220],
    'running-left':[120,120,120,120,120,120,120,220],
    waving:[140,140,140,280],jumping:[140,140,140,140,280],
    failed:[140,140,140,140,140,140,140,240],
    waiting:[150,150,150,150,150,260],running:[120,120,120,120,120,220],
    review:[150,150,150,150,150,280],
  };
  if(definition?.id!==MINI_PET_ID)return definition;
  return {...definition,tracks:Object.fromEntries(Object.entries(definition.tracks||{}).map(([name,track])=>[
    name,{...track,durations:track.frames.map((_,i)=>timing[name]?.[i]??track.durations?.[i]??140)},
  ]))};
}
const miniClamp = (value, low, high) => Math.max(low, Math.min(high, value));
function miniDimensions(definition, size) {
  const height = Math.round(miniClamp(Number(size) || 160, 80, 896));
  return { width: Math.max(1, Math.round(height * definition.cell.width / definition.cell.height)), height };
}
function miniAtlasPosition(definition,row,column){
  const x=100*column/Math.max(1,definition.columns-1);
  const y=100*row/Math.max(1,definition.atlasRows-1);
  return x+'% '+y+'%';
}
function clampMiniPosition(position, size, viewport) {
  return { x: Math.round(miniClamp(Number(position.x) || 0, 8, Math.max(8, viewport.width - size.width - 8))),
    y: Math.round(miniClamp(Number(position.y) || 0, 8, Math.max(8, viewport.height - size.height - 40))) };
}
function initialMiniPosition(anchor, size, viewport) {
  if (!anchor) return clampMiniPosition({ x: 24, y: viewport.height - size.height - 100 }, size, viewport);
  const x = anchor.left - size.width - 28 >= 8 ? anchor.left - size.width - 28
    : anchor.right + size.width + 28 < viewport.width ? anchor.right + 28 : anchor.left;
  const y = x === anchor.left ? anchor.top - size.height - 32 : anchor.bottom - size.height;
  return clampMiniPosition({ x, y }, size, viewport);
}
function miniTaskTrack(snapshot) {
  // Translate the DSH phase first: the selected main pet may use different
  // animation names or an idle fallback. Never let that mask active work.
  if(['done','failed'].includes(snapshot?.phase)&&snapshot?.animation==='idle')return 'idle';
  return ({ thinking:'running',tool:'running',waiting:'waiting',review:'review',done:'jumping',failed:'failed' })[snapshot?.phase]
    || (MINI_TRACKS.includes(snapshot?.animation) ? snapshot.animation : 'idle');
}
function mainSessionId(byId) {
  return Object.values(byId || {}).find(row => row && row.retainedBy?.mainView > 0)?.id;
}
function miniStatus(snapshot) {
  return ({ thinking:'正在思考…',tool:'正在使用工具…',waiting:'等你确认',review:'有结果待查看',done:'完成啦',failed:'任务出错了',offline:'DSH 连接中断' })[snapshot?.phase] || '';
}
function miniFrameAt(track, elapsed, columns = 8) {
  const frames = (track?.frames || [0]).filter(frame => Number.isInteger(frame) && frame >= 0 && frame < columns);
  if (!frames.length) return { frame: 0, remaining: 500, ended: true };
  const durations = frames.map((_, i) => Math.max(60, Math.min(2000, Number(track?.durations?.[i]) || 150)));
  const total = durations.reduce((a, b) => a + b, 0);
  if (track?.loop !== true && elapsed >= total) return { frame: frames.at(-1), remaining: 0, ended: true };
  let time = Math.max(0, elapsed) % total;
  for (let i=0;i<frames.length;i++) {
    if (time < durations[i]) return { frame: frames[i], remaining: durations[i]-time, ended: false };
    time -= durations[i];
  }
  return { frame: frames[0], remaining: durations[0], ended: false };
}

const clean=(value,limit)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,limit):'';
const labels={thinking:'正在思考…',tool:'正在使用工具…',waiting:'等待你确认',review:'结果待查看',done:'已完成',failed:'任务出错了',offline:'DSH 连接中断'};
// Joins the official pet activity with the official session catalogue. Never
// invents edited-file counts when DSH did not provide them.
function taskPresentation(snapshot,byId={},current=null,history=new Map(),now=Date.now()){
  const rows=(snapshot?.sessions||[]).filter(row=>row?.sessionId&&labels[row.phase]);
  if(!rows.length&&labels[snapshot?.phase])rows.push({sessionId:current||'',phase:snapshot.phase,bubble:snapshot.bubble});
  const ids=new Set();const tasks=[];
  for(const source of rows){
    const id=String(source.sessionId||'');if(ids.has(id))continue;ids.add(id);
    const phase=source.phase,row=byId[id];
    const previous=history.get(id),at=previous?.phase===phase?previous.at:now;
    history.set(id,{phase,at});
    if((phase==='done'&&now-at>10000)||(phase==='failed'&&now-at>30000))continue;
    tasks.push({id,title:clean(row?.title||row?.displayTitle,180)||'当前 DSH 对话',detail:clean(source.bubble,160)||labels[phase],phase,at});
    if(tasks.length===3)break;
  }
  for(const id of history.keys())if(!ids.has(id))history.delete(id);
  return {...snapshot,tasks};
}
function visibleTaskCards(snapshot,now=Date.now()){
  const tasks=Array.isArray(snapshot?.tasks)?snapshot.tasks:[];
  return tasks.filter(task=>task&&typeof task.id==='string'&&labels[task.phase]
    &&!(task.phase==='done'&&Number.isFinite(task.at)&&now-task.at>10000)
    &&!(task.phase==='failed'&&Number.isFinite(task.at)&&now-task.at>30000)).slice(0,3)
    .map(task=>({...task,title:clean(task.title,180)||'当前 DSH 对话',detail:clean(task.detail,160)||labels[task.phase]}));
}


// A separate UI instance. It never writes /api/pet/*, changes the selected pet,
// touches its affinity ledger, or creates an extra account/query client.
function mountCodexMini({ mainBounds = () => null, onVisibleChange = () => {}, refreshQuota = () => {}, newChat = () => {}, voice = () => {}, openTask = () => {}, assetResolver = null, onDragState = () => {}, onDragEvent = () => {} } = {}) {
  const key = 'dsh-codex-mini-v1';
  let settings = { visible: true, size: 160, look: true, idle: true, focusUntil: 0 };
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
  settings.size = Math.max(80, Math.min(896, Number(settings.size) || 160));
  const host = document.createElement('div'); host.dataset.dshCodexMini = '';
  host.style.cssText = 'position:fixed;z-index:2147483002;left:0;top:0;pointer-events:none;';
  const shadow = host.attachShadow({ mode:'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{font:12px/1.4 system-ui,'Microsoft YaHei',sans-serif;color:#e9f0ff;user-select:none}*{box-sizing:border-box}
    .stage{position:relative;pointer-events:none}.sprite{position:relative;background-repeat:no-repeat;cursor:grab;touch-action:none;outline:0;pointer-events:auto;transform-origin:50% 82%}
    .sprite:focus-visible{outline:2px solid #89b7ff;border-radius:18px}.sprite:active{cursor:grabbing}
    .toolbar{display:flex;gap:5px;justify-content:center;position:absolute;top:100%;left:50%;transform:translateX(-50%);padding:5px 8px;border-radius:18px;background:#17191deb;box-shadow:0 4px 14px #0003;pointer-events:auto}
    .stage:hover .toolbar,.stage:focus-within .toolbar{opacity:1;pointer-events:auto}
    button{font:inherit;color:inherit;cursor:pointer;border:0;border-radius:6px;background:transparent;padding:3px 6px;white-space:nowrap}button:hover{background:#ffffff18}
    .toolbar button{font-size:17px;line-height:20px}.toolbar svg{width:18px;height:18px;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.7}
    .quota{position:absolute;top:50%;left:calc(100% + 8px);transform:translateY(-50%);width:96px;border:1px solid #6e7e944b;border-radius:12px;background:#13171ddd;padding:7px;pointer-events:auto}
    .money-row{display:flex;align-items:center;gap:4px;border-bottom:1px solid #91a4be35;padding-bottom:5px;margin:2px 0 5px}.money-amount{flex:1;text-align:right;font-weight:650;font-size:12px}.money-row.stale .money-amount{color:#a2acba}.main-prefs{border-top:1px solid #b7c9f338;margin-top:10px;padding-top:8px}.main-prefs summary{cursor:pointer;color:#c1cee4}
    .cell{display:flex;align-items:center;gap:4px;margin:3px 0}.caption{width:17px;color:#d4dce8;text-align:left}.shell{position:relative;width:57px;height:21px;background:#232933;border:1px solid #a6b2c3;border-radius:4px;padding:2px}.shell:after{content:'';position:absolute;left:100%;top:5px;width:3px;height:9px;border-radius:0 2px 2px 0;background:#a6b2c3}.fill{display:block;height:100%;border-radius:2px;background:#239c72}.percent{position:absolute;inset:0;text-align:center;font-weight:650;line-height:19px;font-size:11px;color:#fff}.stale .fill{background:#647082!important}.stale .percent{color:#c0c9d8}
    .task-cards{position:fixed;display:flex;flex-direction:column;gap:7px;pointer-events:none}.task-cards[hidden]{display:none}
    .task-card{position:relative;border:1px solid #ffffff29;border-radius:30px;background:#212121f2;box-shadow:0 8px 22px #0005,0 1px 1px #ffffff10 inset;pointer-events:auto;overflow:hidden}
    .task-open{display:block;width:100%;padding:11px 36px 11px 16px;text-align:left;border-radius:29px;min-height:56px;white-space:normal}.task-open:hover{background:#ffffff09}
    .task-title,.task-detail{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:18px}.task-title{font-weight:650;color:#f5f5f5;font-size:13px}.task-detail{font-size:12px;color:#b3b3b3;font-weight:400}
    .task-dismiss{position:absolute;right:8px;top:17px;width:22px;height:22px;line-height:18px;padding:0;border-radius:50%;opacity:0;color:#aaa}.task-card:hover .task-dismiss,.task-card:focus-within .task-dismiss{opacity:1}
    .menu{position:fixed;width:205px;max-height:calc(100vh - 16px);overflow:auto;padding:12px;border-radius:12px;border:1px solid #b7c9f347;background:#172238f5;box-shadow:0 4px 18px #0004;pointer-events:auto}
    .menu[hidden]{display:none}.menu label{display:block;margin:8px 0}.menu input[type=range]{width:100%}.menu small{color:#acbad2;display:block;line-height:1.5;margin-top:7px}
    .menu button{display:block;width:100%;text-align:left}button:focus-visible{outline:2px solid #8ebaff;outline-offset:2px}
    .summon{position:fixed;left:16px;bottom:16px;pointer-events:auto;background:#172238eb;border:1px solid #b7c9f340;border-radius:16px;padding:6px 10px}
    .summon[hidden],.stage[hidden]{display:none}
  `;
  const stage = document.createElement('div'); stage.className = 'stage';
  const sprite = document.createElement('div'); sprite.className = 'sprite'; sprite.setAttribute('role','button'); sprite.setAttribute('aria-label','小 DS'); sprite.tabIndex = 0;
  const toolbar = document.createElement('div'); toolbar.className = 'toolbar';
  const menu = document.createElement('div'); menu.className = 'menu'; menu.hidden = true;
  const cards=document.createElement('div');cards.className='task-cards';cards.hidden=true;cards.setAttribute('aria-label','DSH 任务通知');
  const quota=document.createElement('button');quota.type='button';quota.className='quota stale';quota.onclick=()=>refreshQuota();
  const title = document.createElement('b'); title.textContent = '小 DS · DSH 伴宠';
  const sizeLabel = document.createElement('label'); sizeLabel.textContent = '大小 '; const sizeValue = document.createElement('span'); sizeLabel.appendChild(sizeValue);
  const slider = document.createElement('input'); slider.type='range'; slider.min='80'; slider.max='896'; slider.value=String(settings.size); slider.setAttribute('aria-label','小 DS 大小'); sizeLabel.appendChild(slider);
  const lookLabel = document.createElement('label'); const lookInput=document.createElement('input'); lookInput.type='checkbox'; lookInput.checked=settings.look!==false; lookLabel.append(lookInput,document.createTextNode(' 空闲时跟随鼠标看向')); 
  const idleLabel=document.createElement('label'),idleInput=document.createElement('input');idleInput.type='checkbox';idleInput.checked=settings.idle!==false;idleLabel.append(idleInput,document.createTextNode(' 空闲小动作'));
  const note=document.createElement('small'); note.textContent='移入角色立即蹦跳，停留期间持续重复，移出恢复。任务、聊天和语音连接 DSH；DS 金额与 GPT 电池随小 DS 一起移动。';
  function button(label,text,fn) { const b=document.createElement('button'); b.type='button'; b.setAttribute('aria-label',label); b.textContent=text; b.onclick=async e=>{e.stopPropagation();try{const text=await fn();if(typeof text==='string')notify(text);}catch{notify('暂时无法打开，请使用 DSH 原入口重试。');}}; return b; }
  const compose=button('小 DS 新建 DSH 对话','',newChat);compose.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-6M16 3l5 5M10 14l1-5 7-7 5 5-7 7-6 1Z"/></svg>';
  const microphone=button('小 DS 使用 DSH 语音输入','',voice);microphone.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4 10v4M8 6v12M16 7v10M20 10v4"/></svg>';microphone.title='DSH 录音转文字，填入当前对话草稿';
  toolbar.append(compose,microphone,button('小 DS 设置','⚙',()=>{menu.hidden=!menu.hidden;place();}));
  menu.append(title,sizeLabel,lookLabel,idleLabel,button('小 DS 打招呼','打招呼',()=>gesture('waving')),button('小 DS 蹦一下','蹦一下',()=>gesture('jumping')),
    button('小 DS 安静专注','安静专注 25 分钟',()=>{settings.focusUntil=Date.now()+25*60000;save();cancelDecoration();notify('安静专注中，任务状态仍会更新。');}),
    button('小 DS 恢复待机','恢复待机动作',()=>{settings.focusUntil=0;settings.idle=true;idleInput.checked=true;save();nextIdle=Date.now()+12000;}),button('隐藏小 DS','隐藏小 DS',()=>setVisible(false)),note);
  const summon=button('显示小 DS','显示小 DS',()=>setVisible(true)); summon.className='summon'; summon.hidden=true;
  stage.append(sprite,toolbar,quota,cards,menu); shadow.append(style,stage,summon); document.body.appendChild(host);
  let definition=null,snapshot=null,disposed=false,ready=false,placed=false,drag=null,hovering=false,hoverActive=false,hoverTrack=null;
  let timer=null,motion=null,playTrack='idle',baseTrack='idle',started=performance.now(),until=0,nextIdle=Date.now()+16000;
  let pointer={x:0,y:0,at:0},noticeUntil=0,notice='',previousIdle='',geometry=null,lastPosition='',lastQuotaKey='',lastCardsKey='';
  const dismissedTasks=new Set();
  let position = Number.isFinite(settings.x)&&Number.isFinite(settings.y) ? {x:settings.x,y:settings.y} : null;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const off=[];
  const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);off.push(()=>target.removeEventListener(type,fn,options));};
  function save() { try {localStorage.setItem(key,JSON.stringify(settings));} catch {} }
  function dimensions() { const size=Math.min(settings.size,Math.max(80,innerHeight-100),Math.max(80,(innerWidth-132)*208/192));return definition ? miniDimensions(definition,size) : {width:148,height:160}; }
  function footprint(){const size=dimensions();return {width:size.width+108,height:size.height};}
  function allowed() { return !disposed&&settings.visible!==false&&definition&&ready&&snapshot?.pet?.id!==MINI_PET_ID&&document.visibilityState!=='hidden'; }
  function idle() { return isIdle(snapshot); }
  function decorates(){return idle()&&settings.idle!==false&&Date.now()>Number(settings.focusUntil||0)&&!media.matches;}
  function notify(text){notice=text;noticeUntil=Date.now()+6500;renderStatus();schedule();}
  function placeCards(){if(!geometry||cards.hidden)return;const width=Math.min(330,innerWidth-16);cards.style.width=width+'px';cards.style.left=Math.max(8,Math.min(innerWidth-width-8,geometry.x+geometry.width/2-width/2))+'px';const height=cards.offsetHeight||64;const above=geometry.y-height-12;cards.style.top=(above>=8?above:Math.max(8,Math.min(innerHeight-height-8,geometry.y+geometry.height+45)))+'px';}
  function renderStatus(){
    const now=Date.now(),values=(now<noticeUntil?[{id:'notice',title:'小 DS',detail:notice,phase:'notice',at:noticeUntil}]:visibleTaskCards(snapshot,now)).filter(task=>!dismissedTasks.has(task.id+'|'+task.phase+'|'+task.at));
    const key=JSON.stringify(values);if(key===lastCardsKey)return;lastCardsKey=key;cards.replaceChildren();cards.hidden=!values.length;
    for(const task of values){const card=document.createElement('div');card.className='task-card';card.dataset.sessionId=task.id;const open=document.createElement('button');open.type='button';open.className='task-open';open.setAttribute('aria-label',task.title+'，'+task.detail);open.title=task.title+'\n'+task.detail;const heading=document.createElement('span');heading.className='task-title';heading.textContent=task.title;const detail=document.createElement('span');detail.className='task-detail';detail.textContent=task.detail;open.append(heading,detail);open.onclick=()=>{if(task.id!=='notice')openTask(task.id);};const close=document.createElement('button');close.type='button';close.className='task-dismiss';close.textContent='×';close.setAttribute('aria-label','收起任务通知 '+task.title);close.onclick=()=>{dismissedTasks.add(task.id+'|'+task.phase+'|'+task.at);renderStatus();};card.append(open,close);cards.append(card);}
    placeCards();
  }
  function setVisible(value) {settings.visible=Boolean(value);menu.hidden=true;if(!value)hovering=false;syncHover();save();onVisibleChange(settings.visible);visibility();place();schedule();}
  function visibility() { const duplicate=snapshot?.pet?.id===MINI_PET_ID; stage.hidden=settings.visible===false||!definition||!ready||duplicate; summon.hidden=settings.visible!==false; host.dataset.status=!definition?'missing':!ready?'loading':duplicate?'main':'ready'; }
  function place() {
    if(disposed)return;
    const size=dimensions(),viewport={width:innerWidth,height:innerHeight};
    sprite.style.width=size.width+'px';sprite.style.height=size.height+'px';sizeValue.textContent=settings.size+' px'+(size.height<settings.size?'（适应窗口）':'');
    // Until explicitly dragged, keep the companion beside the whole main
    // surface. Switching pets can move its account badge to the opposite side.
    if(!drag&&(!position||!Number.isFinite(settings.x))){const anchor=mainBounds();if(anchor){position=initialMiniPosition(anchor,footprint(),viewport);placed=true;} }
    const at=position?clampMiniPosition(position,footprint(),viewport):initialMiniPosition(null,footprint(),viewport);
    host.style.left=at.x+'px';host.style.top=at.y+'px';host.style.width=size.width+'px';host.style.height=size.height+'px';
    geometry={...at,...size};
    if(position)position=at;
    // Normalised atlas coordinates scale with the element itself, including
    // fractional layout sizes, display zoom and a resize during an action.
    if(definition){sprite.style.backgroundSize=(definition.columns*100)+'% '+(definition.atlasRows*100)+'%';paint();}
    const menuHeight=Math.min(menu.scrollHeight||350,innerHeight-16);
    menu.style.top=Math.max(8,Math.min(innerHeight-menuHeight-8,at.y-menuHeight-8))+'px';menu.style.bottom='auto';
    menu.style.left=Math.max(8,Math.min(innerWidth-213,at.x+size.width-205))+'px';menu.style.right='auto';
    placeCards();
  }
  function track(name) {playTrack=MINI_TRACKS.includes(name)?name:'idle';started=performance.now();sprite.dataset.track=playTrack;}
  function syncHover(){
    const active=Boolean(hovering&&allowed()&&idle()&&!media.matches&&!drag&&menu.hidden&&hoverTrack);
    if(active===hoverActive)return;
    hoverActive=active;until=0;motion?.cancel();track(active?'jumping':baseTrack);nextIdle=Date.now()+16000;
  }
  function cancelDecoration(){hoverActive=false;until=0;motion?.cancel();track(baseTrack);nextIdle=Date.now()+16000;schedule();}
  function startGesture(name){if(!allowed()||!idle()||media.matches||drag||hoverActive)return;motion?.cancel();if(name==='breathe'){motion=sprite.animate([{transform:'scale(1)'},{transform:'scale(1.014,.986)'},{transform:'scale(1)'}],{duration:2200,easing:'ease-in-out'});until=performance.now()+2200;}else{track(name);until=performance.now()+Math.min(6000,totalDuration(definition.tracks[name]));}nextIdle=Date.now()+12000+Math.random()*8000;}
  function gesture(name){startGesture(name);schedule();}
  function totalDuration(value){return (value?.durations||[1000]).reduce((a,b)=>a+b,0);}
  function paint(now=performance.now()) {
    if(!definition||!ready)return 250;
    const size=geometry||dimensions();let row=hoverActive?4:MINI_TRACKS.indexOf(playTrack),frame=miniFrameAt(hoverActive?hoverTrack:definition.tracks[playTrack],media.matches?0:now-started,definition.columns);
    if(!media.matches&&settings.look!==false&&idle()&&playTrack==='idle'&&!hoverActive&&!until&&!drag&&Date.now()-pointer.at<1500&&definition.atlasRows>=11){
      const r=geometry||{x:0,y:0,...size},angle=Math.atan2(pointer.y-(r.y+r.height*.4),pointer.x-(r.x+r.width/2));
      const direction=(Math.round((angle+Math.PI)/(2*Math.PI)*16)+16)%16;row=9+Math.floor(direction/8);frame={frame:direction%8,remaining:100,ended:false};
    }
    const position=miniAtlasPosition(definition,row,frame.frame);
    if(position!==lastPosition){sprite.style.backgroundPosition=position;lastPosition=position;}
    if(frame.ended){track(definition.tracks[playTrack]?.fallback||'idle');return 16;}
    return frame.remaining;
  }
  function tick(now){
    timer=null;
    if(!allowed())return;
    syncHover();
    if(!drag&&!hoverActive&&until&&now>=until){until=0;track(baseTrack);}
    if(!drag&&!hoverActive&&decorates()&&!until&&Date.now()>=nextIdle){const choices=['breathe','waving','jumping'].filter(x=>x!==previousIdle);previousIdle=choices[Math.floor(Math.random()*choices.length)];startGesture(previousIdle);}
    renderStatus();paint(now);
    if(!media.matches)timer=requestAnimationFrame(tick);
  }
  // One display-synchronised loop. Mouse moves and state polls update inputs
  // without cancelling/restarting the animation clock or forcing layout.
  function schedule(){if(!allowed()){if(timer!==null)cancelAnimationFrame(timer);timer=null;}else if(timer===null)timer=requestAnimationFrame(tick);}
  function update(next,definitions){
    if(disposed)return;snapshot=next;
    const found=definitions.find(p=>p.id===MINI_PET_ID&&p.renderer==='sprite2d');
    if(found&&(definition?.atlasUrl!==found.atlasUrl||host.dataset.status==='asset-error')){
      const source=assetResolver?assetResolver(found):found.atlasUrl;
      if(!source)return;
      const url=new URL(source,location.href);
      if(assetResolver?!/^data:image\/(?:png|webp);base64,/.test(source):url.origin!==location.origin||!url.pathname.startsWith('/pet/'))return;
      definition=miniAnimationDefinition(found);hoverTrack={...definition.tracks.jumping,loop:true};ready=false;lastPosition='';const image=new Image();image.onload=()=>{if(disposed)return;ready=true;sprite.style.backgroundImage='url('+JSON.stringify(url.href)+')';syncHover();visibility();place();schedule();};image.onerror=()=>{if(disposed)return;ready=false;visibility();host.dataset.status='asset-error';};image.src=url.href;
    }
    const nextBase=miniTaskTrack(snapshot);
    if(nextBase!==baseTrack||!idle()&&until){baseTrack=nextBase;until=0;motion?.cancel();hoverActive=false;track(baseTrack);nextIdle=Date.now()+16000;}
    syncHover();
    if(!placed&&!Number.isFinite(settings.x)&&mainBounds()){position=null;place();}
    visibility();place();renderStatus();schedule();
  }
  function updateQuota(value,error='',balance=null,balanceError=''){
    const stale=!value||value.stale||Boolean(error)||Date.now()-value.at>300000;
    const moneyStale=!balance||Boolean(balanceError)||Date.now()-balance.at>300000;
    const key=JSON.stringify([value,error,balance,balanceError,stale,moneyStale]);if(key===lastQuotaKey)return;lastQuotaKey=key;
    quota.replaceChildren();quota.classList.toggle('stale',stale);
    const money=document.createElement('span');money.className='money-row'+(moneyStale?' stale':'');
    const moneyLabel=document.createElement('span');moneyLabel.className='caption';moneyLabel.textContent='DS';
    const amount=document.createElement('span');amount.className='money-amount';amount.textContent=balance?(balance.currency==='USD'?'$':'¥')+balance.amount.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'¥--';
    money.append(moneyLabel,amount);quota.appendChild(money);
    const moneyTips=['DeepSeek API 账户金钱余额'];if(balance)moneyTips.push('更新：'+new Date(balance.at).toLocaleTimeString());if(moneyStale)moneyTips.push(balance?'灰色为上次记录，暂未更新':'尚未取得余额');if(balanceError)moneyTips.push(balanceError);money.title=moneyTips.join('\n');
    const tips=[...moneyTips,'GPT / Codex 订阅账号的剩余额度'];
    for(const [key,label] of [['fiveHours','5h'],['week','周']]){
      const win=value?.[key],cell=document.createElement('span');cell.className='cell';const caption=document.createElement('span');caption.className='caption';caption.textContent=label;
      const shell=document.createElement('span');shell.className='shell';const fill=document.createElement('span');fill.className='fill';fill.style.width=(win?.remaining||0)+'%';fill.style.background=win?.remaining<=10?'#dc575f':win?.remaining<=25?'#d6aa48':'#239c72';
      const percent=document.createElement('span');percent.className='percent';percent.textContent=win?Math.round(win.remaining)+'%':'--';shell.append(fill,percent);cell.append(caption,shell);quota.append(cell);
      if(win?.resetsAt)tips.push(label+' 重置：'+new Date(win.resetsAt*1000).toLocaleString());
    }
    if(value)tips.push('GPT 更新：'+new Date(value.at).toLocaleTimeString());if(stale)tips.push(value?'GPT 灰色为上次记录，暂未更新':'尚未取得 GPT 额度');if(error)tips.push(error);tips.push('点击刷新 DS 和 GPT 额度');quota.title=tips.join('\n');quota.setAttribute('aria-label','小 DS 账户额度 '+quota.textContent+'；'+tips.join('；'));
  }
  slider.oninput=()=>{settings.size=Number(slider.value);place();save();};
  lookInput.onchange=()=>{settings.look=lookInput.checked;save();schedule();};
  idleInput.onchange=()=>{settings.idle=idleInput.checked;save();cancelDecoration();};
  listen(sprite,'pointerenter',event=>{if(event.pointerType==='touch')return;hovering=true;syncHover();paint();schedule();});
  listen(sprite,'pointerleave',()=>{hovering=false;syncHover();paint();schedule();});
  listen(sprite,'contextmenu',event=>{event.preventDefault();event.stopPropagation();menu.hidden=!menu.hidden;place();});
  listen(sprite,'pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();menu.hidden=true;
    motion?.cancel();until=0;sprite.__miniDragged=false;
    position=clampMiniPosition({x:parseFloat(host.style.left),y:parseFloat(host.style.top)},footprint(),{width:innerWidth,height:innerHeight});
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...position},moved:false};hoverActive=false;onDragEvent({type:'start',buttons:event.buttons,x:position.x,y:position.y});onDragState(true);try{sprite.setPointerCapture(event.pointerId);}catch{}track(baseTrack);
  });
  listen(window,'pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(event.pointerType!=='touch'&&!(event.buttons&1)){end(event,false,'released-move');return;}
    if(Math.hypot(dx,dy)<4&&!drag.moved)return;drag.moved=true;sprite.__miniDragged=true;
    position=clampMiniPosition({x:drag.start.x+dx,y:drag.start.y+dy},footprint(),{width:innerWidth,height:innerHeight});const name=dx>=0?'running-right':'running-left';if(playTrack!==name)track(name);place();
  },true);
  function end(event,cancelled,reason=event.type){
    if(!drag||drag.id!==event.pointerId)return;event.stopPropagation();const moved=drag.moved;drag=null;onDragState(false);
    onDragEvent({type:'end',reason,buttons:event.buttons,moved,cancelled,x:position.x,y:position.y});
    if(sprite.hasPointerCapture(event.pointerId))sprite.releasePointerCapture(event.pointerId);
    if(moved){settings.x=position.x;settings.y=position.y;placed=true;save();if(!cancelled&&!media.matches)motion=stage.animate([{transform:'scale(1.05,.95)'},{transform:'scale(.985,1.02)'},{transform:'scale(1)'}],{duration:400});}
    hoverActive=false;hovering=sprite.matches(':hover');track(baseTrack);syncHover();nextIdle=Date.now()+16000;schedule();
  }
  listen(window,'pointerup',e=>end(e,false),true);listen(window,'pointercancel',e=>end(e,true),true);listen(sprite,'lostpointercapture',e=>{if(drag&&(!assetResolver||!(e.buttons&1)))end(e,true);});
  listen(sprite,'keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();gesture('waving');}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();event.stopPropagation();const p=position||{x:parseFloat(host.style.left),y:parseFloat(host.style.top)};
      position=clampMiniPosition({x:p.x+(event.key==='ArrowLeft'?-16:event.key==='ArrowRight'?16:0),y:p.y+(event.key==='ArrowUp'?-16:event.key==='ArrowDown'?16:0)},footprint(),{width:innerWidth,height:innerHeight});settings.x=position.x;settings.y=position.y;placed=true;place();save();
    }
  });
  listen(window,'pointermove',event=>{if(drag)return;pointer={x:event.clientX,y:event.clientY,at:Date.now()};});
  listen(window,'resize',place);listen(window,'blur',()=>{if(drag&&!assetResolver)end({pointerId:drag.id,stopPropagation(){}},true);hovering=false;syncHover();schedule();});
  listen(document,'visibilitychange',()=>{hovering=document.visibilityState!=='hidden'&&sprite.matches(':hover');syncHover();schedule();});listen(media,'change',()=>{motion?.cancel();until=0;syncHover();track(hoverActive?'jumping':baseTrack);schedule();});
  function dispose(){if(disposed)return;disposed=true;onDragState(false);if(timer!==null)cancelAnimationFrame(timer);motion?.cancel();off.forEach(fn=>fn());host.remove();}
  updateQuota(null);visibility();place();
  return {update,updateQuota,setVisible,reposition:place,addSettings(element){menu.appendChild(element);element.addEventListener('toggle',place);},get visible(){return settings.visible!==false;},dispose};
}

// Only the installed DSH Desktop preload provides this narrow bridge.
// Ordinary browsers retain the existing page companion.
function mountDesktopMini(options) {
  const bridge=window.dshPetDesktop;
  let visible=true,disposed=false,assetUrl='',lastSnapshot=null,lastDefinitions=[];
  const duplicateStyle=document.createElement('style');
  duplicateStyle.textContent='[data-dsh-pet-overlay]{display:none!important}';
  let mainSettings=null;
  function mainPreferences(){const inputs=mainSettings?.querySelectorAll('input[type=checkbox]');return inputs?.length>=2?{idle:inputs[0].checked,drag:inputs[1].checked}:undefined;}
  function sendState(){send({kind:'state',snapshot:{...lastSnapshot,uniformCursor:document.documentElement.hasAttribute('data-dsh-unified-cursor'),mainPreferences:mainPreferences(),pageControls:{corner:document.querySelectorAll('[data-dsh-desktop-pet-control]').length,mainSettingsConnected:mainSettings?.isConnected===true}},definitions:lastDefinitions});}
  const cursorObserver=new MutationObserver(()=>sendState());
  cursorObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-dsh-unified-cursor']});
  const off=bridge.onAction(action=>{
    if(action.type==='refresh')options.refreshQuota();
    if(action.type==='new-chat')options.newChat();
    if(action.type==='voice')options.voice();
    if(action.type==='open-task')options.openTask(action.value);
    if(action.type==='visibility'){visible=action.value!==false;options.onVisibleChange(visible);}
    if(action.type==='main-pref'&&mainSettings){
      const inputs=mainSettings.querySelectorAll('input[type=checkbox]'),buttons=mainSettings.querySelectorAll('button');
      const match=/^(idle|drag):(on|off)$/.exec(action.value||'');
      if(match){const input=inputs[match[1]==='idle'?0:1];if(input){input.checked=match[2]==='on';input.dispatchEvent(new Event('change'));}}
      if(action.value==='focus')buttons[0]?.click();
      if(action.value==='resume')buttons[1]?.click();
      sendState();
    }
  });
  function send(value){if(!disposed)bridge.publish(value);}
  async function asset(definitions){
    const found=definitions.find(p=>p.id==='deepseek-whale-v2'&&p.renderer==='sprite2d');
    if(!found||found.atlasUrl===assetUrl)return;
    const url=new URL(found.atlasUrl,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/pet/')||url.search||url.hash)return;
    assetUrl=found.atlasUrl;
    try{
      const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('asset');
      const blob=await response.blob();if(blob.size>16*1024*1024)throw Error('large asset');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
      if(!disposed)send({kind:'atlas',url:assetUrl,data});
    }catch{assetUrl='';}
  }
  let preferences={};try{preferences=JSON.parse(localStorage.getItem('dsh-codex-mini-v1')||'{}');}catch{}
  bridge.activate(preferences).then(()=>{if(!disposed)document.head.append(duplicateStyle);}).catch(()=>{console.error('桌面小 DS 未连接，请重启 DSH Desktop。');});
  return {
    update(snapshot,definitions){lastSnapshot=snapshot;lastDefinitions=definitions;sendState();asset(definitions);},
    updateQuota(value,error,balance,balanceError){send({kind:'quota',value,error,balance,balanceError});},
    reposition(){},addSettings(element){mainSettings=element;},
    setVisible(value){visible=Boolean(value);send({kind:'visible',value:visible});},
    get visible(){return visible;},
    dispose(){disposed=true;cursorObserver.disconnect();off();duplicateStyle.remove();bridge.detach();},
  };
}


const inject = ['sessions', 'uiWorkspace'];

function mountEnhancements(ctx) {
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

return {apply:mountEnhancements,inject};
}});
