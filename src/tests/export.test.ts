// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { collectTraces } from '../core/correlation/trace';
import { aggregateStatistics } from '../core/statistics';
import { csvCell, eventDataset, exceptionDataset, exceptionGroupsDataset, MAX_EXPORT_EVENTS, serializeExport, statisticsDataset, timelineDataset, traceDataset } from '../core/export';
const parse=(text:string)=>parseLog({text,fileId:'one',fileName:'원본.log'}).events;
const context={scope:'filtered',search:{query:'한글'},files:[{id:'one',timezone:'UTC'}]};
describe('local analysis exports',()=>{
  it('round trips original strings, null times, fields, source locations and diagnostics without mutation',async()=>{
    const events=parse(JSON.stringify({message:'한글 😀\r\n=HYPERLINK("url")',level:'ERROR',meta:{id:1}})+'\r\n{broken');const before=JSON.stringify(events);
    const result=await serializeExport(eventDataset(events,context),'json');const document=JSON.parse(await result.blob.text());
    expect(document.rows).toEqual(JSON.parse(before));expect(document.rows[0].timestamp).toBeNull();expect(document.rows[1].parseErrors[0]).toContain('JSON_');expect(document.metadata.context).toEqual(context);expect(document.metadata.rowCount).toBe(2);expect(result.bytes).toBe(result.blob.size);expect(JSON.stringify(events)).toBe(before);
  });
  it.each(['=1+1','+SUM(A1)','-2+3','@cmd','  =SUM(1)','\tvalue','\rvalue','\nvalue','＝1','＋1','－1','＠x'])('protects formula prefix %j',value=>{
    expect(csvCell(value)).toBe('"\''+value.replace(/"/g,'""')+'"');
  });
  it('quotes separators, newlines and quotes, includes BOM and keeps JSON originals unchanged',async()=>{
    expect(csvCell('plain,"quoted"\r\n한글')).toBe('"plain,""quoted""\r\n한글"');expect(csvCell(null)).toBe('""');expect(csvCell(0)).toBe('"0"');
    const events=parse('=1+1');const csv=await serializeExport(eventDataset(events,context),'csv');const bytes=new Uint8Array(await csv.blob.arrayBuffer());expect([...bytes.slice(0,3)]).toEqual([239,187,191]);expect(await csv.blob.text()).toContain('"\'=1+1"');expect(await csv.blob.text()).toContain('exportContext');expect(events[0].rawText).toBe('=1+1');
  });
  it('writes inert HTML with escaped log text and restrictive resource policy',async()=>{
    const events=parse('<img src=x onerror=alert(1)><script>alert("x")</script>');const result=await serializeExport(eventDataset(events,context),'html');const html=await result.blob.text();
    expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('default-src \'none\'');expect(html).toContain('정규화');expect(html).toContain('schemaVersion');
  });
  it('exports complete error groups and selected exception trees using actual event IDs',async()=>{
    const events=parse(readFileSync('public/samples/spring-exception.log','utf8'));const dataset=exceptionGroupsDataset(events,context);const artifact=await serializeExport(dataset,'json');const rows=JSON.parse(await artifact.blob.text()).rows;
    expect(rows).toHaveLength(1);expect(rows[0].count).toBe(2);expect(rows[0].eventIds).toEqual(events.filter(e=>e.exception).map(e=>e.id));
    const event=events.find(e=>e.exception)!;expect(exceptionDataset(event,context).rows).toEqual([event]);expect(()=>exceptionDataset(events.find(e=>!e.exception)!,context)).toThrow('먼저 선택');
  });
  it('exports typed/scoped trace order with untimed events separate and no invented timestamps',()=>{
    const events=parse('{"message":"late","requestId":"same","timestamp":"2026-11-06T00:00:02Z"}\n{"message":"unknown","requestId":"same"}\n{"message":"early","requestId":"same","timestamp":"2026-11-06T00:00:00Z"}');const group=collectTraces(events,'requestId')[0];const dataset=traceDataset(group,context);
    expect(dataset.rows.map(row=>(row as {message:string}).message)).toEqual(['early','late','unknown']);expect(dataset.summary).toMatchObject({observedWindowMs:2000,untimed:1});expect(dataset.context).toMatchObject({identifier:{kind:'requestId',value:'same',scope:null}});expect(events[1].timestamp).toBeNull();
  });
  it('uses the selected UTC bucket size, independent counts and explicit null summary for empty input',()=>{
    const events=parse(readFileSync('public/samples/statistics-demo.jsonl','utf8'));const dataset=timelineDataset(events,'5m',context);expect(dataset.context).toMatchObject({bucketSize:'5m',bucketBounds:'[start,end)',timezone:'UTC'});expect(dataset.summary).toMatchObject({counts:aggregateStatistics(events).summary});expect(statisticsDataset(events,context).rows[0]).toMatchObject({summary:aggregateStatistics(events).summary});
    expect(eventDataset([],context).summary).toMatchObject({firstSeen:null,lastSeen:null,errorRate:null});
    const distant=parse('{"timestamp":"2000-01-01T00:00:00Z"}\n{"timestamp":"2026-01-01T00:00:00Z"}');expect(()=>timelineDataset(distant,'1m',context)).toThrow('한도');
  });
  it('fails whole exports on event/UTF-8 byte limits without silently truncating rows',async()=>{
    const event=parse('한글😀')[0];expect(()=>eventDataset(Array.from({length:MAX_EXPORT_EVENTS+1},()=>event),context)).toThrow('EXPORT_LIMIT');
    const dataset=eventDataset([event],context);const first=await serializeExport(dataset,'json');await expect(serializeExport(dataset,'json',{maxBytes:first.bytes-1})).rejects.toThrow('EXPORT_LIMIT');expect((await serializeExport(dataset,'json',{maxBytes:first.bytes})).bytes).toBe(first.bytes);
  });
  it('enforces the actual default 32 MiB output boundary',async()=>{
    const event={...parse('INFO synthetic')[0],message:'',rawText:'x'.repeat(1024*1024)};
    const rows=Array.from({length:31},(_,i)=>({...event,id:`synthetic-${i}`}));
    const result=await serializeExport(eventDataset(rows,{}),'json');expect(result.bytes).toBeGreaterThan(31*1024*1024);expect(result.bytes).toBeLessThanOrEqual(32*1024*1024);
    await expect(serializeExport(eventDataset([...rows,{...event,id:'synthetic-31'}],{}),'json')).rejects.toThrow('EXPORT_LIMIT');
  });
  it('cancels before work and between batches and reports actual serialized rows',async()=>{
    const events=Array.from({length:250},(_,i)=>({...parse('INFO event')[0],id:String(i)}));const dataset=eventDataset(events,context);const controller=new AbortController();controller.abort();await expect(serializeExport(dataset,'json',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
    const mid=new AbortController();const progress:number[]=[];await expect(serializeExport(dataset,'csv',{signal:mid.signal,onProgress:done=>{progress.push(done);if(done===100)mid.abort();}})).rejects.toMatchObject({name:'AbortError'});expect(progress).toEqual([0,100]);
  });
});
