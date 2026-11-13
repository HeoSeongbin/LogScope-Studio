import { useMemo, useState } from 'react';
import { collectTraces, buildTrace } from '../core/correlation/trace';
import { identifierNames } from '../core/correlation/identifiers';
import { hasTime } from '../core/statistics';
import { ExportControls } from './ExportControls';
import { traceDataset } from '../core/export';
import type { IdentifierKind, LogEvent, SourceFile } from '../types/log';

function serviceLabel(event:LogEvent){return event.service===undefined?'서비스 미기록':event.service===''?'빈 서비스명':event.service;}
function TraceEvents({events,files,select,title}:{events:LogEvent[];files:SourceFile[];select:(id:string)=>void;title:string}){
  const [page,setPage]=useState(0);const current=Math.min(page,Math.max(0,Math.ceil(events.length/50)-1));
  return <section className="trace-events"><h3>{title} · {events.length}개</h3>{events.slice(current*50,(current+1)*50).map((event,index)=>{
    const previous=events[current*50+index-1];const httpError=event.parserId==='iis'&&/^5\d{2}$/.test(String(event.parsedFields['sc-status']));const error=event.level==='ERROR'||event.level==='FATAL';
    return <button key={event.id} className={`trace-event ${error||event.exception||httpError?'trace-error':''}`} style={{borderLeftColor:files.find(file=>file.id===event.sourceFileId)?.color??'#7cbbef'}} onClick={()=>select(event.id)} aria-label={`추적 원본 보기 ${event.sourceFileName} 줄 ${event.lineStart}`}>
      <span className="trace-event-top"><strong>{serviceLabel(event)}{event.serviceSource==='file-setting'?' (파일 설정)':''}</strong><span className={`badge ${event.level}`}>{event.level}</span>{event.exception&&<span className="badge ERROR">예외</span>}{httpError&&<span className="badge WARN">HTTP 5xx</span>}</span>
      <span className="trace-time">{hasTime(event)?new Date(event.timestamp).toISOString():'정규화 시각 없음'}{hasTime(event)&&previous&&hasTime(previous)&&<small>이전 관측과 +{event.timestamp-previous.timestamp} ms</small>}</span>
      <span className="trace-message">{event.message||'(빈 메시지)'}</span><small>원문 시각: {event.rawTimestamp??'없음'} · {event.sourceFileName} 줄 {event.lineStart}–{event.lineEnd}</small>
      {event.timeSource==='file-setting'&&<small>사용자 시간대 설정: {event.assumedTimezone}</small>}
    </button>;
  })}{!events.length&&<p className="statistics-note">해당 구간의 이벤트가 없습니다.</p>}<div className="pagination"><span>{current+1} / {Math.max(1,Math.ceil(events.length/50))}</span><button disabled={!current} onClick={()=>setPage(current-1)}>추적 이전</button><button disabled={(current+1)*50>=events.length} onClick={()=>setPage(current+1)}>추적 다음</button></div></section>;
}
export function TraceExplorer({events,allEvents,files,select,filterPending=false,filterError,exportContext}:{events:LogEvent[];allEvents:LogEvent[];files:SourceFile[];select:(id:string)=>void;filterPending?:boolean;filterError?:string;exportContext?:object}){
  const [kind,setKind]=useState<IdentifierKind>('requestId');const [draft,setDraft]=useState('');const [query,setQuery]=useState('');const [entire,setEntire]=useState(false);const [key,setKey]=useState<string|null>(null);const [page,setPage]=useState(0);
  const ready=entire||(!filterPending&&!filterError);
  const catalog=useMemo(()=>collectTraces(entire?allEvents:events,kind),[allEvents,events,entire,kind]);
  const groups=useMemo(()=>query===''?catalog:catalog.filter(group=>group.value===query),[catalog,query]);
  const selected=key===null?groups[0]:groups.find(group=>group.key===key);
  const trace=useMemo(()=>selected?buildTrace(selected):undefined,[selected]);
  const exportRevision=useMemo(()=>({selected,entire,exportContext,files,ready}),[selected,entire,exportContext,files,ready]);
  const current=Math.min(page,Math.max(0,Math.ceil(groups.length/50)-1));
  return <section className="log-panel trace-explorer" aria-label="Request Trace Explorer">
    <div className="panel-heading"><h2>요청 추적 <span>{ready?`${groups.length}개 식별자 그룹`:'검색 대기'}</span></h2></div>
    <form className="trace-controls" onSubmit={event=>{event.preventDefault();setQuery(draft);setKey(null);setPage(0);}}><label>식별자 타입<select aria-label="추적 식별자 타입" value={kind} onChange={event=>{setKind(event.target.value as IdentifierKind);setDraft('');setQuery('');setKey(null);setPage(0);}}>{(Object.keys(identifierNames) as IdentifierKind[]).map(type=><option key={type} value={type}>{identifierNames[type]}</option>)}</select></label><label className="trace-query">식별자 값 (정확히 일치)<input aria-label="추적 식별자 값" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="빈 값은 관측된 모든 식별자"/></label><button type="submit">식별자 검색</button><label className="checkbox-label"><input type="checkbox" checked={entire} onChange={event=>{setEntire(event.target.checked);setKey(null);setPage(0);}}/>전체 세션에서 추적 (공통 필터 무시)</label></form>
    <p className="analysis-note">{entire?'전체 세션의 모든 파일을 분석합니다. 검색·기간·레벨·파일 필터를 적용하지 않습니다.':'현재 검색·기간·레벨·파일 조건의 결과입니다.'} 타입·값·연결 범위가 모두 일치할 때만 묶습니다. 다른 ID 타입을 자동으로 같은 요청으로 연결하지 않습니다.</p>
    {!ready&&<p role={filterError?'alert':'status'} className="search-status">{filterError??'공통 검색 결과를 계산하고 있습니다.'}</p>}
    {ready&&!!groups.length&&<><div className="trace-catalog">{groups.slice(current*50,(current+1)*50).map(group=><button className={selected?.key===group.key?'chosen':''} aria-pressed={selected?.key===group.key} key={group.key} onClick={()=>setKey(group.key)}><span>{group.value}<small>범위: {group.scope??'기본 (설정 없음)'}{group.kind==='spanId'?` · Trace 문맥: ${group.traceContext??'없음'}`:null}</small></span><b>{group.events.length}개</b></button>)}</div><div className="pagination"><span>{current+1} / {Math.max(1,Math.ceil(groups.length/50))}</span><button disabled={!current} onClick={()=>setPage(current-1)}>식별자 이전</button><button disabled={(current+1)*50>=groups.length} onClick={()=>setPage(current+1)}>식별자 다음</button></div></>}
    {ready&&!groups.length&&<div className="empty"><h3>일치하는 식별자가 없습니다</h3><p>타입·대소문자·파일 범위와 JSON 필드 매핑을 확인하세요.</p></div>}
    {ready&&groups.length>0&&!selected&&<p className="warning">선택했던 그룹이 현재 범위에 없습니다. 목록에서 다시 선택하세요.</p>}
    {ready&&trace&&<div className="trace-detail"><h3>{identifierNames[kind]}: {trace.group.value}</h3><p className="statistics-note">연결 범위: {trace.group.scope??'기본 (설정 없음)'}{kind==='spanId'?` · Trace 문맥: ${trace.group.traceContext??'없음'}`:null} · {trace.fileCount}개 파일 · {trace.services.length}개 서비스 그룹 · {trace.group.events.length}개 이벤트 · ERROR/FATAL {trace.errors}개</p>
      <div className="trace-cautions"><p>시간순 관측 목록이며 인과관계나 완전한 Span 트리가 아닙니다. 서버 간 시계 오차·로그 누락·식별자 재사용 가능성이 있습니다.</p><p>최초~최종 관측 간격: {trace.observedWindowMs===null?'계산 불가 (정규화 시각 2개 미만)':`${trace.observedWindowMs} ms`} — 요청 처리시간으로 단정하지 않습니다.</p><p>시간 기준: {trace.timeBases.join(' · ')}</p></div>
      <ExportControls label="선택 추적 내보내기" revision={exportRevision} targets={[{id:'trace',label:'현재 선택한 식별자의 관측 이벤트',disabled:!ready||files.some(file=>file.status==='reading'),build:()=>traceDataset(trace.group,{...exportContext,scope:entire?'session-trace':'filtered-trace',filtersApplied:!entire,...(entire?{search:undefined,filters:undefined,levels:undefined,fileId:undefined}:{})})}]}/>
      <div className="trace-services">{trace.services.map(service=><span key={JSON.stringify(service.service)}>{service.service??'서비스 미기록'} · {service.events.length}개</span>)}</div>
      <TraceEvents key={`${trace.group.key}:timed`} title="시간순 관측 이벤트" events={trace.timed} files={files} select={select}/>
      <TraceEvents key={`${trace.group.key}:untimed`} title="시각 미확인 이벤트 (시간축 제외)" events={trace.untimed} files={files} select={select}/>
    </div>}
  </section>;
}
