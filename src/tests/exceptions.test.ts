import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { analyzeStack, exceptionHeader, MAX_EXCEPTION_DEPTH, stackFrame } from '../core/exceptions/stack';
import { exceptionFingerprint, groupExceptions } from '../core/exceptions/groups';
import { searchLiteral } from '../core/search';
import { defaultSearch } from '../types/search';
import type { LogInput, ParseOptions } from '../types/log';

const input=(text:string,fileId='one'):LogInput=>({text,fileId,fileName:`${fileId}.log`});
const sample=(name:string)=>readFileSync(`public/samples/${name}`,'utf8');
const parse=(text:string,options?:ParseOptions)=>parseLog(input(text),options).events;
describe('stack structure and event boundaries',()=>{
  it('groups actual Java sample with root frames, suppressed exception and cause chain',()=>{
    const text=sample('spring-exception.log');const events=parse(text);expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({lineStart:1,lineEnd:9,parserId:'spring',level:'ERROR',exception:{type:'java.sql.SQLException',message:'Connection timed out'}});
    expect(events[0].exception?.frames).toHaveLength(2);expect(events[0].exception?.frames?.[0]).toMatchObject({className:'demo.UserRepository',methodName:'find',fileName:'UserRepository.java',lineNumber:42});
    expect(events[0].exception?.suppressed?.[0]).toMatchObject({type:'java.io.IOException',frames:[{methodName:'close'}]});
    expect(events[0].exception?.causeChain?.[0]).toMatchObject({type:'java.net.SocketTimeoutException',elidedFrames:2});expect(events[2].exception).toBeUndefined();expect(events[0].rawText).toBe(text.split('\n').slice(0,9).join('\n'));expect(events[0].parseErrors??[]).toEqual([]);
  });
  it('groups actual .NET inline/multiline inner exceptions and assigns frames after the closing marker to the parent',()=>{
    const events=parse(sample('dotnet-exception.log'));expect(events).toHaveLength(3);
    const exception=events[0].exception!;expect(exception.type).toBe('System.InvalidOperationException');expect(exception.message).toBe('Request rejected');expect(exception.frames).toHaveLength(2);
    expect(exception.frames?.[0]).toMatchObject({className:'Demo.UserService',methodName:'GetUser',fileName:'C:\\demo\\UserService.cs',lineNumber:55});expect(exception.causeChain?.[0]).toMatchObject({type:'System.ArgumentException',message:'Invalid demo argument',frames:[{className:'Demo.Validation',methodName:'Validate',lineNumber:12}]});expect(events[1].lineEnd).toBe(13);expect(events[2].exception).toBeUndefined();
  });
  it('preserves CRLF, tabs, last line without newline, source positions and IDs',()=>{
    const text='2026-11-06 14:30:02 ERROR Database error\r\njava.sql.SQLException: timed out\r\n\tat Demo.run(Demo.java:42)';const events=parse(text);expect(events).toHaveLength(1);expect(events[0]).toMatchObject({id:'one:1',lineStart:1,lineEnd:3,rawText:text,level:'ERROR',timestamp:null,rawTimestamp:'2026-11-06 14:30:02',message:'Database error'});expect(events[0].exception?.stackTrace).toBe(text.slice(text.indexOf('java.sql')));
  });
  it('keeps normal messages, blank lines and new root exception declarations as separate boundaries',()=>{
    const text=sample('incomplete-exception.log');const events=parse(text);expect(events).toHaveLength(6);expect(events[0].exception?.incomplete).toBe(true);expect(events[1].message).toContain('unrelated');expect(events[1].exception).toBeUndefined();expect(events[2].exception).toMatchObject({incomplete:true,frames:[{methodName:'run'}]});expect(events[2].exception?.type).toBeUndefined();expect(events[3].exception?.type).toBe('java.lang.IllegalArgumentException');expect(events[4].rawText).toBe('');expect(events[5].exception?.type).toBe('java.io.IOException');
  });
  it('does not attach a standalone exception to a preceding successful INFO event',()=>{
    const events=parse('2026-11-06 14:30:01 INFO 1 --- [main] demo.App : Request done\njava.lang.Exception: unrelated\n    at Demo.run(Demo.java:1)');expect(events).toHaveLength(2);expect(events[0].exception).toBeUndefined();expect(events[1].timestamp).toBeNull();expect(events[1].logger).toBeUndefined();expect(events[1].level).toBe('UNKNOWN');
  });
  it('does not merge independent timestamped log events even if their messages look like exception declarations',()=>{
    const text='2026-11-06 14:30:01 ERROR 1 --- [main] demo.App : java.lang.Exception: first\n2026-11-06 14:30:02 ERROR 1 --- [main] demo.App : java.lang.Exception: second';expect(parse(text)).toHaveLength(2);
  });
  it('respects manual Generic, JSON, IIS and strict format selection',()=>{
    const text='java.lang.Exception: demo\n    at Demo.run(Demo.java:1)';expect(parse(text,{parser:'generic'})).toHaveLength(2);expect(parse(text,{parser:'json'}).every(event=>!event.exception)).toBe(true);expect(parse(text,{parser:'iis'}).every(event=>!event.exception)).toBe(true);
    const genericHeader='2026-11-06 14:30:02 ERROR failed\njava.lang.Exception: demo\n    at Demo.run(Demo.java:1)';expect(parse(genericHeader,{parser:'spring'})).toHaveLength(2);expect(parse(genericHeader,{parser:'spring'})[0].parseErrors).toBeDefined();
  });
  it('does not invent missing source data when a file starts with stack frames or causes',()=>{
    const frames=parse('    at Demo.run()\n    at Demo.start()');expect(frames).toHaveLength(1);expect(frames[0].exception?.frames).toHaveLength(2);expect(frames[0].exception?.type).toBeUndefined();expect(frames[0].timestamp).toBeNull();expect(frames[0].level).toBe('UNKNOWN');expect(frames[0].parseWarnings?.join()).toContain('STACK_FRAGMENT');
  });
  it('understands Java module/native/unknown frames, Throwable declarations and HRESULT headers',()=>{
    expect(stackFrame('\tat java.base@17/java.lang.Thread.run(Thread.java:840)')).toMatchObject({module:'java.base@17',className:'java.lang.Thread',methodName:'run',lineNumber:840});expect(stackFrame(' at demo.Native.call(Native Method)')?.fileName).toBeUndefined();expect(stackFrame(' at demo.Native.call(Unknown Source)')).toBeDefined();expect(exceptionHeader('Exception in thread "main" java.lang.AssertionError: failed')?.type).toBe('java.lang.AssertionError');expect(exceptionHeader('System.Exception (0x80131500): failed')?.message).toBe('failed');expect(exceptionHeader('UserService: ordinary text')).toBeUndefined();
  });
  it('keeps nested Java suppressed/cause relationships separate from the root cause',()=>{
    const analysis=analyzeStack('java.lang.Exception: root\n at Demo.run(Demo.java:1)\n    Suppressed: java.io.IOException: close\n        at Demo.close(Demo.java:2)\n    Caused by: java.lang.IllegalStateException: suppressed cause\n        at Demo.fail(Demo.java:3)\nCaused by: java.lang.RuntimeException: root cause\n at Demo.work(Demo.java:4)');
    expect(analysis.exception?.suppressed?.[0].causeChain?.[0].message).toBe('suppressed cause');expect(analysis.exception?.causeChain?.[0].message).toBe('root cause');expect(analysis.exception?.frames).toHaveLength(1);
  });
  it('leaves missing/unknown stack data visible and does not reconstruct elided frames',()=>{
    const analysis=analyzeStack('java.lang.Exception: demo\n at Demo.run(Demo.java:1)\n ... 3 more\nodd fragment');expect(analysis.exception?.frames).toHaveLength(1);expect(analysis.exception?.elidedFrames).toBe(3);expect(analysis.warnings.join()).toContain('STACK_UNRECOGNIZED');expect(analysis.exception?.stackTrace).toContain('odd fragment');
  });
  it('bounds nested exception parsing without assigning overflow frames to the wrong node',()=>{
    const text='java.lang.Exception: root\n'+Array.from({length:MAX_EXCEPTION_DEPTH+5},(_,i)=>`Caused by: java.lang.Exception: cause-${i}`).join('\n')+'\n at Demo.overflow(Demo.java:9)';const analysis=analyzeStack(text);expect(analysis.warnings.join()).toContain('STACK_LIMIT');expect(analysis.exception?.stackTrace).toBe(text);let node=analysis.exception;while(node?.causeChain?.length)node=node.causeChain[0];expect(node?.frames??[]).toEqual([]);
  });
  it('keeps searches working over frames inside merged events',()=>{
    const events=parse(sample('spring-exception.log'));expect(searchLiteral(events,{...defaultSearch,query:'UserRepository.java:42'})).toHaveLength(2);expect(searchLiteral(events,{...defaultSearch,query:'SocketTimeoutException'})).toHaveLength(2);
  });
});
describe('structured exception normalization',()=>{
  it('analyzes an explicit stack header in a JSON message without merging adjacent JSON events',()=>{
    const first=JSON.stringify({message:'java.lang.Exception: demo\n at Demo.run(Demo.java:1)'});const events=parse(first+'\n'+JSON.stringify({message:'next log'}));expect(events).toHaveLength(2);expect(events[0]).toMatchObject({lineStart:1,lineEnd:1,rawText:first,exception:{type:'java.lang.Exception',frames:[{methodName:'run'}]}});expect(events[1].exception).toBeUndefined();
  });
  it('extracts stack type/frames from Java and Serilog exception strings without modifying parsedFields',()=>{
    const value={'@t':'2026-11-06T00:00:00Z','@l':'Error','@m':'failed','@x':'System.InvalidOperationException: failed\n   at Demo.Run() in C:\\demo\\App.cs:line 7'};const events=parse(JSON.stringify(value));expect(events[0].exception).toMatchObject({type:'System.InvalidOperationException',message:'failed',frames:[{methodName:'Run',lineNumber:7}]});expect(events[0].parsedFields).toEqual(value);expect(events[0].lineEnd).toBe(1);
  });
  it('maps explicit InnerException/suppressed fields and prefers explicit type information',()=>{
    const value={message:'failed',exception:{Type:'Demo.CustomFault',Message:'outer',StackTrace:'System.Exception: different\n at Demo.Run()',InnerException:{ClassName:'System.ArgumentException',Message:'inner',StackTrace:' at Demo.Check()'},Suppressed:[{type:'java.io.IOException',message:'close'}]}};const event=parse(JSON.stringify(value))[0];expect(event.exception?.type).toBe('Demo.CustomFault');expect(event.exception?.message).toBe('outer');expect(event.exception?.causeChain?.[0]).toMatchObject({type:'System.ArgumentException',frames:[{methodName:'Check'}]});expect(event.exception?.suppressed?.[0].type).toBe('java.io.IOException');expect(event.parseWarnings?.join()).toContain('EXCEPTION_TYPE_CONFLICT');expect(event.parsedFields).toEqual(value);
  });
  it('keeps structured and textual duplicate cause representations from double-counting nodes',()=>{
    const event=parse(JSON.stringify({message:'failure',exception:{type:'System.Exception',stackTrace:'System.Exception: outer ---> System.ArgumentException: inner\n at Demo.Inner()\n --- End of inner exception stack trace ---\n at Demo.Outer()',InnerException:{type:'System.ArgumentException',message:'inner'}}}))[0];expect(event.exception?.causeChain).toHaveLength(1);
  });
  it('limits structured depth, retains the original object and avoids over-grouping overflow data',()=>{
    const records=['A','B'].map(message=>{let cause:Record<string,unknown>={type:'System.Exception',message};for(let i=0;i<30;i++)cause={type:'System.Exception',InnerException:cause};return {message:'failure',exception:cause};});const events=parse(records.map(record=>JSON.stringify(record)).join('\n'));expect(events[0].parsedFields).toEqual(records[0]);expect(events[0].parseWarnings?.join()).toContain('EXCEPTION_LIMIT');expect(groupExceptions(events)).toHaveLength(2);
  });
});
describe('conservative fingerprint grouping',()=>{
  it('counts real repeat events once, tracks observed time range and keeps unknown time separate',()=>{
    const events=parse(sample('spring-exception.log'));const groups=groupExceptions([...events,events[0]]);expect(groups).toHaveLength(1);expect(groups[0].events).toHaveLength(2);expect(groups[0].firstSeen).toBe(Date.parse('2026-11-06T05:30:01.123Z'));expect(groups[0].lastSeen).toBe(Date.parse('2026-11-06T05:31:01.123Z'));expect(groups[0].untimedCount).toBe(0);
    const untimed={...events[0],id:'untimed',timestamp:null};expect(groupExceptions([events[0],untimed])[0].untimedCount).toBe(1);
  });
  it('includes actual type/message/frame location/logger/service and does not erase dynamic IDs',()=>{
    const original=parse(sample('spring-exception.log'))[0];const signature=exceptionFingerprint(original);
    for(const change of [{...original,service:'other'},{...original,logger:'other'},{...original,exception:{...original.exception,message:'Connection timed out for 123'}},{...original,exception:{...original.exception,type:'java.lang.Exception'}},{...original,exception:{...original.exception,frames:[{...original.exception!.frames![0],lineNumber:99}]}}])expect(exceptionFingerprint(change)).not.toBe(signature);
  });
  it('groups matching records across files while retaining each occurrence source',()=>{
    const text='java.lang.Exception: demo\n at Demo.run(Demo.java:1)';const a=parseLog(input(text,'a')).events;const b=parseLog(input(text,'b')).events;const group=groupExceptions([...a,...b])[0];expect(group.events).toHaveLength(2);expect(group.files).toEqual(['a.log','b.log']);expect(group.firstSeen).toBeNull();expect(group.untimedCount).toBe(2);
  });
  it('does not treat HTTP 500 or an ordinary ERROR line as an exception group',()=>{
    expect(groupExceptions(parse('#Fields: sc-status\n500\n200'))).toEqual([]);expect(groupExceptions(parse('ERROR Database connection failed'))).toEqual([]);
  });
  it('does not collapse unparsed child exceptions with different source text into one group',()=>{
    const records=['unknown failure A','unknown failure B'].map(stackTrace=>({message:'failed',exception:{type:'System.Exception',message:'outer',InnerException:{stackTrace}}}));const events=parse(records.map(record=>JSON.stringify(record)).join('\n'));expect(groupExceptions(events)).toHaveLength(2);
  });
});
