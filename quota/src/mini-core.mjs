export const MINI_PET_ID = 'deepseek-whale-v2';
export const MINI_TRACKS = ['idle','running-right','running-left','waving','jumping','failed','waiting','running','review'];
// Codex 26.1013's active sprite timing, applied only to this companion.
// A brief idle blink/shift is separated by resting poses instead of holding
// every intermediate pose for half a second as the DSH import does.
export function miniAnimationDefinition(definition) {
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
export function miniDimensions(definition, size) {
  const height = Math.round(miniClamp(Number(size) || 160, 80, 896));
  return { width: Math.max(1, Math.round(height * definition.cell.width / definition.cell.height)), height };
}
export function miniAtlasPosition(definition,row,column){
  const x=100*column/Math.max(1,definition.columns-1);
  const y=100*row/Math.max(1,definition.atlasRows-1);
  return x+'% '+y+'%';
}
export function clampMiniPosition(position, size, viewport) {
  return { x: Math.round(miniClamp(Number(position.x) || 0, 8, Math.max(8, viewport.width - size.width - 8))),
    y: Math.round(miniClamp(Number(position.y) || 0, 8, Math.max(8, viewport.height - size.height - 40))) };
}
export function initialMiniPosition(anchor, size, viewport) {
  if (!anchor) return clampMiniPosition({ x: 24, y: viewport.height - size.height - 100 }, size, viewport);
  const x = anchor.left - size.width - 28 >= 8 ? anchor.left - size.width - 28
    : anchor.right + size.width + 28 < viewport.width ? anchor.right + 28 : anchor.left;
  const y = x === anchor.left ? anchor.top - size.height - 32 : anchor.bottom - size.height;
  return clampMiniPosition({ x, y }, size, viewport);
}
export function miniTaskTrack(snapshot) {
  // Translate the DSH phase first: the selected main pet may use different
  // animation names or an idle fallback. Never let that mask active work.
  if(['done','failed'].includes(snapshot?.phase)&&snapshot?.animation==='idle')return 'idle';
  return ({ thinking:'running',tool:'running',waiting:'waiting',review:'review',done:'jumping',failed:'failed' })[snapshot?.phase]
    || (MINI_TRACKS.includes(snapshot?.animation) ? snapshot.animation : 'idle');
}
export function mainSessionId(byId) {
  return Object.values(byId || {}).find(row => row && row.retainedBy?.mainView > 0)?.id;
}
export function miniStatus(snapshot) {
  return ({ thinking:'正在思考…',tool:'正在使用工具…',waiting:'等你确认',review:'有结果待查看',done:'完成啦',failed:'任务出错了',offline:'DSH 连接中断' })[snapshot?.phase] || '';
}
export function miniFrameAt(track, elapsed, columns = 8) {
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
