import type { IdentifierKind, LogEvent } from '../../types/log';
import { hasTime } from '../statistics';

export interface TraceGroup { key:string; kind:IdentifierKind; value:string; scope:string|null; traceContext:string|null; events:LogEvent[] }
export function collectTraces(events:LogEvent[],kind:IdentifierKind):TraceGroup[]{
  const groups=new Map<string,TraceGroup>();const seen=new Set<string>();
  for(const event of events){if(seen.has(event.id))continue;seen.add(event.id);const value=event[kind];if(value===undefined||value==='')continue;
    const scope=event.correlationScope??null,traceContext=kind==='spanId'?event.traceId??null:null,key=JSON.stringify([kind,scope,traceContext,value]);let group=groups.get(key);if(!group){group={key,kind,value,scope,traceContext,events:[]};groups.set(key,group);}group.events.push(event);
  }
  return [...groups.values()].sort((a,b)=>b.events.length-a.events.length||(a.key<b.key?-1:a.key>b.key?1:0));
}
export function buildTrace(group:TraceGroup){
  const timed=group.events.map((event,index)=>({event,index})).filter((item):item is {event:LogEvent&{timestamp:number};index:number}=>hasTime(item.event)).sort((a,b)=>a.event.timestamp-b.event.timestamp||a.index-b.index).map(item=>item.event);
  const untimed=group.events.filter(event=>!hasTime(event));
  const services=new Map<string|null,LogEvent[]>();const files=new Set<string>();let errors=0;
  for(const event of group.events){files.add(event.sourceFileId);const key=event.service??null;const members=services.get(key)??[];members.push(event);services.set(key,members);if(event.level==='ERROR'||event.level==='FATAL')errors++;}
  const timeBases=[...new Set(group.events.map(event=>event.timeSource==='file-setting'?`파일 설정: ${event.assumedTimezone}`:hasTime(event)?`로그/형식: ${event.timezone??'명시 시각'}`:'정규화 시각 없음'))];
  return {group,timed,untimed,services:[...services].map(([service,events])=>({service,events})),fileCount:files.size,errors,timeBases,
    firstSeen:timed[0]?.timestamp??null,lastSeen:timed.at(-1)?.timestamp??null,observedWindowMs:timed.length>=2?timed.at(-1)!.timestamp-timed[0].timestamp:null};
}
