import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { collectTraces, buildTrace } from '../core/correlation/trace';
import { validateTimezone } from '../core/file-context';
import type { ParseOptions } from '../types/log';

const parse=(text:string,options:ParseOptions={},fileId='file')=>parseLog({text,fileId,fileName:`${fileId}.log`},options).events;
const json=(record:Record<string,unknown>,options:ParseOptions={})=>parse(JSON.stringify(record),options)[0];
const api=readFileSync('public/samples/distributed-api.log','utf8');const db=readFileSync('public/samples/distributed-db.log','utf8');
describe('explicit identifiers and type/scope separation',()=>{
  it('extracts actual Spring MDC identities without confusing metadata with thread names',()=>{
    const events=parse(api);expect(events).toHaveLength(4);expect(events[0]).toMatchObject({thread:'http-1',logger:'demo.Api',requestId:'req-demo-001',traceId:'trace-demo-001',correlationId:'flow-demo-001',spanId:'span-api-1'});expect(events[2]).toMatchObject({lineStart:3,lineEnd:5,requestId:'req-demo-001',exception:{type:'java.sql.SQLException'}});expect(events[0].service).toBeUndefined();
    const withApp=parse('2026-11-06 14:30:00 INFO 1 --- [app-name] [worker-1] [traceId=t-1] demo.App : hello')[0];expect(withApp.thread).toBe('worker-1');expect(withApp.traceId).toBe('t-1');
  });
  it('extracts labeled Java/.NET/Generic key-value pairs and preserves case and ID punctuation',()=>{
    const java=parse('2026-11-06 14:30:00 [worker] ERROR [traceId=Trace-A] demo.App [requestId=req-1] - failed')[0];expect(java).toMatchObject({parserId:'java-pattern',thread:'worker',traceId:'Trace-A',requestId:'req-1'});
    const dotnet=parse('info: Demo[0] request_id=0HNABC:00000001 correlation-id="Flow One" spanId=abc/def ready')[0];expect(dotnet).toMatchObject({requestId:'0HNABC:00000001',correlationId:'Flow One',spanId:'abc/def'});
    expect(parse('requestId=req-1 traceId=Trace-A',{parser:'generic'})[0].requestId).toBe('req-1');
  });
  it('does not extract unlabeled identifiers or borrow IDs from nested stack traces',()=>{
    expect(parse('a97a4b3f-82dd-48ba-82aa-123456789abc request finished')[0].requestId).toBeUndefined();
    const event=parse('2026-11-06 14:30:00 ERROR 1 --- [worker] demo.App : failed\njava.lang.Exception: requestId=someone-else\n at Demo.run(Demo.java:1)')[0];expect(event.exception).toBeDefined();expect(event.requestId).toBeUndefined();
    expect(json({message:'traceId=from-message',nested:{requestId:'nested'}}).traceId).toBeUndefined();
  });
  it('keeps conflicting or oversized text values unresolved with diagnostics rather than silently picking/truncating',()=>{
    const conflict=parse('[INF] requestId=one requestId=two ready')[0];expect(conflict.requestId).toBeUndefined();expect(conflict.parseWarnings?.join()).toContain('IDENTIFIER_CONFLICT');
    expect(parse('[INF] requestId=one requestId=one')[0].requestId).toBe('one');const oversized=parse(`[INF] traceId=${'x'.repeat(257)}`)[0];expect(oversized.traceId).toBeUndefined();expect(oversized.parseWarnings?.join()).toContain('IDENTIFIER_LIMIT');
  });
  it('respects JSON explicit field mappings for all identity types, with no numeric coercion or ID generation',()=>{
    const value={message:'ok',Properties:{CorrelationId:'Flow-1',SpanId:'Span-1'},token:'custom-1',traceId:123};const event=json(value,{fieldMapping:{customId:'token'}});expect(event).toMatchObject({correlationId:'Flow-1',spanId:'Span-1',customId:'custom-1'});expect(event.traceId).toBeUndefined();expect(event.parsedFields).toEqual(value);
    expect(json({message:'ok',CorrelationId:'default',other:'mapped'},{fieldMapping:{correlationId:'other'}}).correlationId).toBe('mapped');expect(json({message:'ok',CorrelationId:'default'},{fieldMapping:{correlationId:'absent'}}).correlationId).toBeUndefined();
    expect(json({message:'scope',Scopes:[{TraceId:'from-scope'}]},{fieldMapping:{traceId:'Scopes.0.TraceId'}}).traceId).toBe('from-scope');
  });
  it('uses only declared IIS custom ID fields and never mistakes HTTP status/IP for an identifier',()=>{
    const event=parse('#Fields: sc-status cs(X-Request-ID) trace-id c-ip\n500 req-iis Trace-IIS 192.0.2.1')[0];expect(event).toMatchObject({requestId:'req-iis',traceId:'Trace-IIS',level:'UNKNOWN'});expect(event.correlationId).toBeUndefined();expect(event.exception).toBeUndefined();
  });
  it('does not link equal strings across ID types, scopes, or case',()=>{
    const events=[json({message:'request',requestId:'same'}),{...json({message:'trace',traceId:'same'}),id:'other'},...parse('requestId=Same',{},'third')];expect(collectTraces(events,'requestId')).toHaveLength(2);expect(collectTraces(events,'traceId')[0].events).toHaveLength(1);
    const scoped=[...parse('requestId=req-1',{correlationScope:'prod'},'a'),...parse('requestId=req-1',{correlationScope:'test'},'b')];expect(collectTraces(scoped,'requestId')).toHaveLength(2);
    const spans=[json({message:'one',traceId:'Trace-1',spanId:'same'}),{...json({message:'two',traceId:'Trace-2',spanId:'same'}),id:'second-span'}];expect(collectTraces(spans,'spanId')).toHaveLength(2);
  });
});
describe('file timezone and explicit metadata provenance',()=>{
  it('normalizes only offset-free full timestamps with a user timezone and keeps source fields intact',()=>{
    const text='2026-11-06 14:30:00.123 INFO 1 --- [main] demo.App : ready';const event=parse(text,{timezone:'Asia/Seoul',serviceName:'demo-api'})[0];expect(event).toMatchObject({timestamp:Date.parse('2026-11-06T05:30:00.123Z'),rawTimestamp:'2026-11-06 14:30:00.123',timezone:'Asia/Seoul',timeSource:'file-setting',assumedTimezone:'Asia/Seoul',service:'demo-api',serviceSource:'file-setting',rawText:text});expect(event.parseWarnings?.join()).not.toContain('시간대 미지정');expect(event.parsedFields).toEqual({pid:1});
  });
  it('preserves explicit offsets, actual service and IIS UTC despite conflicting file configuration',()=>{
    const event=json({timestamp:'2026-11-06T14:30:00+09:00',service:'logged-service',message:'ok'},{timezone:'America/New_York',serviceName:'configured'});expect(event).toMatchObject({timestamp:Date.parse('2026-11-06T05:30:00Z'),timezone:'+09:00',timeSource:'log',service:'logged-service',serviceSource:'log'});expect(event.assumedTimezone).toBeUndefined();
    const iis=parse('#Fields: date time sc-status\n2026-11-06 05:30:00 200',{timezone:'+09:00'})[0];expect(iis).toMatchObject({timezone:'Z',timeSource:'format',timestamp:Date.parse('2026-11-06T05:30:00Z')});
  });
  it('rejects DST overlaps and gaps rather than moving the input to a different clock time',()=>{
    for(const timestamp of ['2026-11-01 01:30:00','2026-03-08 02:30:00']){const event=json({timestamp,message:'DST'},{timezone:'America/New_York'});expect(event.timestamp).toBeNull();expect(event.rawTimestamp).toBe(timestamp);expect(event.parseWarnings?.join()).toContain('TIMEZONE_UNRESOLVED');expect(event.parseWarnings?.join()).not.toContain('시간대 미지정');}
    expect(json({timestamp:'2026-11-01 01:30:00-04:00',message:'explicit'},{timezone:'America/New_York'}).timestamp).toBe(Date.parse('2026-11-01T05:30:00Z'));
  });
  it('supports fixed offsets and rejects invalid zones or calendar dates',()=>{
    expect(json({timestamp:'2026-11-06 14:30:00',message:'offset'},{timezone:'+09:00'}).timestamp).toBe(Date.parse('2026-11-06T05:30:00Z'));expect(()=>validateTimezone('Not/AZone')).toThrow('IANA');expect(()=>parse(api,{timezone:'Not/AZone'})).toThrow();expect(json({timestamp:'2026-02-30 10:00:00',message:'invalid'},{timezone:'UTC'}).timestamp).toBeNull();
  });
  it('does not invent dates for time-only logs or time fields for missing timestamps',()=>{
    expect(parse('[14:30:00 INF] ready',{timezone:'UTC'})[0].timestamp).toBeNull();expect(json({message:'no time'},{timezone:'UTC'}).timestamp).toBeNull();expect(json({message:'no time'},{timezone:'UTC'}).rawTimestamp).toBeUndefined();
  });
});
describe('cross-file observed trace timeline',()=>{
  it('combines actual sample identities across services and different time bases without claiming a duration/tree',()=>{
    const events=[...parse(api,{serviceName:'demo-api'},'api'),...parse(db,{timezone:'UTC',serviceName:'demo-db'},'db')];const group=collectTraces(events,'requestId').find(group=>group.value==='req-demo-001')!;const trace=buildTrace(group);expect(group.events).toHaveLength(6);expect(trace.fileCount).toBe(2);expect(trace.services.map(service=>service.service)).toEqual(['demo-api','demo-db']);expect(trace.timed).toHaveLength(5);expect(trace.untimed).toHaveLength(1);expect(trace.timed.map(event=>event.sourceFileId)).toEqual(['api','api','db','db','api']);expect(trace.observedWindowMs).toBe(4030);expect(trace.errors).toBe(2);expect(trace.timeBases).toContain('파일 설정: UTC');
  });
  it('deduplicates identical event IDs, preserves equal-time source order and leaves missing time out of the axis',()=>{
    const first=json({timestamp:'2026-11-06T00:00:00Z',message:'first',requestId:'r'});const second={...first,id:'second',message:'second'};const missing={...first,id:'missing',timestamp:null,rawTimestamp:undefined};const group=collectTraces([first,second,first,missing],'requestId')[0];const trace=buildTrace(group);expect(group.events).toHaveLength(3);expect(trace.timed.map(event=>event.id)).toEqual([first.id,'second']);expect(trace.untimed).toEqual([missing]);expect(trace.observedWindowMs).toBe(0);
  });
  it('does not compute an observed time interval from fewer than two timed events',()=>{
    const event=json({message:'one',requestId:'r'});expect(buildTrace(collectTraces([event],'requestId')[0]).observedWindowMs).toBeNull();expect(collectTraces([],'traceId')).toEqual([]);
  });
});
