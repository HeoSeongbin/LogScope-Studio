import type { LogEvent } from '../types/log';
import { aggregateStatistics, buildTimeline, type BucketSize } from './statistics';
import { groupExceptions } from './exceptions/groups';
import { buildTrace, type TraceGroup } from './correlation/trace';

export const MAX_EXPORT_EVENTS=50000;
export const MAX_EXPORT_BYTES=32*1024*1024;
export type ExportFormat='json'|'csv'|'html';
export interface ExportDataset {
  kind:string; title:string; sourceEventCount:number; context:object;
  columns:string[]; rows:object[]; summary:object;
}
const eventColumns=['id','sourceFileId','sourceFileName','lineStart','lineEnd','timestamp','rawTimestamp','timezone','timeSource','assumedTimezone','level','service','serviceSource','host','thread','logger','requestId','traceId','spanId','correlationId','customId','correlationScope','message','exception','rawText','parsedFields','parserId','parseWarnings','parseErrors'];
function checkCount(events:LogEvent[]){if(events.length>MAX_EXPORT_EVENTS)throw new Error('EXPORT_LIMIT: 내보내기는 원본 이벤트 50,000개까지 지원합니다. 파일·기간·레벨 조건을 좁혀 주세요.');}
function overview(events:LogEvent[]){
  const stats=aggregateStatistics(events);
  return {counts:stats.summary,timed:stats.timed,untimed:stats.untimed,firstSeen:stats.firstSeen,lastSeen:stats.lastSeen,errorRate:stats.errorRate,duplicateIds:stats.duplicateIds};
}
export function eventDataset(events:LogEvent[],context:object,title='현재 필터 결과'):ExportDataset {
  checkCount(events);return {kind:'events',title,sourceEventCount:events.length,context,columns:eventColumns,rows:events,summary:overview(events)};
}
export function exceptionGroupsDataset(events:LogEvent[],context:object):ExportDataset {
  checkCount(events);const rows=groupExceptions(events).map(group=>({fingerprint:group.fingerprint,type:group.type,message:group.message,count:group.events.length,firstSeen:group.firstSeen,lastSeen:group.lastSeen,untimedCount:group.untimedCount,files:group.files,services:group.services,eventIds:group.events.map(event=>event.id)}));
  return {kind:'exception-groups',title:'현재 필터의 오류 그룹',sourceEventCount:events.length,context,columns:['fingerprint','type','message','count','firstSeen','lastSeen','untimedCount','files','services','eventIds'],rows,summary:{groupCount:rows.length,...overview(events)}};
}
export function exceptionDataset(event:LogEvent,context:object):ExportDataset {
  if(!event.exception)throw new Error('예외가 있는 이벤트를 먼저 선택하세요.');
  return {...eventDataset([event],context,'선택 Exception 상세'),kind:'exception-detail'};
}
export function traceDataset(group:TraceGroup,context:object):ExportDataset {
  checkCount(group.events);const trace=buildTrace(group);
  return {...eventDataset([...trace.timed,...trace.untimed],{...context,identifier:{kind:group.kind,value:group.value,scope:group.scope,traceContext:group.traceContext},order:'정규화 시각 오름차순 후 미확인 시각의 원본 순서'},'선택 식별자 관측 타임라인'),kind:'trace',summary:{...overview(group.events),observedWindowMs:trace.observedWindowMs,timeBases:trace.timeBases}};
}
export function timelineDataset(events:LogEvent[],size:BucketSize,context:object):ExportDataset {
  checkCount(events);const timeline=buildTimeline(events,size);if(timeline.error)throw new Error(timeline.error);
  return {kind:'timeline',title:'현재 필터의 UTC 시간대별 통계',sourceEventCount:events.length,context:{...context,bucketSize:size,bucketBounds:'[start,end)',timezone:'UTC'},columns:['start','end','total','levels','errors','exceptions','http4xx','http5xx'],rows:timeline.buckets,summary:overview(events)};
}
export function statisticsDataset(events:LogEvent[],context:object):ExportDataset {
  checkCount(events);const stats=aggregateStatistics(events);
  return {kind:'statistics',title:'현재 필터의 요약 통계',sourceEventCount:events.length,context,columns:['summary','timed','untimed','firstSeen','lastSeen','errorRate','duplicateIds','files','services','loggers','exceptionTypes'],rows:[{summary:stats.summary,timed:stats.timed,untimed:stats.untimed,firstSeen:stats.firstSeen,lastSeen:stats.lastSeen,errorRate:stats.errorRate,duplicateIds:stats.duplicateIds,files:stats.files,services:stats.services,loggers:stats.loggers,exceptionTypes:stats.exceptionTypes}],summary:overview(events)};
}
export function csvCell(value:unknown){
  let text=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);
  // Protect formula prefixes even after whitespace, including full-width variants.
  let prefix=0;while(prefix<text.length&&(text.charCodeAt(prefix)<=32||/\s/u.test(text[prefix])))prefix++;
  if(/[=+\-@＝＋－＠]/u.test(text[prefix]??'')||/^[\t\r\n]/u.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function escapeHtml(text:string){return text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
const policy={data:'정규화 분석 결과입니다. 원본 파일 전체의 복사본이 아닙니다. rawText는 이벤트 원문이고 시간·서비스 설정 근거는 별도 필드입니다.',time:'timestamp/firstSeen/lastSeen/start/end는 epoch milliseconds이며 null/누락은 미확인입니다. 오류 비율은 ERROR+FATAL / 전체입니다.',privacy:'민감 정보가 포함될 수 있습니다. 자동 마스킹하지 않았습니다.',csv:'UTF-8 BOM, CRLF, 모든 셀 큰따옴표. 수식 위험 접두사는 작은따옴표를 추가합니다. 빈 값과 null/누락은 CSV에서 구분되지 않으므로 정확한 데이터는 JSON을 사용하세요. 스프레드시트 재저장 후 수식 방어는 보장하지 않습니다.',interpretation:'예외·HTTP 상태·오류 레벨은 독립 지표입니다. 같은 fingerprint/ID 또는 관측 순서가 동일 원인·인과관계·완전한 요청 수명을 뜻하지 않습니다.'};
export interface ExportArtifact {blob:Blob;filename:string;bytes:number;rows:number}
export async function serializeExport(dataset:ExportDataset,format:ExportFormat,options:{signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void;maxBytes?:number}={}):Promise<ExportArtifact>{
  if(dataset.sourceEventCount>MAX_EXPORT_EVENTS)throw new Error('EXPORT_LIMIT: 원본 이벤트 한도를 초과했습니다.');
  const max=Math.min(options.maxBytes??MAX_EXPORT_BYTES,MAX_EXPORT_BYTES),parts:BlobPart[]=[];let bytes=0;
  const encoder=new TextEncoder();const check=()=>{if(options.signal?.aborted)throw new DOMException('내보내기를 취소했습니다.','AbortError');};
  function add(text:string){check();const chunk=encoder.encode(text);bytes+=chunk.byteLength;if(bytes>max)throw new Error('EXPORT_LIMIT: 내보내기 결과는 최대 32 MiB입니다. 범위를 좁혀 다시 시도하세요.');parts.push(chunk);}
  const metadata={schemaVersion:1,kind:dataset.kind,title:dataset.title,sourceEventCount:dataset.sourceEventCount,rowCount:dataset.rows.length,context:dataset.context,policy,summary:dataset.summary};
  check();options.onProgress?.(0,dataset.rows.length);await new Promise(resolve=>setTimeout(resolve,0));check();
  if(format==='json')add('{"metadata":'+JSON.stringify(metadata)+',"rows":[');
  else if(format==='csv')add('\ufeff'+['exportKind','exportContext',...dataset.columns].map(csvCell).join(',')+'\r\n');
  else add('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>LogScope 분석 리포트</title><style>body{font:15px/1.7 system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#172b3e}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f4f7;padding:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b8c6cf;padding:8px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:24px}</style><h1>'+escapeHtml(dataset.title)+'</h1><p>LogScope Studio · 정규화 분석 리포트 · '+dataset.rows.length+'개 행</p><h2>범위·집계·해석 정책</h2><pre>'+escapeHtml(JSON.stringify(metadata,null,2))+'</pre><h2>분석 데이터</h2><table><thead><tr>'+dataset.columns.map(column=>'<th scope="col">'+escapeHtml(column)+'</th>').join('')+'</tr></thead><tbody>');
  for(let i=0;i<dataset.rows.length;i++){
    const row=dataset.rows[i] as Record<string,unknown>;
    if(format==='json')add((i?',':'')+JSON.stringify(row));
    else if(format==='csv')add([csvCell(dataset.kind),csvCell(dataset.context),...dataset.columns.map(column=>csvCell(row[column]))].join(',')+'\r\n');
    else add('<tr>'+dataset.columns.map(column=>'<td>'+escapeHtml(row[column]===undefined?'':JSON.stringify(row[column]))+'</td>').join('')+'</tr>');
    if((i+1)%100===0){options.onProgress?.(i+1,dataset.rows.length);await new Promise(resolve=>setTimeout(resolve,0));check();}
  }
  if(format==='json')add(']}');else if(format==='html')add('</tbody></table></html>');
  check();options.onProgress?.(dataset.rows.length,dataset.rows.length);
  return {blob:new Blob(parts,{type:format==='json'?'application/json;charset=utf-8':format==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8'}),filename:`logscope-${dataset.kind}.${format}`,bytes,rows:dataset.rows.length};
}
