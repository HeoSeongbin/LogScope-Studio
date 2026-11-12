export const ROW_HEIGHT=62;
export const VIEWPORT_HEIGHT=434;
export const OVERSCAN=5;
export function virtualWindow(count:number,scrollTop:number,height=VIEWPORT_HEIGHT){
  const top=Math.max(0,Math.min(scrollTop,Math.max(0,count*ROW_HEIGHT-height)));
  const start=Math.max(0,Math.floor(top/ROW_HEIGHT)-OVERSCAN);
  const end=Math.min(count,Math.ceil((top+height)/ROW_HEIGHT)+OVERSCAN);
  return {start,end,top:start*ROW_HEIGHT,bottom:Math.max(0,(count-end)*ROW_HEIGHT)};
}
