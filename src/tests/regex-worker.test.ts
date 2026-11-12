// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { startRegexSearch, type SearchWorker, WORKER_STARTUP_MS } from '../core/regex-client';
import { defaultSearch } from '../types/search';

const compiled=ts.transpileModule(readFileSync('src/core/search.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function realWorker():SearchWorker{
  const native=new NodeWorker(`const {parentPort}=require('node:worker_threads');${compiled}\nparentPort.on('message',data=>{try{parentPort.postMessage({type:'result',result:exports.executeRegexSearch(data.rows,data.options)});}catch(e){parentPort.postMessage({type:'error',error:e.message});}});parentPort.postMessage({type:'ready'});`,{eval:true});
  const adapter:SearchWorker={onmessage:null,onerror:null,postMessage:data=>native.postMessage(data),terminate:()=>{void native.terminate();}};
  native.on('message',data=>adapter.onmessage?.({data} as MessageEvent));native.on('error',()=>adapter.onerror?.(new Event('error')));return adapter;
}
describe('regex worker lifecycle',()=>{
  it('executes actual search in a separate worker',async()=>{
    const task=startRegexSearch([{id:'one',fields:['timeout'],message:'timeout'}],{...defaultSearch,mode:'regex',query:'time(out)'},realWorker);expect((await task.promise).ids).toEqual(['one']);
  });
  it('terminates an actual catastrophic backtracking expression by deadline',async()=>{
    const started=performance.now();const text='a'.repeat(30000)+'!';
    const task=startRegexSearch([{id:'slow',fields:[text],message:text}],{...defaultSearch,mode:'regex',query:'(a+)+$'},realWorker);
    await expect(task.promise).rejects.toThrow('제한 시간');expect(performance.now()-started).toBeLessThan(5000);
  },10000);
  it('returns worker syntax errors without accepting partial results',async()=>{
    const task=startRegexSearch([],{...defaultSearch,mode:'regex',query:'['},realWorker);await expect(task.promise).rejects.toThrow();
  });
  it('cancels a pending task and ignores a late completion',async()=>{
    const worker:SearchWorker={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()};
    const task=startRegexSearch([],{...defaultSearch,mode:'regex',query:'x'},()=>worker);const callback=worker.onmessage;task.cancel();callback?.({data:{type:'result',result:{ids:['late'],messageRanges:{}}}} as MessageEvent);
    await expect(task.promise).rejects.toThrow('취소');expect(worker.terminate).toHaveBeenCalledOnce();expect(worker.onmessage).toBeNull();
  });
  it('handles startup timeouts and unavailable workers explicitly',async()=>{
    vi.useFakeTimers();
    try{const worker:SearchWorker={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()};const task=startRegexSearch([],{...defaultSearch,mode:'regex',query:'x'},()=>worker);const assertion=expect(task.promise).rejects.toThrow('시작하지');await vi.advanceTimersByTimeAsync(WORKER_STARTUP_MS);await assertion;expect(worker.terminate).toHaveBeenCalledOnce();}
    finally{vi.useRealTimers();}
    await expect(startRegexSearch([],{...defaultSearch,mode:'regex',query:'x'},()=>{throw new Error('unavailable');}).promise).rejects.toThrow('일반 검색');
  });
});
