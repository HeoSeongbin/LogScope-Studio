import type { ParseBlobRequest, ParseBlobResult, ParseProgress } from './parse-blob';
import type { SearchWorker } from '../regex-client';
type Factory=()=>SearchWorker;
let factory:Factory=()=>new Worker(new URL('../../workers/parse.worker.ts',import.meta.url),{type:'module'}) as unknown as SearchWorker;
export function setParseWorkerFactory(value:Factory){factory=value;}
export class ParseCancelled extends Error {constructor(){super('분석이 취소되었습니다.');this.name='ParseCancelled';}}
const queue:Array<()=>void>=[];let active=false;
function pump(){if(active)return;const next=queue.shift();if(next){active=true;next();}}
export function startParse(request:ParseBlobRequest,onProgress?:(progress:ParseProgress)=>void){
  let cancel=()=>{};
  const promise=new Promise<ParseBlobResult>((resolve,reject)=>{
    let worker:SearchWorker|undefined;let settled=false;let running=false;let timer:ReturnType<typeof setTimeout>|undefined;let total:ReturnType<typeof setTimeout>|undefined;
    const finish=(error?:Error,result?:ParseBlobResult)=>{
      if(settled)return;settled=true;clearTimeout(timer);clearTimeout(total);if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();}
      if(running)active=false;else{const index=queue.indexOf(run);if(index>=0)queue.splice(index,1);}
      if(error)reject(error);else resolve(result!);pump();
    };
    const idle=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(new Error('파싱 Worker가 45초 동안 응답하지 않아 중단했습니다.')),45000);};
    const run=()=>{
      if(settled){active=false;pump();return;}running=true;
      try{worker=factory();}catch{finish(new Error('파싱 Worker를 시작할 수 없습니다. 지원 브라우저에서 다시 시도하세요.'));return;}
      timer=setTimeout(()=>finish(new Error('파싱 Worker 시작 제한(5초)을 초과했습니다.')),5000);
      total=setTimeout(()=>finish(new Error('파일 분석 제한 시간(3분)을 초과했습니다.')),180000);
      worker.onerror=()=>finish(new Error('파싱 Worker 실행에 실패했습니다.'));
      worker.onmessage=event=>{
        if(settled)return;
        if(event.data.type==='ready'){idle();try{worker!.postMessage(request);}catch{finish(new Error('원본 파일을 Worker에 전달하지 못했습니다.'));}}
        else if(event.data.type==='progress'){idle();onProgress?.(event.data.progress);}
        else if(event.data.type==='error')finish(new Error(event.data.error));
        else if(event.data.type==='result')finish(undefined,event.data.result);
      };
    };
    cancel=()=>finish(new ParseCancelled());queue.push(run);pump();
  });
  return {promise,cancel};
}
