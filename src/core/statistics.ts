import { levels, type LogEvent, type LogLevel } from '../types/log';
import { groupExceptions } from './exceptions/groups';

export const bucketSizes={'1m':60000,'5m':300000,'1h':3600000,'1d':86400000} as const;
export type BucketSize=keyof typeof bucketSizes;
export type ErrorSignal='application'|'http5xx'|'exception';
export const MAX_BUCKETS=2000;
export interface Counts { total:number; levels:Record<LogLevel,number>; errors:number; exceptions:number; http4xx:number; http5xx:number }
export interface DimensionCounts extends Counts { key:string|null; name:string|null }
export interface TimeBucket extends Counts { start:number; end:number }
export interface Statistics {
  events:LogEvent[]; summary:Counts; duplicateIds:number; timed:number; untimed:number;
  firstSeen:number|null; lastSeen:number|null; errorRate:number|null;
  files:DimensionCounts[]; services:DimensionCounts[]; loggers:DimensionCounts[];
  exceptionTypes:Array<{type:string|null;count:number}>;
  topExceptions:ReturnType<typeof groupExceptions>;
  topErrors:Array<{message:string;service:string|null;logger:string|null;count:number;representative:LogEvent}>;
}
function emptyCounts():Counts {return {total:0,levels:Object.fromEntries(levels.map(level=>[level,0])) as Record<LogLevel,number>,errors:0,exceptions:0,http4xx:0,http5xx:0};}
function httpClass(event:LogEvent):number|null {
  if(event.parserId!=='iis')return null;
  const value=event.parsedFields['sc-status'];if(typeof value!=='string'||! /^[1-5]\d{2}$/.test(value))return null;
  return Math.floor(Number(value)/100);
}
function add(counts:Counts,event:LogEvent){
  counts.total++;counts.levels[event.level]++;
  if(event.level==='ERROR'||event.level==='FATAL')counts.errors++;
  if(event.exception)counts.exceptions++;
  const status=httpClass(event);if(status===4)counts.http4xx++;if(status===5)counts.http5xx++;
}
export function hasTime(event:LogEvent):event is LogEvent&{timestamp:number}{return event.timestamp!==null&&Number.isFinite(event.timestamp)&&Math.abs(event.timestamp)<=8640000000000000;}
export function aggregateStatistics(input:LogEvent[]):Statistics {
  const summary=emptyCounts();const seen=new Set<string>();const events:LogEvent[]=[];
  const files=new Map<string|null,DimensionCounts>(),services=new Map<string|null,DimensionCounts>(),loggers=new Map<string|null,DimensionCounts>();const types=new Map<string|null,number>();
  const errors=new Map<string,{message:string;service:string|null;logger:string|null;count:number;representative:LogEvent}>();
  let duplicateIds=0,timed=0;let firstSeen:number|null=null,lastSeen:number|null=null;
  function dimension(map:Map<string|null,DimensionCounts>,key:string|null,name:string|null,event:LogEvent){let group=map.get(key);if(!group){group={...emptyCounts(),key,name};map.set(key,group);}add(group,event);}
  for(const event of input){
    if(seen.has(event.id)){duplicateIds++;continue;}seen.add(event.id);events.push(event);add(summary,event);
    dimension(files,event.sourceFileId,event.sourceFileName,event);dimension(services,event.service??null,event.service??null,event);dimension(loggers,event.logger??null,event.logger??null,event);
    if(event.level==='ERROR'||event.level==='FATAL'){const key=JSON.stringify([event.message,event.service??null,event.logger??null]);let error=errors.get(key);if(!error){error={message:event.message,service:event.service??null,logger:event.logger??null,count:0,representative:event};errors.set(key,error);}error.count++;}
    if(event.exception){const type=event.exception.type??null;types.set(type,(types.get(type)??0)+1);}
    if(hasTime(event)){timed++;firstSeen=firstSeen===null?event.timestamp:Math.min(firstSeen,event.timestamp);lastSeen=lastSeen===null?event.timestamp:Math.max(lastSeen,event.timestamp);}
  }
  const sorted=(map:Map<string|null,DimensionCounts>)=>[...map.values()].sort((a,b)=>b.total-a.total||String(a.key).localeCompare(String(b.key),'en'));
  return {events,summary,duplicateIds,timed,untimed:events.length-timed,firstSeen,lastSeen,errorRate:summary.total?summary.errors/summary.total:null,files:sorted(files),services:sorted(services),loggers:sorted(loggers),exceptionTypes:[...types].map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count||String(a.type).localeCompare(String(b.type),'en')),topExceptions:groupExceptions(events),topErrors:[...errors.values()].sort((a,b)=>b.count-a.count)};
}
export interface Timeline { buckets:TimeBucket[]; error?:string; duration:number }
export function buildTimeline(events:LogEvent[],size:BucketSize):Timeline {
  const duration=bucketSizes[size];if(!duration)throw new Error('지원하지 않는 시간 버킷입니다.');
  const seen=new Set<string>();const timed: Array<LogEvent&{timestamp:number}>=[];let first=Infinity,last=-Infinity;
  for(const event of events){if(seen.has(event.id))continue;seen.add(event.id);if(hasTime(event)){timed.push(event);first=Math.min(first,event.timestamp);last=Math.max(last,event.timestamp);}}
  if(!timed.length)return {buckets:[],duration};
  const start=Math.floor(first/duration)*duration;const count=Math.floor(last/duration)-Math.floor(first/duration)+1;
  if(Math.abs(start)>8640000000000000||Math.abs(start+count*duration)>8640000000000000)return {buckets:[],duration,error:'시간 버킷 경계가 표시 가능한 날짜 범위를 벗어났습니다. 기간을 좁혀 주세요.'};
  if(count>MAX_BUCKETS)return {buckets:[],duration,error:`시간 버킷이 ${count.toLocaleString()}개로 한도 ${MAX_BUCKETS.toLocaleString()}개를 초과했습니다. 더 큰 버킷이나 좁은 기간을 선택하세요.`};
  const buckets=Array.from({length:count},(_,i)=>({...emptyCounts(),start:start+i*duration,end:start+(i+1)*duration}));
  for(const event of timed)add(buckets[Math.floor(event.timestamp/duration)-Math.floor(first/duration)],event);
  return {buckets,duration};
}
export function signalCount(counts:Counts,signal:ErrorSignal){return signal==='application'?counts.errors:signal==='http5xx'?counts.http5xx:counts.exceptions;}
export function findConcentrations(buckets:TimeBucket[],signal:ErrorSignal,minCount:number,minPercent:number){
  if(!Number.isSafeInteger(minCount)||minCount<1||!Number.isFinite(minPercent)||minPercent<0||minPercent>100)throw new Error('집중 구간 기준은 건수 1 이상 정수, 비율 0~100%로 입력하세요.');
  return buckets.filter(bucket=>bucket.total>0&&signalCount(bucket,signal)>=minCount&&signalCount(bucket,signal)/bucket.total*100>=minPercent).sort((a,b)=>signalCount(b,signal)-signalCount(a,signal)||a.start-b.start);
}
export function eventsInBucket(events:LogEvent[],bucket:Pick<TimeBucket,'start'|'end'>){return events.filter(event=>hasTime(event)&&event.timestamp>=bucket.start&&event.timestamp<bucket.end);}
