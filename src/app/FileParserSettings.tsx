import { useState } from 'react';
import { parserChoices } from '../core/parsers';
import { useWorkspace } from '../stores/workspace';
import type { MappingField, ParserChoice, SourceFile } from '../types/log';

const mappingLabels:Record<MappingField,string>={timestamp:'Timestamp',level:'Level',message:'Message',requestId:'Request ID',traceId:'Trace ID'};
export function FileParserSettings({file}:{file:SourceFile}){
  const reparse=useWorkspace(state=>state.reparse);
  const source=useWorkspace(state=>state.sources[file.id]);
  const [mapping,setMapping]=useState(file.fieldMapping??{});
  const [showSource,setShowSource]=useState(false);
  return <section className="parser-settings" aria-label="파일 분석 설정">
    <div className="parser-setting-row"><strong>{file.name}</strong><label>로그 형식 <select aria-label={`${file.name} 로그 형식`} disabled={file.status!=='done'} value={file.parserChoice??'auto'} onChange={event=>reparse(file.id,{parser:event.target.value as ParserChoice,fieldMapping:file.fieldMapping})}>{parserChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label><span>{file.parser??'분석 대기'} · {file.encoding??'—'}</span></div>
    <p className="parse-summary">이벤트 {file.count}개 · 경고 이벤트 {file.warnings}개 · 파싱 실패 {file.failures??0}개 · W3C 지시문 {file.directives??0}줄</p>
    <details><summary>JSON 필드 매핑</summary><p>필드명 또는 점으로 구분한 경로를 입력하세요. 빈 값은 자동 매핑입니다. JSON 이벤트에만 적용됩니다.</p><form onSubmit={event=>{event.preventDefault();reparse(file.id,{parser:file.parserChoice??'auto',fieldMapping:mapping});}}><div className="mapping-fields">{(Object.keys(mappingLabels) as MappingField[]).map(field=><label key={field}>{mappingLabels[field]}<input aria-label={`${mappingLabels[field]} 매핑`} placeholder="자동" value={mapping[field]??''} onChange={event=>setMapping({...mapping,[field]:event.target.value})}/></label>)}</div><button type="submit" disabled={file.status!=='done'}>매핑 적용 및 재분석</button></form></details>
    <button className="source-toggle" disabled={source===undefined} aria-expanded={showSource} onClick={()=>setShowSource(!showSource)}>{showSource?'파일 원본 닫기':'파일 원본 보기'}</button>{showSource&&<pre className="file-original">{source}</pre>}
  </section>;
}
