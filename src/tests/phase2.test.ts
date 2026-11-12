import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog, parsers } from '../core/parsers';
import type { ParseOptions } from '../types/log';
import { formatEvent } from '../core/format';
const parse=(text:string,options?:ParseOptions)=>parseLog({text,fileId:'file',fileName:'demo.log'},options);
const sample=(name:string)=>readFileSync(`public/samples/${name}`,'utf8');
describe('Phase 2 supported text formats',()=>{
  it('normalizes both Logback/Log4j2 pattern variants',()=>{
    const {events,parser}=parse(sample('logback.log'));expect(parser).toBe('Logback / Log4j2');
    expect(events.map(event=>event.level)).toEqual(['INFO','ERROR']);
    expect(events[0]).toMatchObject({thread:'main',logger:'demo.Application',message:'Application ready',timestamp:null});
    expect(events[1]).toMatchObject({thread:'worker-1',logger:'demo.Repository'});
  });
  it('parses ILogger SimpleConsole boundaries and preserves CRLF',()=>{
    const text='fail: Demo.Service[42]\r\n      Request failed\r\ninfo: Demo.Service[3] Ready';
    const {events}=parse(text);expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({parserId:'dotnet',lineStart:1,lineEnd:2,level:'ERROR',logger:'Demo.Service',message:'Request failed',parsedFields:{eventId:42},rawText:text.split('\r\n').slice(0,2).join('\r\n')});
    expect(events[1].lineStart).toBe(3);
  });
  it('groups a .NET stack as exception data while retaining the ILogger header',()=>{
    const {events}=parse('fail: Demo.Service[42]\n      System.InvalidOperationException: failure\n         at Demo.Run()');expect(events).toHaveLength(1);expect(events[0]).toMatchObject({parserId:'dotnet',logger:'Demo.Service',lineStart:1,lineEnd:3,exception:{type:'System.InvalidOperationException'}});expect(events[0].parseErrors??[]).toEqual([]);
  });
  it('normalizes all ILogger severity abbreviations',()=>{
    expect(parse(['trce','dbug','info','warn','fail','crit'].map(level=>`${level}: Demo[0] msg`).join('\n')).events.map(event=>event.level)).toEqual(['TRACE','DEBUG','INFO','WARN','ERROR','FATAL']);
  });
  it('normalizes Serilog severity abbreviations and leaves partial time unresolved',()=>{
    const {events}=parse(sample('serilog-text.log'));expect(events.map(event=>event.level)).toEqual(['ERROR','INFO']);expect(events[1].rawTimestamp).toBe('14:31:11');expect(events[1].timestamp).toBeNull();
    expect(parse('[VRB] v\n[DBG] d\n[WRN] w\n[FTL] f').events.map(event=>event.level)).toEqual(['TRACE','DEBUG','WARN','FATAL']);
    const offset=parse('2026-11-06 14:31:10.250 +09:00 [ERR] Failed').events[0];expect(offset.timestamp).toBe(Date.parse('2026-11-06T05:31:10.250Z'));expect(offset.rawTimestamp).toBe('2026-11-06 14:31:10.250 +09:00');
  });
  it('detects registry patterns deterministically',()=>{
    for(const [id,file] of [['java-pattern','logback.log'],['dotnet','dotnet-normal.log'],['serilog','serilog-text.log'],['json','serilog.jsonl'],['iis','iis-access.log']])expect(parsers.find(parser=>parser.id===id)?.detect(sample(file))).toBeGreaterThan(0);
  });
  it('parses mixed formats without assigning a single parser to every row',()=>{
    const text=[sample('logback.log').trim(),sample('dotnet-normal.log').trim(),'[ERR] failure','{"level":"INFO","message":"JSON event"}','unrecognized'].join('\n');
    const {events,parser}=parse(text);expect(parser).toContain('혼합');expect(new Set(events.map(event=>event.parserId))).toEqual(new Set(['java-pattern','dotnet','serilog','json','generic']));expect(events.at(-1)?.rawText).toBe('unrecognized');expect(events.at(-1)?.parseErrors).toBeDefined();
  });
  it('manual parser selection is strict and Generic can override detection',()=>{
    const text='[ERR] Demo failed';expect(parse(text,{parser:'generic'}).events[0].parserId).toBe('generic');
    expect(parse(text,{parser:'spring'}).events[0].parseErrors?.[0]).toContain('SPRING_PATTERN');
    expect(parse(text,{parser:'serilog'}).events[0].level).toBe('ERROR');
  });
});
describe('JSON normalization and provenance',()=>{
  it('parses real NDJSON sample and recovers after malformed rows',()=>{
    const text=sample('structured.jsonl');const {events}=parse(text);expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({level:'ERROR',service:'demo-api',traceId:'demo-trace-1',exception:{type:'DemoException',message:'Demo failure'}});
    expect(events[0].timestamp).toBe(Date.parse('2026-11-06T05:32:00Z'));
    expect(events[1]).toMatchObject({timestamp:null,requestId:'demo-request-1'});
    expect(events[3]).toMatchObject({parserId:'generic',lineStart:4,rawText:'{broken-json'});expect(events[3].parseErrors?.[0]).toContain('JSON_SYNTAX');expect(events[4].level).toBe('DEBUG');
  });
  it('supports Serilog compact and standard JSON without rendering templates',()=>{
    const {events}=parse(sample('serilog.jsonl'));expect(events.map(event=>event.parserId)).toEqual(['serilog-json','serilog-json','serilog-json']);expect(events[0]).toMatchObject({level:'ERROR',logger:'Demo.Payments',requestId:'demo-request-1'});
    expect(events[1]).toMatchObject({level:'INFO',message:'Completed {Count} requests',parsedFields:{Count:2}});expect(events[1].parseWarnings?.join()).toContain('MESSAGE_TEMPLATE');expect(events[2].traceId).toBe('demo-trace-1');
  });
  it('keeps missing levels UNKNOWN outside CLEF and does not infer identifiers',()=>{
    const event=parse('{"message":"error for request x"}').events[0];expect(event.level).toBe('UNKNOWN');expect(event.requestId).toBeUndefined();expect(event.timestamp).toBeNull();
    expect(parse('{"@t":"2026-11-06T00:00:00Z","@mt":"m","@l":null}').events[0].level).toBe('UNKNOWN');
  });
  it('supports explicit nested field mappings and reports missing mappings',()=>{
    const text='{"meta":{"when":"2026-11-06T00:00:00Z","severity":"Warning"},"body":"hello","id":"req-1","trace":"tr-1"}';
    const {events}=parse(text,{fieldMapping:{timestamp:'meta.when',level:'meta.severity',message:'body',requestId:'id',traceId:'trace'}});
    expect(events[0]).toMatchObject({level:'WARN',message:'hello',requestId:'req-1',traceId:'tr-1',timestamp:Date.parse('2026-11-06T00:00:00Z')});
    const missing=parse(text,{fieldMapping:{message:'absent'}}).events[0];expect(missing.parseWarnings?.join()).toContain('MAPPING_MISSING');expect(missing.message).toBe(text);
  });
  it('preserves pretty JSON and array record source ranges, nested arrays, and escaped delimiters',()=>{
    const first='{\r\n  "message": "hello, } ] \\" world", "nested": [1,2]\r\n}';
    const second='{"message":"second"}';const text=`[\r\n${first},\r\n${second}, 42, null]`;
    const {events}=parse(text);expect(events).toHaveLength(4);expect(events[0].rawText).toBe(first);expect(events[0]).toMatchObject({lineStart:2,lineEnd:4,parserId:'json'});expect(events[1].rawText).toBe(second);expect(events[2].parseErrors?.join()).toContain('JSON_RECORD_TYPE');expect(new Set(events.map(event=>event.id)).size).toBe(4);
    expect(parse('[]').events).toEqual([]);
  });
  it('keeps malformed JSON array content visible instead of discarding the file',()=>{
    const text='[\n{"message":"ok"},\nBAD\n]';const {events}=parse(text,{parser:'json'});expect(events).toHaveLength(4);expect(events.map(event=>event.rawText)).toEqual(text.split('\n'));expect(events.every(event=>event.parseErrors?.length)).toBe(true);
  });
  it('does not access inherited object properties or execute log content',()=>{
    const text='{"__proto__":{"polluted":true},"message":"<img src=x onerror=alert(1)>"}';const event=parse(text,{fieldMapping:{traceId:'toString'}}).events[0];expect(event.traceId).toBeUndefined();expect(event.parsedFields.__proto__).toEqual({polluted:true});expect(event.message).toContain('<img');expect(Object.hasOwn({},'polluted')).toBe(false);
  });
  it('does not crash the detail view on deeply nested valid JSON',()=>{
    const text='{"message":"nested","data":'+'['.repeat(10000)+'0'+']'.repeat(10000)+'}';const event=parse(text).events[0];expect(event.parserId).toBe('json');expect(formatEvent(event)).toContain('원본 로그를 확인');expect(event.rawText).toBe(text);
  });
});
describe('IIS W3C context',()=>{
  it('uses #Fields ordering changes, keeps UTC and separates HTTP status from exceptions',()=>{
    const {events,directives}=parse(sample('iis-access.log'));expect(events).toHaveLength(4);expect(directives).toBe(4);
    expect(events[0]).toMatchObject({lineStart:4,timezone:'Z',timestamp:Date.parse('2026-11-06T05:33:00Z'),level:'UNKNOWN'});
    expect(events[1].parsedFields['sc-status']).toBe('500');expect(events[1].exception).toBeUndefined();expect(events[1].level).toBe('UNKNOWN');
    expect(events[2]).toMatchObject({lineStart:7,message:'GET /demo/missing HTTP 404'});expect(events[2].parsedFields['time-taken']).toBe('3');expect(events[3].parseErrors?.join()).toContain('IIS_COLUMNS');
  });
  it('does not guess missing fields or column declarations',()=>{
    expect(parse('2026-11-06 00:00:00 GET / 200',{parser:'iis'}).events[0].parseErrors?.join()).toContain('IIS_FIELDS_MISSING');
    const event=parse('#Fields: cs-method cs-uri-stem\nGET /demo').events[0];expect(event.timestamp).toBeNull();expect(event.level).toBe('UNKNOWN');expect(event.parsedFields['sc-status']).toBeUndefined();
  });
  it('invalid duplicate declarations reset previous field context and preserve the bad header',()=>{
    const {events}=parse('#Fields: sc-status\n200\n#Fields: date date\n2026-11-06 2026-11-06');expect(events[1].rawText).toBe('#Fields: date date');expect(events[1].parseErrors?.join()).toContain('IIS_FIELDS');expect(events[2].parseErrors?.join()).toContain('IIS_FIELDS_MISSING');
  });
  it('retains hyphen fields and validates bad status/duration without dropping records',()=>{
    const event=parse('#Fields: sc-status time-taken c-ip\nbad -1 -').events[0];expect(event.parsedFields['c-ip']).toBe('-');expect(event.parseWarnings?.join()).toContain('IIS_STATUS_INVALID');expect(event.parseWarnings?.join()).toContain('IIS_DURATION_INVALID');
  });
});
describe('timestamp correctness',()=>{
  it.each(['2026-02-30T00:00:00Z','2025-02-29T00:00:00Z','2026-13-01T00:00:00Z','2026-11-06T24:00:00Z','2026-11-06T00:00:00+25:00'])('does not normalize invalid calendar/offset %s',timestamp=>{
    const event=parse(JSON.stringify({timestamp,message:'bad date'})).events[0];expect(event.timestamp).toBeNull();expect(event.rawTimestamp).toBe(timestamp);expect(event.parseWarnings?.join()).toContain('TIMESTAMP_INVALID');
  });
  it('handles leap dates, fractional seconds, offset formats without host timezone',()=>{
    const event=parse('{"timestamp":"2024-02-29T23:59:59.1234567+0900","message":"ok"}').events[0];expect(event.timestamp).toBe(Date.parse('2024-02-29T14:59:59.123Z'));expect(event.rawTimestamp).toContain('1234567');
  });
});
