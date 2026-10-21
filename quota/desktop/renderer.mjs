import {mountCodexMini} from './src/codex-mini.mjs';
import {mountCursor} from './cursor-runtime.mjs';
const uniformCursor=mountCursor(document);
window.addEventListener('beforeunload',()=>uniformCursor.dispose(),{once:true});
const api=window.desktopPet;
let atlas='',state=null,definitions=[],mini=null,lastLayout='',lastStateAt=0,offline=false,dragging=false;
let mainPreferenceControls=null;
const dragEvents=[];
function update(){if(mini&&state&&atlas)mini.update(state,definitions);}
function receive(message){
  if(message.kind==='init'){
    if(!localStorage.getItem('dsh-codex-mini-v1')){const p=message.preferences||{};delete p.x;delete p.y;localStorage.setItem('dsh-codex-mini-v1',JSON.stringify(p));}
    if(!mini){
      mini=mountCodexMini({assetResolver:()=>atlas,onDragState:value=>{dragging=value;api.interaction(value);},onDragEvent:value=>{dragEvents.push({...value,at:Date.now()});if(dragEvents.length>12)dragEvents.shift();},onVisibleChange:value=>api.visible(value),refreshQuota:()=>api.action('refresh'),newChat:()=>api.action('new-chat'),voice:()=>api.action('voice'),openTask:id=>api.action('open-task',id)});
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='桌面选项';details.className='main-prefs';details.append(summary);
      const open=document.createElement('button');open.textContent='打开 DSH';open.onclick=()=>api.action('show-dsh');details.append(open);mini.addSettings(details);
      const mainPrefs=document.createElement('details');mainPrefs.className='main-prefs';mainPrefs.hidden=true;const caption=document.createElement('summary');caption.textContent='主宠待机设置';mainPrefs.append(caption);mainPreferenceControls={root:mainPrefs};
      for(const [key,text] of [['idle','主宠空闲小动作'],['drag','主宠拖拽回弹']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.onchange=()=>api.action('main-pref',key+':'+(input.checked?'on':'off'));label.append(input,document.createTextNode(' '+text));mainPrefs.append(label);mainPreferenceControls[key]=input;}
      for(const [text,value] of [['主宠安静专注 25 分钟','focus'],['恢复主宠待机动作','resume']]){const button=document.createElement('button');button.textContent=text;button.onclick=()=>api.action('main-pref',value);mainPrefs.append(button);}mini.addSettings(mainPrefs);
    }
  }
  if(message.kind==='state'){state=message.snapshot;uniformCursor.setEnabled(state?.uniformCursor===true);definitions=message.definitions||[];lastStateAt=Date.now();offline=false;if(mainPreferenceControls&&state?.mainPreferences){mainPreferenceControls.root.hidden=false;mainPreferenceControls.idle.checked=state.mainPreferences.idle!==false;mainPreferenceControls.drag.checked=state.mainPreferences.drag!==false;}update();}
  if(message.kind==='atlas'){atlas=message.data;update();}
  if(message.kind==='quota')mini?.updateQuota(message.value,message.error,message.balance,message.balanceError);
  if(message.kind==='visible')mini?.setVisible(message.value);
  if(message.kind==='show'){mini?.setVisible(true);const root=document.querySelector('[data-dsh-codex-mini]')?.shadowRoot;const menu=root?.querySelector('.menu');if(menu){menu.hidden=false;mini.reposition();}}
  if(message.kind==='offline'){offline=true;mini?.update({...state,phase:'offline',animation:'idle',sessionActive:true},definitions);}
}
api.onMessage(receive);receive(await api.ready());
// The native window ignores mouse input outside these visible controls.
// Layout is sampled independently from animation frames, without DOM writes.
setInterval(()=>{
  const root=document.querySelector('[data-dsh-codex-mini]')?.shadowRoot;if(!root)return;
  const regions=[...root.querySelectorAll('.sprite,.toolbar,.quota,.task-card,.menu,.summon')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
  const menuOpen=!root.querySelector('.menu')?.hidden;
  const value={regions,menuOpen,dragging};
  const key=JSON.stringify(value);if(key!==lastLayout){lastLayout=key;api.layout(value);}
  if(lastStateAt&&Date.now()-lastStateAt>12000&&!offline){offline=true;mini?.update({...state,phase:'offline',animation:'idle',sessionActive:true},definitions);}
},80);
setInterval(()=>{const r=document.querySelector('[data-dsh-codex-mini]')?.shadowRoot,s=r?.querySelector('.sprite');api.diagnostics({track:s?.dataset.track,size:r?.querySelector('[aria-label="小 DS 大小"]')?.value,quota:r?.querySelector('.quota')?.textContent,backgroundSize:s?.style.backgroundSize,backgroundPosition:s?.style.backgroundPosition,petBounds:s?.getBoundingClientRect().toJSON(),taskCards:[...r?.querySelectorAll('.task-card')||[]].map(card=>({id:card.dataset.sessionId,title:card.querySelector('.task-title')?.textContent,detail:card.querySelector('.task-detail')?.textContent})),pageControls:state?.pageControls,mainPreferencesAvailable:Boolean(state?.mainPreferences),dragging,dragEvents,uniformCursor:uniformCursor.enabled,lastStateAt,offline});},1500);
