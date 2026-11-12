import type { LogException } from '../types/log';

export function ExceptionDetails({exception,depth=0}:{exception:LogException;depth?:number}){
  if(depth>=16)return <p className="warning">중첩 표시 한도에 도달했습니다. 전체 원문을 확인하세요.</p>;
  return <section className="exception-node" aria-label={depth===0?'예외 상세':'중첩 예외'}>
    <h3>{exception.relation==='suppressed'?'Suppressed · ':exception.relation==='inner'?'Inner · ':exception.relation==='cause'?'Caused by · ':''}{exception.type??'타입 미확인'}</h3>
    {exception.message!==undefined&&<p>{exception.message}</p>}
    {exception.incomplete&&<p className="warning">프레임 누락 또는 해석하지 못한 구간이 있습니다. 원문을 확인하세요.</p>}
    {!!exception.frames?.length&&<details><summary>Stack Frame {exception.frames.length}개</summary><ol>{exception.frames.slice(0,100).map((frame,index)=><li key={index}><code>{frame.className?`${frame.className}.`:''}{frame.methodName??frame.raw}</code>{frame.fileName&&<small>{frame.fileName}{frame.lineNumber!==undefined?`:${frame.lineNumber}`:''}</small>}</li>)}</ol>{exception.frames.length>100&&<p>처음 100개만 표시합니다. 전체 프레임은 원문에서 확인하세요.</p>}</details>}
    {exception.elidedFrames!==undefined&&<p className="muted">원문에 {exception.elidedFrames}개 프레임 생략 표식이 있습니다.</p>}
    {exception.causeChain?.map((cause,index)=><ExceptionDetails key={`cause-${index}`} exception={cause} depth={depth+1}/>)}
    {exception.suppressed?.map((cause,index)=><ExceptionDetails key={`suppressed-${index}`} exception={cause} depth={depth+1}/>)}
  </section>;
}
