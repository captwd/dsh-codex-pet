import { MINI_PET_ID, MINI_TRACKS, miniAnimationDefinition, miniAtlasPosition, miniDimensions, clampMiniPosition, initialMiniPosition, miniTaskTrack, miniFrameAt, miniStatus } from './mini-core.mjs';
import { isIdle } from './core.mjs';
import { visibleTaskCards } from './task-core.mjs';

// A separate UI instance. It never writes /api/pet/*, changes the selected pet,
// touches its affinity ledger, or creates an extra account/query client.
export function mountCodexMini({ mainBounds = () => null, onVisibleChange = () => {}, refreshQuota = () => {}, newChat = () => {}, voice = () => {}, openTask = () => {}, assetResolver = null, onDragState = () => {}, onDragEvent = () => {} } = {}) {
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
