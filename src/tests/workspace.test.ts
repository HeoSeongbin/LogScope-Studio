// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { useWorkspace, MAX_FILE_BYTES } from '../stores/workspace';
import { groupExceptions } from '../core/exceptions/groups';
import { aggregateStatistics, buildTimeline } from '../core/statistics';
afterEach(()=>useWorkspace.getState().reset());
describe('file lifecycle',()=>{
  it('recomputes statistics and timeline after real file upload, reparse and removal',async()=>{
    const text=readFileSync('public/samples/statistics-demo.jsonl','utf8');await useWorkspace.getState().upload([new File([text],'stats.jsonl'),new File(['INFO other'],'other.log')]);const state=useWorkspace.getState();const id=state.files[0].id;
    expect(aggregateStatistics(state.events).summary).toMatchObject({total:13,errors:5,exceptions:3});expect(buildTimeline(state.events,'1m').buckets).toHaveLength(5);
    state.reparse(id,{parser:'generic'});expect(aggregateStatistics(useWorkspace.getState().events).summary.exceptions).toBe(0);expect(buildTimeline(useWorkspace.getState().events,'1m').buckets).toEqual([]);expect(useWorkspace.getState().sources[id]).toBe(text);
    state.remove(id);expect(aggregateStatistics(useWorkspace.getState().events).summary.total).toBe(1);expect(buildTimeline(useWorkspace.getState().events,'1m').buckets).toEqual([]);
  });
  it('uploads merged stacks, reparses without duplicates and removes only derived file groups',async()=>{
    const text=readFileSync('public/samples/spring-exception.log','utf8');await useWorkspace.getState().upload([new File([text],'java.log'),new File(['INFO other'],'other.log')]);
    const state=useWorkspace.getState();const id=state.files[0].id;expect(state.files[0].count).toBe(3);expect(state.files[0].failures).toBe(0);expect(groupExceptions(state.events)[0].events).toHaveLength(2);expect(state.sources[id]).toBe(text);
    state.reparse(id,{parser:'generic'});expect(groupExceptions(useWorkspace.getState().events)).toEqual([]);state.reparse(id,{parser:'spring'});expect(groupExceptions(useWorkspace.getState().events)[0].events).toHaveLength(2);expect(useWorkspace.getState().events).toHaveLength(4);state.remove(id);expect(groupExceptions(useWorkspace.getState().events)).toEqual([]);expect(useWorkspace.getState().events[0].message).toBe('INFO other');
  });
  it('uploads real Spring sample, removes only one file and resets',async()=>{
    await useWorkspace.getState().upload([new File([readFileSync('public/samples/spring-normal.log')],'spring.log'),new File(['INFO other'],'other.txt')]);
    const state=useWorkspace.getState();expect(state.events).toHaveLength(6);expect(state.files[0].parser).toBe('Spring Boot');expect(state.files.every(file=>file.status==='done')).toBe(true);
    state.select(state.events[0].id);state.remove(state.files[0].id);
    expect(useWorkspace.getState().events).toHaveLength(1);expect(useWorkspace.getState().selectedId).toBeNull();
    state.reset();expect(useWorkspace.getState().events).toEqual([]);
  });
  it('rejects oversized files and malformed UTF-8',async()=>{
    await useWorkspace.getState().upload([new File([new Uint8Array(MAX_FILE_BYTES+1)],'big.log'),new File([new Uint8Array([0xff,0xfe,0x00])],'bad.txt')]);
    expect(useWorkspace.getState().files.every(file=>file.status==='error')).toBe(true);expect(useWorkspace.getState().events).toEqual([]);
  });
  it('decodes UTF-16 BOM',async()=>{
    await useWorkspace.getState().upload([new File([new Uint8Array([0xff,0xfe,0x41,0x00])],'utf16.log')]);
    expect(useWorkspace.getState().events[0].rawText).toBe('A');
  });
  it('ignores a file read completing after reset',async()=>{
    let finish!:(value:ArrayBuffer)=>void;
    const file=new File(['late'],'late.log');
    file.arrayBuffer=()=>new Promise(resolve=>{finish=resolve;});
    const pending=useWorkspace.getState().upload([file]);useWorkspace.getState().reset();
    finish(new TextEncoder().encode('late').buffer);await pending;
    expect(useWorkspace.getState().files).toEqual([]);expect(useWorkspace.getState().events).toEqual([]);
  });
  it('reparses a single file from separate original source without duplicates',async()=>{
    const text='{"custom":"hello","severity":"Error"}\r\n{broken';
    await useWorkspace.getState().upload([new File([text],'json.log'),new File(['INFO other'],'other.log')],{parser:'generic'});
    const state=useWorkspace.getState();const file=state.files[0];const other=state.events.at(-1)!;state.select(other.id);
    state.reparse(file.id,{parser:'json',fieldMapping:{message:'custom'}});
    const after=useWorkspace.getState();expect(after.sources[file.id]).toBe(text);expect(after.events).toHaveLength(3);expect(after.events[0]).toMatchObject({message:'hello',level:'ERROR'});expect(after.files[0]).toMatchObject({failures:1,parserChoice:'json',count:2});expect(after.events[2]).toBe(other);expect(after.selectedId).toBe(other.id);
    after.select(after.events[0].id);after.reparse(file.id,{parser:'generic'});expect(useWorkspace.getState().selectedId).toBeNull();expect(useWorkspace.getState().events).toHaveLength(3);
    after.remove(file.id);expect(useWorkspace.getState().sources[file.id]).toBeUndefined();expect(useWorkspace.getState().events).toEqual([other]);
  });
  it('uploads every public Phase 2 fixture and records recoverable parsing failures',async()=>{
    const names=['logback.log','dotnet-normal.log','serilog-text.log','serilog.jsonl','structured.jsonl','iis-access.log'];
    await useWorkspace.getState().upload(names.map(name=>new File([readFileSync(`public/samples/${name}`)],name)));
    const state=useWorkspace.getState();expect(state.files.every(file=>file.status==='done')).toBe(true);expect(state.files.map(file=>file.count)).toEqual([2,3,2,3,5,4]);expect(state.files.map(file=>file.failures)).toEqual([0,0,0,0,1,1]);expect(Object.keys(state.sources)).toHaveLength(6);
  });
});
