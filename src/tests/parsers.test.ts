import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { filterEvents } from '../core/filter';
const input=(text:string)=>({text,fileId:'test',fileName:'sample.log'});
describe('Phase 1 parsing',()=>{
  it('parses the actual public Spring sample and filters ERROR',()=>{
    const text=readFileSync('public/samples/spring-normal.log','utf8');
    const {parser,events}=parseLog(input(text));
    expect(parser).toBe('Spring Boot');expect(events).toHaveLength(5);
    const errors=filterEvents(events,['ERROR'],'');expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({lineStart:3,lineEnd:3,level:'ERROR',timestamp:null,thread:'http-nio-8080-exec-1',logger:'c.example.UserService'});
    expect(errors[0].rawText).toBe(text.split('\n')[2]);
  });
  it('keeps unsupported text, blank lines, and original positions',()=>{
    const {events,parser}=parseLog(input('hello\r\n\r\nERROR failed'));
    expect(parser).toBe('Generic Text');expect(events).toHaveLength(3);expect(events[2].lineStart).toBe(3);expect(events[1].rawText).toBe('');
  });
  it('retains unmatched lines and does not claim stack grouping',()=>{
    const text=readFileSync('public/samples/spring-normal.log','utf8').trimEnd()+'\njava.sql.SQLException: timed out\n    at Demo.run(Demo.java:42)';
    const {events}=parseLog(input(text));expect(events).toHaveLength(7);expect(events[5].parserId).toBe('generic');expect(events[5].parseWarnings).toBeDefined();
  });
  it('only normalizes explicit timezone offsets',()=>{
    const text='2026-11-06T14:30:01.123+09:00 INFO 1 --- [main] demo.App : Ready';
    const event=parseLog(input(text)).events[0];expect(event.timestamp).toBe(Date.parse('2026-11-06T05:30:01.123Z'));expect(event.timezone).toBe('+09:00');
  });
  it('preserves literal HTML without interpretation',()=>{expect(parseLog(input('<script>alert(1)</script>')).events[0].message).toBe('<script>alert(1)</script>');});
  it('handles empty files and multiple level/file filters',()=>{
    expect(parseLog(input('')).events).toEqual([]);
    const events=parseLog(input('INFO a\nERROR b\nWARN c')).events;
    expect(filterEvents(events,['ERROR','WARN'],'test')).toHaveLength(2);expect(filterEvents(events,[],'other')).toHaveLength(0);
  });
});
