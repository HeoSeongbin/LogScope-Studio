import { useMemo, useState } from 'react';
import { aggregateStatistics, bucketSizes, buildTimeline, eventsInBucket, findConcentrations, signalCount, type BucketSize, type DimensionCounts, type ErrorSignal } from '../core/statistics';
import { levels, type LogEvent } from '../types/log';
import type { MatchRange, SearchOptions } from '../types/search';
import { LevelChart, ServiceChart, TimelineChart } from './StatisticsCharts';
import { ExportControls } from './ExportControls';
import { statisticsDataset, timelineDataset } from '../core/export';
import { VirtualLogTable } from './VirtualLogTable';

const signalNames:Record<ErrorSignal,string>={application:'ERROR + FATAL',http5xx:'HTTP 5xx',exception:'예외 이벤트'};
const bucketNames:Record<BucketSize,string>={'1m':'1분','5m':'5분','1h':'1시간','1d':'1일'};
function fieldLabel(name:string|null){return name===null?'미기록 (필드 없음)':name===''?'빈 문자열':name;}
function DimensionTable({title,items,onFile}:{title:string;items:DimensionCounts[];onFile?:(id:string)=>void}){
  const [page,setPage]=useState(0);const current=Math.min(page,Math.max(0,Math.ceil(items.length/20)-1));
  return <section className="statistics-card"><h3>{title} <span>{items.length}개</span></h3><div className="statistics-table-scroll"><table aria-label={title}><thead><tr><th>이름</th><th>전체</th><th>ERROR+FATAL</th><th>예외</th><th>HTTP 5xx</th></tr></thead><tbody>{items.slice(current*20,(current+1)*20).map(item=><tr key={JSON.stringify([item.key])}><td>{onFile&&item.key!==null?<button className="statistics-link" onClick={()=>onFile(item.key!)} aria-label={`파일 탐색 ${fieldLabel(item.name)}`}>{fieldLabel(item.name)}</button>:fieldLabel(item.name)}</td><td>{item.total}</td><td>{item.errors}</td><td>{item.exceptions}</td><td>{item.http5xx}</td></tr>)}</tbody></table></div>{!items.length&&<p className="statistics-note">현재 결과에 이벤트가 없습니다.</p>}<div className="pagination"><span>{current+1} / {Math.max(1,Math.ceil(items.length/20))}</span><button disabled={!current} onClick={()=>setPage(current-1)}>이전</button><button disabled={(current+1)*20>=items.length} onClick={()=>setPage(current+1)}>다음</button></div></section>;
}
export function StatisticsDashboard({events,select,focusFile,search,messageRanges,timelineOnly=false,selectedId=null,exportContext,exportPending=false}:{events:LogEvent[];select:(id:string)=>void;focusFile:(id:string)=>void;search:SearchOptions;messageRanges?:Record<string,MatchRange[]>;timelineOnly?:boolean;selectedId?:string|null;exportContext?:object;exportPending?:boolean}){
  const statistics=useMemo(()=>aggregateStatistics(events),[events]);
  const [size,setSize]=useState<BucketSize>('1m');const [signal,setSignal]=useState<ErrorSignal>('application');
  const [minCount,setMinCount]=useState('3');const [minPercent,setMinPercent]=useState('30');
  const [selectedStart,setSelectedStart]=useState<number|null>(null);const [bucketPage,setBucketPage]=useState(0);
  const timeline=useMemo(()=>buildTimeline(statistics.events,size),[statistics.events,size]);
  const concentrations=useMemo(()=>{
    try{if(!minCount.trim()||!minPercent.trim())throw new Error('집중 구간의 건수와 비율을 입력하세요.');return {items:findConcentrations(timeline.buckets,signal,Number(minCount),Number(minPercent)),error:undefined};}
    catch(error){return {items:[],error:error instanceof Error?error.message:'집중 구간을 계산하지 못했습니다.'};}
  },[timeline.buckets,signal,minCount,minPercent]);
  const selected=timeline.buckets.find(bucket=>bucket.start===selectedStart);
  const selectedEvents=useMemo(()=>selected?eventsInBucket(statistics.events,selected):[],[statistics.events,selected]);
  const currentPage=Math.min(bucketPage,Math.max(0,Math.ceil(timeline.buckets.length/50)-1));
  const exportRevision=useMemo(()=>({events,size,exportContext,exportPending}),[events,size,exportContext,exportPending]);
  const summary=statistics.summary;
  return <div className="statistics-dashboard" aria-label={timelineOnly?'Timeline Analyzer':'Dashboard'}>
    <div className="statistics-heading"><h2>{timelineOnly?'타임라인 분석':'분석 대시보드'}</h2><span>현재 검색·기간·레벨·파일 조건 기준</span></div>
    <ExportControls label="통계 내보내기" revision={exportRevision} targets={[
      {id:'statistics',label:'현재 필터의 요약·파일·서비스·Logger 통계',disabled:exportPending,build:()=>statisticsDataset(events,exportContext??{scope:'provided-events'})},
      {id:'timeline',label:'현재 선택 버킷의 전체 UTC 시간대별 통계',disabled:exportPending||!!timeline.error,build:()=>timelineDataset(events,size,exportContext??{scope:'provided-events'})},
    ]}/>
    <div className="statistics-metrics">{[
      ['결과 이벤트',summary.total.toLocaleString()],['ERROR + FATAL',summary.errors.toLocaleString()],['WARN',String(summary.levels.WARN)],['INFO',String(summary.levels.INFO)],['오류 레벨 비율',statistics.errorRate===null?'—':`${(statistics.errorRate*100).toFixed(1)}%`],['예외 이벤트',String(summary.exceptions)],['HTTP 4xx / 5xx',`${summary.http4xx} / ${summary.http5xx}`],['시각 있음 / 없음',`${statistics.timed} / ${statistics.untimed}`],
    ].map(([label,value])=><div key={label} className="statistic-metric"><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="statistics-note">오류 비율 = (ERROR + FATAL) / 전체 결과 이벤트. HTTP 오류와 예외는 별도 집계하며 서로 더하지 않습니다. 시각 없는 {statistics.untimed}개는 전체 통계에 포함되고 시간 차트에서 제외됩니다.{statistics.duplicateIds>0&&` 중복 이벤트 ID ${statistics.duplicateIds}개는 제외했습니다.`}</p>
    <p className="statistics-note">정규화 관측 범위 (UTC): {statistics.firstSeen===null?'없음':new Date(statistics.firstSeen).toISOString()} ~ {statistics.lastSeen===null?'없음':new Date(statistics.lastSeen).toISOString()}</p>
    <section className="statistics-card"><div className="statistics-heading"><h3>UTC 시간대별 이벤트</h3><label>시간 버킷<select aria-label="시간 버킷" value={size} onChange={event=>{setSize(event.target.value as BucketSize);setSelectedStart(null);setBucketPage(0);}}>{(Object.keys(bucketSizes) as BucketSize[]).map(key=><option key={key} value={key}>{bucketNames[key]}</option>)}</select></label></div>
      <p className="statistics-note">버킷은 [시작, 종료) 구간입니다. 차트 클릭 또는 아래 표의 구간 선택으로 원본 이벤트를 확인하세요. 관측 시각 사이의 빈 구간은 입력에 이벤트가 없다는 뜻이며 서비스 무장애를 증명하지 않습니다.</p>
      {timeline.error?<p role="alert" className="search-error">{timeline.error}</p>:timeline.buckets.length?<TimelineChart buckets={timeline.buckets} onSelect={setSelectedStart}/>:<p className="statistics-empty">시간 차트에 배치할 수 있는 이벤트가 없습니다.</p>}
      {!!timeline.buckets.length&&<details><summary>시간 버킷 데이터 표 · {timeline.buckets.length}개</summary><div className="statistics-table-scroll"><table aria-label="시간 버킷 데이터"><thead><tr><th>시작 (UTC)</th><th>전체</th><th>ERROR+FATAL</th><th>WARN</th><th>예외</th><th>HTTP 5xx</th></tr></thead><tbody>{timeline.buckets.slice(currentPage*50,(currentPage+1)*50).map(bucket=><tr key={bucket.start}><td><button className="statistics-link" aria-pressed={selectedStart===bucket.start} aria-label={`구간 선택 ${new Date(bucket.start).toISOString()}`} onClick={()=>setSelectedStart(bucket.start)}>{new Date(bucket.start).toISOString()}</button></td><td>{bucket.total}</td><td>{bucket.errors}</td><td>{bucket.levels.WARN}</td><td>{bucket.exceptions}</td><td>{bucket.http5xx}</td></tr>)}</tbody></table></div><div className="pagination"><span>{currentPage+1} / {Math.ceil(timeline.buckets.length/50)}</span><button disabled={!currentPage} onClick={()=>setBucketPage(currentPage-1)}>구간 이전</button><button disabled={(currentPage+1)*50>=timeline.buckets.length} onClick={()=>setBucketPage(currentPage+1)}>구간 다음</button></div></details>}
    </section>
    <section className="statistics-card"><h3>오류 집중 구간</h3><div className="concentration-controls"><label>관측 지표<select aria-label="집중 구간 지표" value={signal} onChange={event=>setSignal(event.target.value as ErrorSignal)}>{(Object.keys(signalNames) as ErrorSignal[]).map(key=><option key={key} value={key}>{signalNames[key]}</option>)}</select></label><label>최소 건수<input aria-label="집중 구간 최소 건수" type="number" min={1} step={1} value={minCount} onChange={event=>setMinCount(event.target.value)}/></label><label>최소 비율 (%)<input aria-label="집중 구간 최소 비율" type="number" min={0} max={100} step="any" value={minPercent} onChange={event=>setMinPercent(event.target.value)}/></label></div>
      <p className="statistics-note">선택 지표 / 버킷 전체 이벤트가 기준을 만족하는 구간입니다. 장애 원인이나 통계적 이상치로 확정하지 않습니다. 최대 상위 10개를 표시합니다.</p>
      {timeline.error?<p className="statistics-empty">시간 버킷을 계산하지 못해 집중 구간도 계산하지 않았습니다.</p>:!statistics.timed?<p className="statistics-empty">정규화 시각이 없어 집중 구간을 계산할 수 없습니다.</p>:concentrations.error?<p role="alert" className="search-error">{concentrations.error}</p>:!concentrations.items.length?<p className="statistics-empty">현재 관측 범위에서 기준을 만족하는 구간이 없습니다.</p>:<div className="concentration-list">{concentrations.items.slice(0,10).map(bucket=><button key={bucket.start} aria-label={`집중 구간 선택 ${new Date(bucket.start).toISOString()}`} onClick={()=>setSelectedStart(bucket.start)}><span>{new Date(bucket.start).toISOString()}</span><strong>{signalNames[signal]} {signalCount(bucket,signal)} / {bucket.total}개 · {(signalCount(bucket,signal)/bucket.total*100).toFixed(1)}%</strong></button>)}</div>}
    </section>
    {selected&&<section className="statistics-card"><div className="statistics-heading"><h3>선택 구간 이벤트 · {selectedEvents.length}개</h3><button onClick={()=>setSelectedStart(null)}>구간 선택 해제</button></div><p className="statistics-note">{new Date(selected.start).toISOString()} ≤ 시각 &lt; {new Date(selected.end).toISOString()} · 시간대가 없는 로그는 포함되지 않습니다.</p><table aria-label="선택 구간 레벨 분포"><thead><tr>{levels.map(level=><th key={level}>{level}</th>)}</tr></thead><tbody><tr>{levels.map(level=><td key={level}>{selected.levels[level]}</td>)}</tr></tbody></table><VirtualLogTable key={`${selected.start}:${size}`} events={selectedEvents} selectedId={selectedId} select={select} search={search} messageRanges={messageRanges}/></section>}
    {!timelineOnly&&<>
      <section className="statistics-card"><h3>로그 레벨 분포</h3>{summary.total>0&&<LevelChart summary={summary}/>}<table aria-label="레벨별 집계"><thead><tr>{levels.map(level=><th key={level}>{level}</th>)}</tr></thead><tbody><tr>{levels.map(level=><td key={level}>{summary.levels[level]}</td>)}</tr></tbody></table></section>
      <section className="statistics-card"><h3>상위 예외 그룹 (최대 10개)</h3><p className="statistics-note">원인/내부 예외를 따로 세지 않는 root 이벤트 기준입니다.</p>{statistics.topExceptions.length?statistics.topExceptions.slice(0,10).map(group=><button className="statistics-exception" key={group.fingerprint} onClick={()=>select(group.representative.id)}><span>{group.type??'타입 미확인'}<small>{group.message??group.representative.message}</small></span><b>{group.events.length}회</b></button>):<p className="statistics-empty">예외 이벤트가 없습니다.</p>}
        <details><summary>예외 타입별 분포 (상위 20개)</summary><table aria-label="예외 타입별 집계"><thead><tr><th>타입</th><th>발생 수</th></tr></thead><tbody>{statistics.exceptionTypes.slice(0,20).map(item=><tr key={JSON.stringify(item.type)}><td>{item.type??'타입 미확인'}</td><td>{item.count}</td></tr>)}</tbody></table></details>
      </section>
      <section className="statistics-card"><h3>서비스별 오류·예외 분포 (전체 이벤트 상위 10개)</h3>{statistics.services.length>0&&<ServiceChart items={statistics.services}/>}<p className="statistics-note">막대는 독립 지표입니다. 예외와 ERROR 레벨이 겹칠 수 있으므로 합계로 읽지 않습니다.</p></section><section className="statistics-card"><h3>상위 ERROR/FATAL 메시지 (최대 10개)</h3>{statistics.topErrors.slice(0,10).map((error,index)=><button className="statistics-exception" key={index} onClick={()=>select(error.representative.id)}><span>{error.message||'(빈 메시지)'}<small>{fieldLabel(error.service)} · {fieldLabel(error.logger)}</small></span><b>{error.count}회</b></button>)}{!statistics.topErrors.length&&<p className="statistics-empty">ERROR/FATAL 이벤트가 없습니다.</p>}</section><DimensionTable title="서비스별 통계" items={statistics.services}/><DimensionTable title="파일별 통계" items={statistics.files} onFile={focusFile}/><DimensionTable title="Logger별 통계" items={statistics.loggers}/>
    </>}
  </div>;
}
