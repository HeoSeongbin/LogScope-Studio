import { useEffect, useId, useRef, useState } from 'react';
import { serializeExport, type ExportDataset, type ExportFormat } from '../core/export';
import { downloadArtifact } from '../core/download';
import { recoveryHint } from '../core/feedback';

export interface ExportTarget {id:string;label:string;disabled?:boolean;build:()=>ExportDataset}
export function ExportControls({targets,revision,label='분석 결과 내보내기'}:{targets:ExportTarget[];revision:unknown;label?:string}){
  const id=useId();const [targetId,setTargetId]=useState(targets[0]?.id??'');const [format,setFormat]=useState<ExportFormat>('json');
  const [busy,setBusy]=useState(false);const [jobRevision,setJobRevision]=useState<{value:unknown}>();const [progress,setProgress]=useState('');const [error,setError]=useState('');
  const task=useRef<AbortController|null>(null);const anchor=useRef<HTMLButtonElement>(null);
  useEffect(()=>()=>{task.current?.abort();task.current=null;},[revision]);
  const active=busy&&jobRevision?.value===revision;
  const current=jobRevision?.value===revision;
  const selected=targets.find(item=>item.id===targetId);
  async function start(){
    if(!selected||selected.disabled)return;task.current?.abort();const controller=new AbortController();task.current=controller;
    setJobRevision({value:revision});setBusy(true);setError('');setProgress('분석 데이터 준비 중…');
    try{
      await new Promise(resolve=>setTimeout(resolve,0));if(controller.signal.aborted)throw new DOMException('취소','AbortError');
      const dataset=selected.build();const artifact=await serializeExport(dataset,format,{signal:controller.signal,onProgress:(done,total)=>{if(task.current===controller)setProgress(`파일 생성 ${done.toLocaleString()} / ${total.toLocaleString()}행`);}});
      if(controller.signal.aborted)return;downloadArtifact(artifact);setProgress(`다운로드 요청 완료 · ${artifact.rows.toLocaleString()}행 · ${(artifact.bytes/1024).toFixed(1)} KiB`);
    }catch(error){if(controller.signal.aborted){if(task.current===controller)setProgress('내보내기를 취소했습니다.');}else if(task.current===controller)setError(error instanceof Error?error.message:'내보내기를 완료하지 못했습니다.');}
    finally{if(task.current===controller){task.current=null;setBusy(false);anchor.current?.focus();}}
  }
  // Scope changes invalidate the job even if this control stays mounted.
  return <section className="export-controls" aria-label={label}>
    <details><summary>{label}</summary><p id={`${id}-help`}>정규화 분석 결과를 로컬 파일로 저장합니다. 원본·파일명·식별자 등 민감 정보가 포함될 수 있으며 자동 마스킹하지 않습니다. 최대 50,000개 원본 이벤트 / 결과 32 MiB입니다. CSV는 수식 위험 값에 작은따옴표를 추가합니다. 원문 값의 정확한 재사용에는 JSON을 선택하세요.</p>
      <div className="export-fields"><label>대상<select aria-label={`${label} 대상`} disabled={active} value={targetId} onChange={event=>setTargetId(event.target.value)}>{targets.map(target=><option key={target.id} value={target.id} disabled={target.disabled}>{target.label}{target.disabled?' (선택 불가)':''}</option>)}</select></label>
      <label>형식<select aria-label={`${label} 형식`} value={format} disabled={active} onChange={event=>setFormat(event.target.value as ExportFormat)}><option value="json">JSON · 원문 필드 보존</option><option value="csv">CSV · UTF-8 BOM</option><option value="html">HTML 분석 리포트</option></select></label>
      <button ref={anchor} disabled={active||!selected||selected.disabled} aria-describedby={`${id}-help`} onClick={()=>void start()}>선택 범위 다운로드</button>{active&&<button onClick={()=>task.current?.abort()}>내보내기 취소</button>}</div>
      {current&&progress&&<p role="status" aria-live="polite">{progress}</p>}{current&&error&&<div role="alert" className="search-error"><p>{error}</p><p>{recoveryHint(error)}</p></div>}
    </details>
  </section>;
}
