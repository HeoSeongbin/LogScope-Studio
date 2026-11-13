// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { parseBlob } from '../core/parsing/parse-blob';
import { MAX_LINE_CHARS, MAX_RECORD_CHARS } from '../core/parsing/policy';
import type { ParseOptions } from '../types/log';
const fixtures=readdirSync('public/samples');
describe('chunk-invariant parsing',()=>{
  it.each(fixtures)('matches synchronous oracle for %s at adversarial byte boundaries',async name=>{
    const text=readFileSync(`public/samples/${name}`,'utf8');const input={text,fileId:'source',fileName:name};const oracle=parseLog(input);
    for(const chunkBytes of [1,2,3,7,31,65536]){const parsed=await parseBlob({source:new Blob([text]),fileId:'source',fileName:name,options:{},chunkBytes});expect(parsed.events).toEqual(oracle.events);expect(parsed.parser).toBe(oracle.parser);expect(parsed.directives).toBe(oracle.directives);expect(parsed.sourceText).toBe(text);}
  });
  it('preserves JSON document offsets, multiple same-line records and CRLF/CR source ranges',async()=>{
    const samples=[' [ {"message":"한글 😀 \\" quoted"}, {"message":"second"},42,null,[] ]\r\n','{\r\n "message":"한글",\r\n "level":"ERROR"\r\n}','#Software: demo\r#Fields: date time sc-status\r2026-11-06 00:00:00 500\r','hello\r\n\rworld\nlast'];
    samples.push(JSON.stringify([{message:'한글 😀 "quoted"',nested:{values:[1,true,null]}},{message:'second'},42,null,[]]));
    for(const text of samples){const oracle=parseLog({text,fileId:'id',fileName:'input'});for(const chunkBytes of [1,3,8]){const actual=await parseBlob({source:new Blob([text]),fileId:'id',fileName:'input',options:{},chunkBytes});expect(actual.events).toEqual(oracle.events);expect(actual.parser).toBe(oracle.parser);}}
  });
  it('retains all manual parser semantics and file timezone/mapping options',async()=>{
    const text=readFileSync('public/samples/distributed-api.log','utf8');
    for(const parser of ['generic','spring','java-pattern','dotnet','serilog','json','iis'] as const){const options:ParseOptions={parser,timezone:'UTC',serviceName:'configured',correlationScope:'test'};const oracle=parseLog({text,fileId:'id',fileName:'file'},options);const result=await parseBlob({source:new Blob([text]),fileId:'id',fileName:'file',options,chunkBytes:3});expect(result.events).toEqual(oracle.events);}
  });
  it('handles UTF-8/BOM UTF-16 LE/BE multibyte splits and final lines without newline',async()=>{
    const text='INFO 한글 😀\r\nERROR 마지막';const utf16=new Uint8Array(2+text.length*2);utf16.set([0xff,0xfe]);for(let i=0;i<text.length;i++){utf16[2+i*2]=text.charCodeAt(i)&255;utf16[3+i*2]=text.charCodeAt(i)>>8;}
    const be=utf16.slice();for(let i=0;i<be.length;i+=2){const a=be[i];be[i]=be[i+1];be[i+1]=a;}
    for(const bytes of [new TextEncoder().encode('\ufeff'+text),utf16,be]){const result=await parseBlob({source:new Blob([bytes]),fileId:'id',fileName:'file',options:{},chunkBytes:1});expect(result.events).toEqual(parseLog({text,fileId:'id',fileName:'file'}).events);expect(result.sourceText).toBe(text);}
  });
  it('recovers invalid JSON documents as complete line input instead of committing speculative array values',async()=>{
    for(const text of ['[{"message":"valid"},BAD]','{"message":"one"}\n{"message":"two"}','[\n{"message":"valid"},\n]','\u00a0{"message":"invalid JSON whitespace"}']){const result=await parseBlob({source:new Blob([text]),fileId:'id',fileName:'file',options:{},chunkBytes:2});expect(result.events).toEqual(parseLog({text,fileId:'id',fileName:'file'}).events);}
  });
  it('rejects damaged decoding, huge lines/records and event/storage limits explicitly',async()=>{
    const request={fileId:'id',fileName:'file',options:{}};
    await expect(parseBlob({...request,source:new Blob([new Uint8Array([0xe3,0x81])]),chunkBytes:1})).rejects.toThrow();
    await expect(parseBlob({...request,source:new Blob(['x'.repeat(MAX_LINE_CHARS+1)])})).rejects.toThrow('PARSE_LIMIT');
    await expect(parseBlob({...request,source:new Blob(['java.lang.Exception: x\n'+(' at Demo.run(Demo.java:1)\n').repeat(Math.ceil(MAX_RECORD_CHARS/20))])})).rejects.toThrow('PARSE_LIMIT');
    await expect(parseBlob({...request,source:'INFO a\nINFO b',limits:{events:1}})).rejects.toThrow('이벤트 수');
    await expect(parseBlob({...request,source:'INFO a',limits:{estimatedBytes:1}})).rejects.toThrow('보관량');
  });
});
