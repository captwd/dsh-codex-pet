// Appended to DSH's existing sandboxed preload; no Node API is exposed.
{
  const {contextBridge,ipcRenderer}=require('electron');
  const channel='dsh-pet-desktop:v1';
  contextBridge.exposeInMainWorld('dshPetDesktop',Object.freeze({
    activate:preferences=>ipcRenderer.invoke(channel,{type:'activate',preferences}),
    publish:value=>ipcRenderer.send(channel+':publish',value),
    show:()=>ipcRenderer.invoke(channel,{type:'show'}),
    detach:()=>ipcRenderer.send(channel+':detach'),
    onAction(listener){const receive=(_event,value)=>listener(value);ipcRenderer.on(channel+':action',receive);return()=>ipcRenderer.removeListener(channel+':action',receive);},
  }));
}
