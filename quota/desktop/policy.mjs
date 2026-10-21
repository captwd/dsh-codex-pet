export function isDesktopHostUrl(raw){
  try{const url=new URL(raw);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'&&['compatibility','extended','upstream'].includes(url.searchParams.get('dsh-desktop-mode'));}catch{return false;}
}
export function isAtlasData(value){return typeof value==='string'&&value.length<24*1024*1024&&/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}
export function insideRegions(point,bounds,regions){const x=point.x-bounds.x,y=point.y-bounds.y;return regions.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);}
export function shouldIgnoreMouse(point,bounds,regions,{pressed=false,dragging=false}={}){return !pressed&&!dragging&&!insideRegions(point,bounds,regions);}
export function validRegions(input){return Array.isArray(input)?input.slice(0,20).filter(r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0&&r.width<=10000&&r.height<=10000):[];}
export const DESKTOP_ACTIONS=new Set(['refresh','new-chat','voice','open-task','main-pref','show-dsh']);
export const MAIN_PREFERENCES=new Set(['idle:on','idle:off','drag:on','drag:off','focus','resume']);
