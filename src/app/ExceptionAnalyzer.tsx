import { useMemo, useState } from 'react';
import { groupExceptions } from '../core/exceptions/groups';
import type { LogEvent } from '../types/log';

function timeLabel(value:number|null){return value===null?'정규화 시각 없음':new Date(value).toISOString();}
export function ExceptionAnalyzer({events,select}:{events:LogEvent[];select:(id:string)=>void}){
  const groups=useMemo(()=>groupExceptions(events),[events]);
  const [selectedKey,setSelectedKey]=useState<string|null>(null);const [groupPage,setGroupPage]=useState(0);const [eventPage,setEventPage]=useState(0);
  const selected=groups.find(group=>group.fingerprint===selectedKey)??groups[0];
  const currentPage=Math.min(groupPage,Math.max(0,Math.ceil(groups.length/50)-1));
  const currentEventPage=Math.min(eventPage,Math.max(0,Math.ceil((selected?.events.length??0)/50)-1));
  return <section className="log-panel exception-analyzer" aria-label="Exception Analyzer">
    <div className="panel-heading"><h2>예외 분석 <span>{groups.length}개 그룹</span></h2><span className="panel-meta">{groups.reduce((sum,group)=>sum+group.events.length,0)}개 예외 이벤트</span></div>
    <p className="analysis-note">현재 검색·파일·레벨 조건의 결과입니다. 같은 fingerprint는 유사한 기록이며, 동일한 장애 원인을 확정하지 않습니다.</p>
    {!groups.length&&<div className="empty"><h3>분석할 예외가 없습니다</h3><p>Stack Trace가 포함된 로그를 업로드하거나 필터를 변경하세요.</p></div>}
    {!!groups.length&&<>
      <div className="exception-groups">{groups.slice(currentPage*50,(currentPage+1)*50).map(group=><button key={group.fingerprint} className={selected?.fingerprint===group.fingerprint?'chosen':''} aria-pressed={selected?.fingerprint===group.fingerprint} onClick={()=>{setSelectedKey(group.fingerprint);setEventPage(0);select(group.representative.id);}}><span><strong>{group.type??'타입 미확인'}</strong><small>{group.message??group.representative.message}</small></span><b>{group.events.length}회</b></button>)}</div>
      <div className="pagination"><span>{currentPage+1} / {Math.max(1,Math.ceil(groups.length/50))} 그룹 페이지</span><button disabled={!currentPage} onClick={()=>setGroupPage(currentPage-1)}>그룹 이전</button><button disabled={(currentPage+1)*50>=groups.length} onClick={()=>setGroupPage(currentPage+1)}>그룹 다음</button></div>
    </>}
    {selected&&<div className="exception-group-detail">
      <h3>{selected.type??'타입 미확인'} <span>{selected.events.length}회</span></h3>
      <dl><dt>첫 발생 (UTC)</dt><dd>{timeLabel(selected.firstSeen)}</dd><dt>마지막 발생 (UTC)</dt><dd>{timeLabel(selected.lastSeen)}</dd><dt>시각 미확인</dt><dd>{selected.untimedCount}개</dd><dt>관련 파일</dt><dd>{selected.files.join(', ')}</dd><dt>서비스</dt><dd>{selected.services.join(', ')||'로그에 기록 없음'}</dd><dt>Logger</dt><dd>{selected.representative.logger??'로그에 기록 없음'}</dd></dl>
      <details><summary>Fingerprint 구성값</summary><pre>{selected.fingerprint}</pre></details>
      <h4>대표 Stack Trace</h4><pre>{selected.representative.exception?.stackTrace??'Stack Trace 원문 없음 — 정규화 필드를 확인하세요.'}</pre>
      <h4>관련 이벤트 (현재 결과 순서)</h4><div className="exception-occurrences">{selected.events.slice(currentEventPage*50,(currentEventPage+1)*50).map(event=><button key={event.id} onClick={()=>select(event.id)} aria-label={`예외 원본 보기 ${event.sourceFileName} 줄 ${event.lineStart}`}><span>{event.rawTimestamp??'원문 시각 없음'}<small>{event.sourceFileName} · 줄 {event.lineStart}–{event.lineEnd}</small></span><span className={`badge ${event.level}`}>{event.level}</span></button>)}</div>
      <div className="pagination"><span>{currentEventPage+1} / {Math.max(1,Math.ceil(selected.events.length/50))} 이벤트 페이지</span><button disabled={!currentEventPage} onClick={()=>setEventPage(currentEventPage-1)}>이벤트 이전</button><button disabled={(currentEventPage+1)*50>=selected.events.length} onClick={()=>setEventPage(currentEventPage+1)}>이벤트 다음</button></div>
    </div>}
  </section>;
}
