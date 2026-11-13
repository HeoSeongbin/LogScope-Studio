import { useState } from 'react';
import type { LogEvent } from '../types/log';
import type { MatchRange, SearchOptions } from '../types/search';
import { literalHighlight } from '../core/search';
import { ROW_HEIGHT, virtualWindow } from '../core/virtual';
import { HighlightedText } from './HighlightedText';

export function VirtualLogTable({events,selectedId,select,search,messageRanges}:{events:LogEvent[];selectedId:string|null;select:(id:string)=>void;search:SearchOptions;messageRanges?:Record<string,MatchRange[]>}){
  const [scrollTop,setScrollTop]=useState(0);const range=virtualWindow(events.length,scrollTop);
  return <div className="virtual-scroll" tabIndex={0} aria-label="로그 이벤트 스크롤 목록" aria-description="목록에 초점을 둔 뒤 방향키와 Page Up/Down, Home/End로 이동하고 메시지 버튼으로 상세를 선택하세요." onKeyDown={event=>{
    if(event.target!==event.currentTarget)return;
    const element=event.currentTarget,height=element.clientHeight||434;let next=element.scrollTop;
    if(event.key==='ArrowDown')next+=ROW_HEIGHT;else if(event.key==='ArrowUp')next-=ROW_HEIGHT;
    else if(event.key==='PageDown')next+=height;else if(event.key==='PageUp')next-=height;
    else if(event.key==='Home')next=0;else if(event.key==='End')next=events.length*ROW_HEIGHT;
    else return;
    event.preventDefault();next=Math.max(0,Math.min(next,Math.max(0,events.length*ROW_HEIGHT+36-height)));element.scrollTop=next;setScrollTop(next);
  }} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}>
    <table className="virtual-table" aria-label="로그 이벤트" aria-rowcount={events.length+1}><colgroup><col style={{width:180}}/><col style={{width:76}}/><col style={{width:350}}/><col style={{width:145}}/><col style={{width:140}}/><col style={{width:180}}/><col style={{width:170}}/><col style={{width:160}}/></colgroup><thead><tr><th>발생 시각 / 원문</th><th>레벨</th><th>메시지</th><th>서비스</th><th>Thread</th><th>Logger</th><th>Request ID</th><th>소스 / 줄</th></tr></thead><tbody>
      {range.top>0&&<tr aria-hidden="true" className="virtual-spacer"><td colSpan={8} style={{height:range.top,padding:0,border:0}}/></tr>}
      {events.slice(range.start,range.end).map((event,index)=>{
        const ranges=search.mode==='regex'?messageRanges?.[event.id]:literalHighlight(event.message,search);
        return <tr key={event.id} aria-rowindex={range.start+index+2} aria-selected={selectedId===event.id} className={`log-row ${selectedId===event.id?'selected':''}`} style={{height:ROW_HEIGHT}} onClick={()=>select(event.id)}><td title={event.rawTimestamp}>{event.rawTimestamp??'시각 없음'}{event.rawTimestamp&&event.timestamp===null&&<small className="logger">정규화 시각 없음</small>}</td><td><span className={`badge ${event.level}`}>{event.level}</span></td><td><button className="message-button" title={event.message}><HighlightedText text={event.message||'(빈 줄)'} ranges={ranges}/></button></td><td title={event.service}>{event.service??'—'}</td><td title={event.thread}>{event.thread??'—'}</td><td title={event.logger}>{event.logger??'—'}</td><td title={event.requestId}>{event.requestId??'—'}</td><td title={event.sourceFileName}>{event.sourceFileName}<small className="logger">L{event.lineStart}–{event.lineEnd}</small></td></tr>;
      })}
      {range.bottom>0&&<tr aria-hidden="true" className="virtual-spacer"><td colSpan={8} style={{height:range.bottom,padding:0,border:0}}/></tr>}
    </tbody></table>
  </div>;
}
