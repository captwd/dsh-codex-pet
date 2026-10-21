const clean=(value,limit)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,limit):'';
const labels={thinking:'正在思考…',tool:'正在使用工具…',waiting:'等待你确认',review:'结果待查看',done:'已完成',failed:'任务出错了',offline:'DSH 连接中断'};
// Joins the official pet activity with the official session catalogue. Never
// invents edited-file counts when DSH did not provide them.
export function taskPresentation(snapshot,byId={},current=null,history=new Map(),now=Date.now()){
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
export function visibleTaskCards(snapshot,now=Date.now()){
  const tasks=Array.isArray(snapshot?.tasks)?snapshot.tasks:[];
  return tasks.filter(task=>task&&typeof task.id==='string'&&labels[task.phase]
    &&!(task.phase==='done'&&Number.isFinite(task.at)&&now-task.at>10000)
    &&!(task.phase==='failed'&&Number.isFinite(task.at)&&now-task.at>30000)).slice(0,3)
    .map(task=>({...task,title:clean(task.title,180)||'当前 DSH 对话',detail:clean(task.detail,160)||labels[task.phase]}));
}
