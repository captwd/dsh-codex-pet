import {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,session} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDesktopHostUrl,isAtlasData,shouldIgnoreMouse,validRegions,DESKTOP_ACTIONS,MAIN_PREFERENCES} from './policy.mjs';
const folder=path.dirname(fileURLToPath(import.meta.url));
const hostChannel='dsh-pet-desktop:v1',overlayChannel='dsh-pet-desktop:overlay';
let host=null,window=null,tray=null,preferences={},regions=[],ignore=true,menuOpen=false,dragging=false,pressed=false,lastMouseAt=0,mouseDowns=0,mouseUps=0,diagnostics={},lastHostAt=0,detached=false;
const mouseEvents=[];
const cache=new Map();
const reportPath=()=>path.join(app.getPath('userData'),'desktop-pet-status.json');
function report(){try{fs.writeFileSync(reportPath(),JSON.stringify({version:'0.5.3',pid:process.pid,at:Date.now(),hostAttached:Boolean(host&&!host.isDestroyed()),hostId:host?.id,lastHostAt,window:window&&!window.isDestroyed()?{id:window.id,title:window.getTitle(),visible:window.isVisible(),alwaysOnTop:window.isAlwaysOnTop(),bounds:window.getBounds(),parent:window.getParentWindow()?.id??null,skipTaskbar:window.isSkipTaskbar?.(),ignoreMouse:ignore,focusable:window.isFocusable()}:null,regions,menuOpen,input:{pressed,dragging,mouseDowns,mouseUps,events:mouseEvents},renderer:diagnostics},null,2));}catch{}}
function updateMouseMode(){if(!window||window.isDestroyed())return;const next=shouldIgnoreMouse(screen.getCursorScreenPoint(),window.getBounds(),regions,{pressed,dragging});if(next!==ignore){ignore=next;window.setIgnoreMouseEvents(next,{forward:true});}}
function send(message){if(window&&!window.isDestroyed())window.webContents.send(overlayChannel+':message',message);}
function mainFrame(event){const frame=event.senderFrame,top=event.sender.mainFrame;return Boolean(frame&&top&&frame.routingId===top.routingId&&frame.processId===top.processId);}
function validHost(event){return mainFrame(event)&&isDesktopHostUrl(event.sender.getURL())&&event.sender.session===session.fromPartition('persist:dsh-desktop-renderer');}
function validOverlay(event){return window&&!window.isDestroyed()&&event.sender===window.webContents&&mainFrame(event)&&event.sender.getURL()===new URL('index.html',import.meta.url).href;}
function hostAction(type,value){if(host&&!host.isDestroyed())host.send(hostChannel+':action',{type,value});}
function mainWindow(){return host&&!host.isDestroyed()?BrowserWindow.fromWebContents(host)||BrowserWindow.getAllWindows().find(w=>w.contentView?.children?.some(view=>view.webContents===host)):null;}
function revealHost(){const main=mainWindow();if(main){if(main.isMinimized())main.restore();main.show();main.focus();}}
function fit(){if(!window||window.isDestroyed())return;const display=screen.getDisplayMatching(window.getBounds());window.setBounds(display.workArea);regions=[];}
async function create(){
  if(window&&!window.isDestroyed())return;
  const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  // Keep the Windows window activatable so Chromium can capture a real drag.
  // showInactive avoids stealing focus on startup; blank areas still pass through.
  // Toggling focusability when a menu closes can also reset the native z-order.
  window=new BrowserWindow({title:'DSH · 桌面小 DS',...display.workArea,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:true,skipTaskbar:true,show:false,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,focusable:true,webPreferences:{preload:path.join(folder,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,partition:'persist:dsh-desktop-pet-v1'}});
  window.setAlwaysOnTop(true,'floating');window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});window.setIgnoreMouseEvents(true,{forward:true});ignore=true;
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  // Lock input before Chromium dispatches pointerdown. Renderer layout and
  // pointer-capture reports may arrive later than a fast movement off the pet.
  window.webContents.on('before-mouse-event',(_event,mouse)=>{
    lastMouseAt=Date.now();
    if(mouse.type!=='mouseMove'&&mouse.type!=='mouseEnter'&&mouse.type!=='mouseLeave'){mouseEvents.push({type:mouse.type,button:mouse.button,at:lastMouseAt});if(mouseEvents.length>12)mouseEvents.shift();}
    if(mouse.type==='mouseDown'&&mouse.button==='left'){pressed=true;mouseDowns++;}
    if(mouse.type==='mouseUp'&&mouse.button==='left'){pressed=false;mouseUps++;}
    updateMouseMode();
  });
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.webContents.on('console-message',(_event,...args)=>{if(String(args[1]||'').includes('Error'))process.stderr.write('[desktop-pet] renderer error\n');});
  window.on('closed',()=>{window=null;regions=[];pressed=false;dragging=false;report();});
  window.webContents.on('did-finish-load',()=>{send({kind:'init',preferences});for(const message of cache.values())send(message);window?.showInactive();report();});
  await window.loadFile(path.join(folder,'index.html'));
  if(!tray){
    const icon=nativeImage.createFromPath(path.resolve(folder,'../../build/app-icon.png')).resize({width:20,height:20});
    tray=new Tray(icon);tray.setToolTip('DSH 桌面小 DS · 额度与任务陪伴');
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'显示小 DS / 设置',click:()=>{create().then(()=>send({kind:'show'}));}},
      {label:'移到鼠标所在屏幕',click:()=>{window?.setBounds(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea);send({kind:'show'});}},
      {label:'打开 DSH',click:revealHost},
      {label:'隐藏小 DS',click:()=>send({kind:'visible',value:false})},
    ]));tray.on('click',()=>{send({kind:'show'});});
  }
}
ipcMain.handle(hostChannel,async(event,message)=>{
  if(!validHost(event))throw Error('Unsupported desktop pet sender '+JSON.stringify({frame:mainFrame(event),url:isDesktopHostUrl(event.sender.getURL()),session:event.sender.session===session.fromPartition('persist:dsh-desktop-renderer')}));
  if(message?.type==='activate'){
    host=event.sender;detached=false;preferences=message.preferences&&typeof message.preferences==='object'?message.preferences:{};lastHostAt=Date.now();
    host.setBackgroundThrottling(false);
    host.once('destroyed',()=>{host=null;send({kind:'offline'});report();});
    await create();report();return{ok:true};
  }
  if(event.sender!==host)throw Error('Inactive desktop pet generation');
  if(message?.type==='show'){await create();send({kind:'show'});}
});
ipcMain.on(hostChannel+':publish',(event,message)=>{
  if(!validHost(event)||event.sender!==host||!message||typeof message!=='object')return;
  if(message.kind==='atlas'){if(!isAtlasData(message.data))return;}
  else if(!['state','quota','visible'].includes(message.kind)||JSON.stringify(message).length>600000)return;
  cache.set(message.kind,message);lastHostAt=Date.now();send(message);
});
ipcMain.on(hostChannel+':detach',(event)=>{if(validHost(event)&&event.sender===host){detached=true;send({kind:'offline'});}});
ipcMain.handle(overlayChannel,(event,message)=>{if(!validOverlay(event))throw Error('Unsupported pet window');if(message?.type==='ready')return{kind:'init',preferences};});
ipcMain.on(overlayChannel,(event,message)=>{
  if(!validOverlay(event))return;
  if(message?.type==='interaction'){dragging=Boolean(message.dragging);updateMouseMode();}
  if(message?.type==='layout'){regions=validRegions(message.regions);dragging=Boolean(message.dragging);const value=Boolean(message.menuOpen);if(value!==menuOpen){menuOpen=value;if(value)window.focus();}}
  if(message?.type==='visible')hostAction('visibility',message.value!==false);
  if(message?.type==='action'&&DESKTOP_ACTIONS.has(message.action)){
    if(['new-chat','voice','open-task','show-dsh'].includes(message.action))revealHost();
    if(message.action==='main-pref'){if(MAIN_PREFERENCES.has(message.preference))hostAction('main-pref',message.preference);}
    else hostAction(message.action,typeof message.sessionId==='string'&&message.sessionId.length<=300?message.sessionId:undefined);
  }
  if(message?.type==='diagnostics'){diagnostics=message.value||{};report();}
});
app.whenReady().then(()=>{
  screen.on('display-removed',fit);screen.on('display-metrics-changed',fit);
  const timer=setInterval(()=>{
    if(!window||window.isDestroyed())return;
    if(pressed&&Date.now()-lastMouseAt>15000){pressed=false;dragging=false;}
    updateMouseMode();
    if((!host||host.isDestroyed()||detached)&&lastHostAt&&Date.now()-lastHostAt>12000)send({kind:'offline'});
  },32);timer.unref();
});
app.on('before-quit',()=>{tray?.destroy();tray=null;});
