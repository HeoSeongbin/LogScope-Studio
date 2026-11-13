// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startParse, setParseWorkerFactory, ParseCancelled } from '../core/parsing/worker-client';
import { createNodeParseWorker } from './node-parse-worker';
import { useWorkspace } from '../stores/workspace';
import type { SearchWorker } from '../core/regex-client';
afterEach(()=>{useWorkspace.getState().reset();vi.useRealTimers();setParseWorkerFactory(createNodeParseWorker);});
const request={source:new Blob(['INFO ready\r\nERROR failed']),fileId:'test',fileName:'test.log',options:{}};
describe('parsing worker lifecycle',()=>{
  it('executes the production worker and reports actual progress',async()=>{
    const phases:string[]=[];const result=await startParse(request,p=>{expect(p.bytesRead).toBeLessThanOrEqual(p.totalBytes);phases.push(p.phase);}).promise;
    expect(result.events.map(e=>e.rawText)).toEqual(['INFO ready','ERROR failed']);expect(phases).toContain('scan');expect(phases).toContain('parse');
  });
  it('serializes workers, cancels queued and running jobs, ignores late messages',async()=>{
    const workers:SearchWorker[]=[];let terminated=0;
    setParseWorkerFactory(()=>{const worker:SearchWorker={onmessage:null,onerror:null,postMessage:()=>{},terminate:()=>{terminated++;}};workers.push(worker);return worker;});
    const first=startParse(request),second=startParse(request),third=startParse(request);
    const firstError=first.promise.catch(e=>e),secondError=second.promise.catch(e=>e),thirdError=third.promise.catch(e=>e);
    expect(workers).toHaveLength(1);second.cancel();expect(await secondError).toBeInstanceOf(ParseCancelled);
    const late=workers[0].onmessage;first.cancel();expect(await firstError).toBeInstanceOf(ParseCancelled);expect(workers).toHaveLength(2);
    late?.({data:{type:'result',result:{events:[]}}} as MessageEvent);third.cancel();expect(await thirdError).toBeInstanceOf(ParseCancelled);expect(terminated).toBe(2);
  });
  it('terminates a worker that never becomes ready',async()=>{
    vi.useFakeTimers();const terminate=vi.fn();setParseWorkerFactory(()=>({onmessage:null,onerror:null,postMessage:()=>{},terminate}));
    const error=startParse(request).promise.catch(e=>e);await vi.advanceTimersByTimeAsync(5000);expect((await error).message).toContain('5초');expect(terminate).toHaveBeenCalledOnce();
  });
  it('terminates an idle worker after readiness and records startup failures',async()=>{
    vi.useFakeTimers();const terminate=vi.fn();const worker:SearchWorker={onmessage:null,onerror:null,postMessage:()=>{},terminate};setParseWorkerFactory(()=>worker);
    const error=startParse(request).promise.catch(e=>e);worker.onmessage?.({data:{type:'ready'}} as MessageEvent);await vi.advanceTimersByTimeAsync(45000);expect((await error).message).toContain('45초');expect(terminate).toHaveBeenCalledOnce();
    setParseWorkerFactory(()=>{throw new Error('unavailable');});await expect(startParse(request).promise).rejects.toThrow('시작할 수 없습니다');
  });
  it('keeps large originals outside the decoded source cache and bounds previews',async()=>{
    const text=('INFO '+ 'x'.repeat(1020)+'\n').repeat(600);await useWorkspace.getState().upload([new File([text],'large.log')]);const state=useWorkspace.getState(),id=state.files[0].id;
    expect(state.files[0]).toMatchObject({status:'done',count:600,originalAvailable:true});expect(state.sources[id]).toBeUndefined();const preview=await state.readSourcePreview(id);expect(preview.truncated).toBe(true);expect(preview.text.length).toBe(512*1024);expect(text.startsWith(preview.text)).toBe(true);
    await state.reparse(id,{parser:'generic'});expect(useWorkspace.getState().events.map(e=>e.rawText).join('\n')+'\n').toBe(text);state.remove(id);await expect(state.readSourcePreview(id)).rejects.toThrow('제거');
  });
  it('retains original and completed results when reparsing is cancelled, then retries',async()=>{
    await useWorkspace.getState().upload([new File(['INFO original'],'original.log')]);const state=useWorkspace.getState(),id=state.files[0].id,events=state.events;
    const pending=state.reparse(id,{parser:'generic'}).catch(e=>e);state.cancelParse(id);expect(await pending).toBeInstanceOf(ParseCancelled);
    expect(useWorkspace.getState().events).toBe(events);expect(useWorkspace.getState().files[0].status).toBe('done');expect((await state.readSourcePreview(id)).text).toBe('INFO original');
    await state.reparse(id,{parser:'generic'});expect(useWorkspace.getState().files[0].parserChoice).toBe('generic');
  });
  it('does not commit a removed file or add later batch inputs after reset',async()=>{
    const pending=useWorkspace.getState().upload([new File(['INFO late'],'late.log')]);const id=useWorkspace.getState().files[0].id;useWorkspace.getState().remove(id);await pending;expect(useWorkspace.getState().events).toEqual([]);expect(useWorkspace.getState().files).toEqual([]);
  });
});
