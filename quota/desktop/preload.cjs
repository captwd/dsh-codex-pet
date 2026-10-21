const {contextBridge,ipcRenderer}=require('electron');
const channel='dsh-pet-desktop:overlay';
contextBridge.exposeInMainWorld('desktopPet',Object.freeze({
  ready:()=>ipcRenderer.invoke(channel,{type:'ready'}),
  action:(type,value)=>ipcRenderer.send(channel,{type:'action',action:type,sessionId:type==='open-task'?value:undefined,preference:type==='main-pref'?value:undefined}),
  interaction:dragging=>ipcRenderer.send(channel,{type:'interaction',dragging}),
  layout:value=>ipcRenderer.send(channel,{type:'layout',...value}),
  visible:value=>ipcRenderer.send(channel,{type:'visible',value}),
  diagnostics:value=>ipcRenderer.send(channel,{type:'diagnostics',value}),
  onMessage(listener){const receive=(_event,value)=>listener(value);ipcRenderer.on(channel+':message',receive);return()=>ipcRenderer.removeListener(channel+':message',receive);},
}));
