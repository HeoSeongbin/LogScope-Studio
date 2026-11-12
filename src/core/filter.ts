import type { LogEvent, LogLevel } from '../types/log';
import type { ExplorerFilters } from '../types/search';
import { defaultFilters } from '../types/search';
import { applyTimestamp, baseEvent } from './parsing/common';

export function parseTimeBound(value:string):number|null {
  if(!value.trim())return null;
  const raw=value.trim();
  if(!/(Z|[+-]\d{2}:?\d{2})$/.test(raw))throw new Error('기간에는 시간대를 포함해 주세요. 예: 2026-11-06T14:30:00+09:00');
  const event=baseEvent({fileId:'bound',fileName:'',text:raw},{raw,start:0,end:raw.length,number:1});applyTimestamp(event,raw);
  if(event.timestamp===null)throw new Error('유효하지 않은 기간입니다. 날짜·시각·오프셋을 확인하세요.');
  return event.timestamp;
}
export function filterEvents(events:LogEvent[],selected:LogLevel[],fileId:string,filters:ExplorerFilters=defaultFilters){
  const from=parseTimeBound(filters.from),to=parseTimeBound(filters.to);
  if(from!==null&&to!==null&&from>to)throw new Error('시작 시각은 종료 시각보다 늦을 수 없습니다.');
  return events.filter(event=>{
    if(selected.length&&!selected.includes(event.level))return false;
    if(fileId&&event.sourceFileId!==fileId)return false;
    if(filters.logger&&!(event.logger??'').toLowerCase().includes(filters.logger.toLowerCase()))return false;
    if(filters.thread&&!(event.thread??'').toLowerCase().includes(filters.thread.toLowerCase()))return false;
    if(event.timestamp===null)return filters.includeUntimed;
    return (from===null||event.timestamp>=from)&&(to===null||event.timestamp<=to);
  });
}
export function sortEvents(events:LogEvent[],sort:ExplorerFilters['sort']):LogEvent[]{
  if(sort==='source')return events;
  // Stable ties retain source order. Missing timestamps always form a separate tail.
  return events.map((event,index)=>({event,index})).sort((a,b)=>{
    if(a.event.timestamp===null)return b.event.timestamp===null?a.index-b.index:1;
    if(b.event.timestamp===null)return -1;
    return (sort==='oldest'?a.event.timestamp-b.event.timestamp:b.event.timestamp-a.event.timestamp)||a.index-b.index;
  }).map(item=>item.event);
}
