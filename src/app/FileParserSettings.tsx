import { useState } from 'react';
import { parserChoices } from '../core/parser-catalog';
import { useWorkspace } from '../stores/workspace';
import type { MappingField, ParserChoice, SourceFile, ParseOptions } from '../types/log';

const mappingLabels:Record<MappingField,string>={timestamp:'Timestamp',level:'Level',message:'Message',requestId:'Request ID',traceId:'Trace ID',correlationId:'Correlation ID',spanId:'Span ID',customId:'사용자 지정 ID'};
export function FileParserSettings({file}:{file:SourceFile}){
  const reparse=useWorkspace(state=>state.reparse);
  const source=useWorkspace(state=>state.sources[file.id]);
  const [mapping,setMapping]=useState(file.fieldMapping??{});
  const [showSource,setShowSource]=useState(false);
  const [preview,setPreview]=useState<{text:string;truncated:boolean}>();
  const available=source!==undefined||file.originalAvailable;
  const busy=file.status==='reading';
  async function toggleSource(){if(showSource){setShowSource(false);return;}try{setPreview(await useWorkspace.getState().readSourcePreview(file.id));setShowSource(true);}catch(e){setError(String(e));}}
  const [timezone,setTimezone]=useState(file.timezone??'');const [service,setService]=useState(file.serviceName??'');const [scope,setScope]=useState(file.correlationScope??'');const [error,setError]=useState('');
  const setFileColor=useWorkspace(state=>state.setFileColor);
  function apply(options:ParseOptions){try{setError('');void reparse(file.id,options).catch(error=>setError(error instanceof Error?error.message:'파일 분석 실패'));}catch(error){setError(error instanceof Error?error.message:'파일 설정을 적용하지 못했습니다.');}}
  return <section className="parser-settings" aria-label="파일 분석 설정">
    <div className="parser-setting-row"><strong>{file.name}</strong><label>로그 형식 <select aria-label={`${file.name} 로그 형식`} disabled={busy||!available} value={file.parserChoice??'auto'} onChange={event=>apply({parser:event.target.value as ParserChoice,fieldMapping:file.fieldMapping})}>{parserChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label><span>{file.parser??'분석 대기'} · {file.encoding??'—'}</span><label>파일 색상<input aria-label="파일 색상" type="color" value={file.color??'#83d2af'} onChange={event=>setFileColor(file.id,event.target.value)}/></label></div>
    {busy&&<p role="status">{file.phase??'queued'} · {file.progress??0}% <button onClick={()=>useWorkspace.getState().cancelParse(file.id)}>분석 취소</button></p>}
    {!busy&&file.status!=='done'&&available&&<button onClick={()=>apply({})}>분석 다시 시도</button>}
    <p className="parse-summary">이벤트 {file.count}개 · 경고 이벤트 {file.warnings}개 · 파싱 실패 {file.failures??0}개 · W3C 지시문 {file.directives??0}줄</p>
    <form onSubmit={event=>{event.preventDefault();apply({timezone,serviceName:service,correlationScope:scope});}}><div className="mapping-fields"><label>시간대 없는 로그의 시간대<input aria-label="파일 시간대" maxLength={128} placeholder="미지정 / Asia/Seoul / +09:00" value={timezone} onChange={event=>setTimezone(event.target.value)}/></label><label>서비스명 (로그에 없을 때)<input aria-label="파일 서비스명" value={service} onChange={event=>setService(event.target.value)} maxLength={128}/></label><label>식별자 연결 범위<input aria-label="파일 식별자 범위" placeholder="빈 값은 공통 기본 범위" value={scope} onChange={event=>setScope(event.target.value)} maxLength={128}/></label></div><p>명시된 로그 오프셋·서비스와 IIS UTC는 유지합니다. 이 설정은 사용자 가정이며 원문을 변경하지 않습니다. DST 모호/누락 시각은 자동 보정하지 않습니다.</p><button type="submit" disabled={busy||!available}>파일 설정 적용 및 재분석</button></form>
    {error&&<p role="alert" className="search-error">{error}</p>}
    <details><summary>JSON 필드 매핑</summary><p>필드명 또는 점으로 구분한 경로를 입력하세요. 빈 값은 자동 매핑입니다. JSON 이벤트에만 적용됩니다. 사용자 지정 ID는 명시적 매핑이 있어야 추출합니다.</p><form onSubmit={event=>{event.preventDefault();apply({parser:file.parserChoice??'auto',fieldMapping:mapping});}}><div className="mapping-fields">{(Object.keys(mappingLabels) as MappingField[]).map(field=><label key={field}>{mappingLabels[field]}<input aria-label={`${mappingLabels[field]} 매핑`} placeholder="자동" value={mapping[field]??''} onChange={event=>setMapping({...mapping,[field]:event.target.value})}/></label>)}</div><button type="submit" disabled={busy||!available}>매핑 적용 및 재분석</button></form></details>
    <button className="source-toggle" disabled={!available} aria-expanded={showSource} onClick={()=>void toggleSource()}>{showSource?'파일 원본 닫기':'파일 원본 보기'}</button>{showSource&&<>{preview?.truncated&&<p>원본의 처음 512 KiB 미리보기입니다. 전체 원본은 재분석에 보존됩니다.</p>}<pre className="file-original">{preview?.text}</pre></>}
  </section>;
}
