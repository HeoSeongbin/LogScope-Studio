import type { SearchOptions, SearchResult, SearchRow } from '../types/search';
import { validateRegexRows, validateSearch } from './search';

export interface SearchWorker {
  onmessage:((event:MessageEvent)=>void)|null;
  onerror:((event:Event)=>void)|null;
  postMessage:(data:unknown)=>void;
  terminate:()=>void;
}
export const REGEX_EXECUTION_MS=1000;
export const WORKER_STARTUP_MS=5000;
export function startRegexSearch(rows:SearchRow[],options:SearchOptions,createWorker:()=>SearchWorker=()=>new Worker(new URL('../workers/search.worker.ts',import.meta.url),{type:'module'}) as unknown as SearchWorker){
  let cancel=()=>{};
  const promise=new Promise<SearchResult>((resolve,reject)=>{
    let worker:SearchWorker;
    try{validateSearch(options);validateRegexRows(rows);}
    catch(error){reject(error);return;}
    try{worker=createWorker();}
    catch{reject(new Error('검색 Worker를 시작하지 못했습니다. 일반 검색을 사용하세요.'));return;}
    let finished=false;
    const finish=(error?:Error,result?:SearchResult)=>{
      if(finished)return;finished=true;clearTimeout(timer);worker.onmessage=null;worker.onerror=null;worker.terminate();
      if(error)reject(error);else resolve(result!);
    };
    let timer=setTimeout(()=>finish(new Error('검색 Worker를 시작하지 못했습니다. 일반 검색을 사용하세요.')),WORKER_STARTUP_MS);
    cancel=()=>finish(new Error('검색이 취소되었습니다.'));
    worker.onerror=()=>finish(new Error('검색 Worker 실행에 실패했습니다. 일반 검색을 사용하세요.'));
    worker.onmessage=event=>{
      if(finished)return;
      if(event.data.type==='ready'){
        clearTimeout(timer);timer=setTimeout(()=>finish(new Error('정규식 실행 제한 시간(1초)을 초과해 검색을 중단했습니다.')),REGEX_EXECUTION_MS);
        try{worker.postMessage({rows,options});}catch{finish(new Error('검색 데이터를 전달하지 못했습니다.'));}
      }else if(event.data.type==='error')finish(new Error(event.data.error));
      else if(event.data.type==='result')finish(undefined,event.data.result);
    };
  });
  return {promise,cancel};
}
