import { useMemo, useRef, useState } from 'react';
import { Activity, Upload, FileText, Trash2, ShieldCheck, Layers, ChevronRight, X, Terminal, CircleHelp } from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { levels } from '../types/log';
import type { ParserChoice } from '../types/log';
import { parserChoices } from '../core/parser-catalog';
import { FileParserSettings } from './FileParserSettings';
import { formatEvent } from '../core/format';
import { SearchControls } from './SearchControls';
import { VirtualLogTable } from './VirtualLogTable';
import { useExplorerSearch } from '../hooks/useExplorerSearch';
import { HighlightedText } from './HighlightedText';
import { literalHighlight } from '../core/search';
import { ExceptionAnalyzer } from './ExceptionAnalyzer';
import { ExceptionDetails } from './ExceptionDetails';
import { StatisticsDashboard } from './StatisticsDashboard';
import { TraceExplorer } from './TraceExplorer';

export function App(){
  const store=useWorkspace(); const input=useRef<HTMLInputElement>(null);
  const [drag,setDrag]=useState(false); const [notice,setNotice]=useState('');
  const [uploadParser,setUploadParser]=useState<ParserChoice>('auto');
  const [view,setView]=useState<'explorer'|'exceptions'|'dashboard'|'timeline'|'trace'>('explorer');
  const viewTitle={explorer:'로그 탐색기',exceptions:'예외 분석',dashboard:'Dashboard',timeline:'Timeline Analyzer',trace:'Request Trace Explorer'}[view];
  const [sampleFile,setSampleFile]=useState('spring-normal.log');
  const selectedFile=store.files.find(file=>file.id===store.fileId);
  const result=useExplorerSearch(store.events,store.selectedLevels,store.fileId,store.filters,store.search);
  const filtered=result.events;
  const eventIndex=useMemo(()=>new Map(store.events.map(event=>[event.id,event])),[store.events]);
  const selected=store.selectedId?eventIndex.get(store.selectedId):undefined;
  const counts=useMemo(()=>(()=>{const counts=Object.fromEntries(levels.map(level=>[level,0]));for(const event of store.events)counts[event.level]++;return counts;})(),[store.events]);
  const viewKey=JSON.stringify([store.sessionVersion,store.fileId,store.selectedLevels,store.filters,store.search,store.events.length]);
  async function sample(){
    try { const response=await fetch(`${import.meta.env.BASE_URL}samples/${sampleFile}`);if(!response.ok)throw new Error('샘플을 읽지 못했습니다.');await store.upload([new File([await response.text()],sampleFile)]);setNotice('가상 샘플 로그를 불러왔습니다.'); }
    catch {setNotice('샘플 파일을 불러오지 못했습니다. 직접 파일을 선택해 주세요.');}
  }
  return <div className="workspace">
    <aside className="sidebar">
      <a href="#" className="brand"><span className="logo"><Activity size={23}/></span><span>LogScope<span className="brand-sub">STUDIO</span></span></a>
      <div className="workspace-label">WORKSPACE <span>로컬 세션</span></div>
      <button className={`workspace-nav ${view==='dashboard'?'nav-active':''}`} onClick={()=>setView('dashboard')} aria-pressed={view==='dashboard'}><Activity size={17}/> Dashboard <span>00</span></button>
      <button className={`workspace-nav ${view==='explorer'?'nav-active':''}`} onClick={()=>setView('explorer')} aria-pressed={view==='explorer'}><Terminal size={17}/> 로그 탐색기 <span>01</span></button>
      <button className={`workspace-nav ${view==='exceptions'?'nav-active':''}`} onClick={()=>setView('exceptions')} aria-pressed={view==='exceptions'}><Activity size={17}/> 예외 분석 <span>02</span></button>
      <button className={`workspace-nav ${view==='timeline'?'nav-active':''}`} onClick={()=>setView('timeline')} aria-pressed={view==='timeline'}><Activity size={17}/> Timeline <span>03</span></button>
      <button className={`workspace-nav ${view==='trace'?'nav-active':''}`} onClick={()=>setView('trace')} aria-pressed={view==='trace'}><Layers size={17}/> 요청 추적 <span>04</span></button>
      <div className="nav-note">분석은 공통 조건을 사용하며 요청 추적은 전체 범위도 선택할 수 있습니다.</div>
      <div className="section-label">소스 파일 <span>{store.files.length}</span></div>
      <button className={`file-item ${!store.fileId?'chosen':''}`} onClick={()=>{store.setFile('');}}><Layers size={16}/> 모든 파일 <span>{store.events.length}</span></button>
      <div className="file-list">{store.files.map(file=><div style={{borderLeft:`3px solid ${file.color??'#7cbbef'}`}} key={file.id} className={`source ${store.fileId===file.id?'chosen':''}`}><button onClick={()=>{store.setFile(file.id);}}><FileText size={16}/><span title={file.name}>{file.name}<small>{(file.size/1024).toFixed(1)} KiB · {file.status==='reading'?`${file.phase??'queued'} ${file.progress??0}%`:file.status==='cancelled'?'취소됨':file.status==='error'?'실패':`${file.count}개 이벤트`}</small></span></button><button aria-label={`${file.name} 제거`} onClick={()=>store.remove(file.id)}><X size={13}/></button>{file.status==='reading'&&<button aria-label={`${file.name} 분석 취소`} onClick={()=>store.cancelParse(file.id)}>취소</button>}{file.error&&<p className="error-text">{file.error}</p>}</div>)}</div>
      <button className="add-source" onClick={()=>input.current?.click()}>+ 파일 추가</button>
      <div className="section-label">로그 레벨 <button onClick={()=>{for(const level of store.selectedLevels)store.toggleLevel(level);}}>해제</button></div>
      {levels.map(level=><button key={level} className="level-filter" aria-pressed={store.selectedLevels.includes(level)} onClick={()=>{store.toggleLevel(level);}}><span className={`check ${store.selectedLevels.includes(level)?'checked':''}`}>{store.selectedLevels.includes(level)?'✓':''}</span><span className={`dot ${level}`}/>{level}<span>{counts[level]}</span></button>)}
      <div className="privacy"><ShieldCheck size={18}/><div>데이터는 브라우저 안에만<small>서버 전송 · 자동 저장 없음</small></div></div>
    </aside>
    <div className="main-shell">
      <header><div className="breadcrumb">워크스페이스 <ChevronRight size={13}/><strong>{viewTitle}</strong></div><span className="local-status">● 로컬 분석</span><button className="primary" onClick={()=>input.current?.click()}><Upload size={15}/> 로그 업로드</button></header>
      <main>
        <div className="page-heading"><div><div className="eyebrow">LOG EXPLORER</div><h1>{viewTitle}<span>Phase 7</span></h1><p>흩어진 로그를 한곳에서. 문제의 시작을 찾아보세요.</p></div><button className="subtle" onClick={store.reset} disabled={!store.files.length}><Trash2 size={14}/> 세션 초기화</button></div>
        <div className="metrics">{[['전체 이벤트',store.events.length,'전체 파일에서 수집'],['ERROR',counts.ERROR,'오류 레벨 이벤트'],['WARN',counts.WARN,'경고 레벨 이벤트'],['소스 파일',store.files.filter(file=>file.status==='done').length,'분석 완료 파일']].map(([label,value,caption])=><div className="metric" key={label}><div>{label}<span className={label==='ERROR'?'error-icon':''}>◈</span></div><strong>{Number(value).toLocaleString()}</strong><small>{caption}</small></div>)}</div>
        <div className="upload-format"><label>새 파일 로그 형식 <select aria-label="새 파일 로그 형식" value={uploadParser} onChange={event=>setUploadParser(event.target.value as ParserChoice)}>{parserChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label><span>업로드 후 왼쪽 파일을 선택하면 형식을 바꿀 수 있습니다.</span></div>
        <section className={`drop-zone ${drag?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={event=>{event.preventDefault();setDrag(false);void store.upload(Array.from(event.dataTransfer.files),{parser:uploadParser});}}>
          <span className="upload-icon"><Upload size={22}/></span><div><h2>로그 파일을 여기에 놓아주세요</h2><p>텍스트 기반 로그 · 파일당 50 MiB / 세션 64 MiB · 이벤트/레코드 보호 한도 적용 · UTF-8 및 UTF-16 BOM</p></div><button onClick={()=>input.current?.click()}>파일 선택</button><select aria-label="샘플 로그" value={sampleFile} onChange={event=>setSampleFile(event.target.value)}><option value="spring-normal.log">Spring 기본</option><option value="spring-exception.log">Java 반복 예외</option><option value="dotnet-exception.log">.NET 내부 예외</option><option value="incomplete-exception.log">불완전한 예외</option><option value="statistics-demo.jsonl">오류 집중 구간</option><option value="distributed-api.log">요청 추적 API</option><option value="distributed-db.log">요청 추적 DB</option></select><button className="sample" onClick={()=>void sample()}>샘플 불러오기 <ChevronRight size={13}/></button>
        </section>
        <input ref={input} type="file" multiple className="sr-only" aria-label="로그 파일 업로드" onChange={event=>{void store.upload(Array.from(event.target.files??[]),{parser:uploadParser});event.target.value='';}}/>
        {notice&&<p role="status" className="notice">{notice}</p>}
        {selectedFile&&<FileParserSettings key={selectedFile.id} file={selectedFile}/>}
        <SearchControls key={store.sessionVersion}/>
        <div className="explorer-layout">
          {view==='trace'?<TraceExplorer key={store.sessionVersion} events={filtered} allEvents={store.events} files={store.files} select={store.select} filterPending={result.pending} filterError={result.error}/>:view!=='explorer'?result.pending||result.error?<section className="log-panel"><div className="search-status" role={result.error?'alert':'status'}>{result.error??'정규식 검색 중…'}{result.pending&&<button onClick={result.cancel}>검색 취소</button>}</div></section>:view==='exceptions'?<ExceptionAnalyzer key={viewKey} events={filtered} select={store.select}/>:<StatisticsDashboard selectedId={store.selectedId} key={viewKey} events={filtered} select={store.select} focusFile={id=>{store.setFile(id);setView('explorer');}} search={store.search} messageRanges={result.messageRanges} timelineOnly={view==='timeline'}/>:<section className="log-panel"><div className="panel-heading"><h2><Terminal size={16}/> 이벤트 목록 <span>{result.pending?'…':result.error?'—':filtered.length.toLocaleString()}</span></h2><div className="panel-meta">{store.filters.sort==='source'?'원본 순서':store.filters.sort==='oldest'?'오래된 순':'최신 순'} <span>↧</span></div></div>
            <div className="filter-summary">{store.selectedLevels.length?store.selectedLevels.join(' · '):'모든 레벨'}<span>•</span>{store.fileId?store.files.find(file=>file.id===store.fileId)?.name:'모든 파일'}<span className="right">가상 스크롤</span></div>
            {result.pending&&<div role="status" className="search-status">정규식 검색 중… <button onClick={result.cancel}>검색 취소</button></div>}
            {result.error&&<div role="alert" className="search-error">{result.error}</div>}
            {result.highlightLimited&&<p className="search-status">강조 표시 한도에 도달했습니다. 검색 결과 건수는 전체 일치 결과입니다.</p>}
            {!result.pending&&!result.error&&<VirtualLogTable key={viewKey} events={filtered} selectedId={store.selectedId} select={store.select} search={store.search} messageRanges={result.messageRanges}/>}
            {!result.pending&&!result.error&&!filtered.length&&<div className="empty"><FileText size={34}/><h3>{store.events.length?'일치하는 이벤트가 없습니다':'첫 번째 로그를 분석해 보세요'}</h3><p>{store.events.length?'검색 조건이나 레벨·파일 필터를 변경하세요.':'파일을 업로드하거나 샘플 로그로 시작하세요.'}</p>{!store.events.length&&<button onClick={()=>void sample()}>샘플 로그로 시작 <ChevronRight size={14}/></button>}</div>}
            <div className="pagination"><span role="status">{result.pending?'검색 중':result.error?'검색 오류':`${filtered.length.toLocaleString()}개 결과 / ${store.events.length.toLocaleString()}개 이벤트`}</span><span>행을 선택해 원본 위치 확인</span></div>
          </section>}
          <aside className="detail-panel"><div className="panel-heading"><h2>이벤트 상세</h2>{selected&&<span className={`badge ${selected.level}`}>{selected.level}</span>}</div>{selected?<div className="detail-content"><div className="detail-label">원본 위치</div>{!result.pending&&!result.error&&!filtered.some(event=>event.id===selected.id)&&<p className="warning">선택 이벤트는 현재 검색 결과에 없습니다.</p>}<p>{selected.sourceFileName}<br/><span className="accent">줄 {selected.lineStart}–{selected.lineEnd}</span></p><dl><dt>Parser</dt><dd>{selected.parserId}</dd><dt>Timestamp</dt><dd>{selected.rawTimestamp??'없음'}</dd><dt>Timezone</dt><dd>{selected.timezone??'미지정'}</dd><dt>Thread</dt><dd>{selected.thread??'—'}</dd><dt>Logger</dt><dd>{selected.logger??'—'}</dd><dt>시각 근거</dt><dd>{selected.timeSource==='file-setting'?`파일 설정: ${selected.assumedTimezone}`:selected.timeSource==='format'?'형식 규약':selected.timeSource==='log'?'로그의 명시 시각':'미확인'}</dd><dt>Service</dt><dd>{selected.service??'—'}{selected.serviceSource==='file-setting'?' (파일 설정)':null}</dd><dt>Request ID</dt><dd>{selected.requestId??'—'}</dd><dt>Trace ID</dt><dd>{selected.traceId??'—'}</dd><dt>Correlation ID</dt><dd>{selected.correlationId??'—'}</dd><dt>Span ID</dt><dd>{selected.spanId??'—'}</dd><dt>사용자 ID</dt><dd>{selected.customId??'—'}</dd><dt>연결 범위</dt><dd>{selected.correlationScope??'기본 (설정 없음)'}</dd></dl>{selected.exception&&<ExceptionDetails exception={selected.exception}/>}<div className="detail-label">원본 로그</div><pre><HighlightedText text={selected.rawText} ranges={result.error?[]:store.search.mode==='regex'?result.rawRanges?.[selected.id]:literalHighlight(selected.rawText,store.search)}/></pre>{selected.parseErrors?.length ? <div className="parse-failures" role="note"><strong>파싱 실패 원인</strong>{selected.parseErrors.map(reason=><p key={reason}>{reason}</p>)}</div> : null}{selected.parseWarnings?.filter(warning=>!selected.parseErrors?.includes(warning)).map(warning=><p className="warning" key={warning}>{warning}</p>)}<details><summary>정규화 이벤트</summary><pre>{formatEvent(selected)}</pre></details></div>:<div className="detail-empty"><span><CircleHelp size={25}/></span><h3>로그의 맥락을 확인하세요</h3><p>이벤트를 선택하면 원본 로그와<br/>파싱 정보를 확인할 수 있습니다.</p></div>}</aside>
        </div>
        <div className="footnote"><ShieldCheck size={13}/> 로그는 외부로 전송되지 않습니다.<span>Spring · Logback/Log4j2 · .NET · Serilog · JSON · IIS W3C</span></div>
      </main>
      <footer><span className="status-dot"/> {store.files.some(file=>file.status==='reading')?'파일을 분석하고 있습니다':'분석 준비 완료'}<span>{store.events.length.toLocaleString()} 이벤트</span><span>{store.files.reduce((sum,file)=>sum+file.warnings,0)}개 경고</span><span>{store.files.reduce((sum,file)=>sum+(file.failures??0),0)}개 파싱 실패</span><span>{store.files.reduce((sum,file)=>sum+(file.duration??0),0).toFixed(0)} ms</span><span className="right">LOGSCOPE STUDIO / v0.7.0</span></footer>
    </div>
  </div>;
}
