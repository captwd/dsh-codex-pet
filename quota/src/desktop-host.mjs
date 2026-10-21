// Only the installed DSH Desktop preload provides this narrow bridge.
// Ordinary browsers retain the existing page companion.
export function mountDesktopMini(options) {
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
