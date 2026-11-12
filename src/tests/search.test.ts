import { describe, expect, it } from 'vitest';
import { parseLog } from '../core/parsers';
import { filterEvents, parseTimeBound, sortEvents } from '../core/filter';
import { executeRegexSearch, literalHighlight, literalTerms, MAX_REGEX_ROW_CHARS, MAX_REGEX_TOTAL_CHARS, searchLiteral, searchRow, validateRegexRows } from '../core/search';
import { defaultFilters, defaultSearch } from '../types/search';
import type { ExplorerFilters } from '../types/search';
import { virtualWindow } from '../core/virtual';

const events=parseLog({fileId:'one',fileName:'demo.jsonl',text:[
  {timestamp:'2026-11-06T14:30:00+09:00',level:'ERROR',message:'Database timeout',logger:'demo.Db',thread:'worker-1'},
  {timestamp:'2026-11-06T05:30:00Z',level:'INFO',message:'Request ready',logger:'demo.Api',thread:'worker-2'},
  {timestamp:'2026-11-06T05:31:00Z',level:'WARN',message:'Database retry',logger:'demo.Db',thread:'worker-1'},
  {level:'ERROR',message:'Untimed timeout'},
].map(event=>JSON.stringify(event)).join('\n')}).events;
const filter=(options:Partial<ExplorerFilters>)=>filterEvents(events,[],'',{...defaultFilters,...options});
describe('time/field filtering and stable sorting',()=>{
  it('uses inclusive epoch bounds with equivalent offsets and optional untimed records',()=>{
    expect(filter({from:'2026-11-06T05:30:00Z',to:'2026-11-06T14:30:00+09:00',includeUntimed:false})).toEqual(events.slice(0,2));
    expect(filter({from:'2026-11-06T05:30:00Z',to:'2026-11-06T05:30:00Z'})).toEqual([events[0],events[1],events[3]]);
    expect(filter({includeUntimed:false})).toHaveLength(3);
  });
  it('rejects ambiguous, invalid, and reversed bounds',()=>{
    expect(()=>parseTimeBound('2026-11-06T14:30:00')).toThrow('시간대');expect(()=>parseTimeBound('2026-02-30T00:00:00Z')).toThrow('유효하지');
    expect(()=>filter({from:'2026-11-07T00:00:00Z',to:'2026-11-06T00:00:00Z'})).toThrow('시작 시각');
  });
  it('combines level/file/logger/thread without changing original events',()=>{
    const original=JSON.stringify(events);expect(filterEvents(events,['ERROR'],'one',{...defaultFilters,logger:'DEMO.DB',thread:'worker-1'})).toEqual([events[0]]);
    expect(filterEvents(events,[],'other')).toEqual([]);expect(filter({logger:'missing'})).toEqual([]);expect(JSON.stringify(events)).toBe(original);
  });
  it('sorts equal instants stably and puts untimed records last in either direction',()=>{
    const mixed=[events[3],events[1],events[2],events[0]];expect(sortEvents(mixed,'newest')).toEqual([events[2],events[1],events[0],events[3]]);expect(sortEvents(mixed,'oldest')).toEqual([events[1],events[0],events[2],events[3]]);expect(sortEvents(mixed,'source')).toBe(mixed);expect(mixed[0]).toBe(events[3]);
  });
});
describe('literal search and highlighting',()=>{
  it('supports multi-term AND/OR and quoted phrases',()=>{
    expect(literalTerms('Database "worker one"')).toEqual(['Database','worker one']);
    expect(searchLiteral(events,{...defaultSearch,query:'Database timeout'})).toEqual([events[0]]);
    expect(searchLiteral(events,{...defaultSearch,query:'Database timeout',operator:'OR'})).toEqual([events[0],events[2],events[3]]);
    expect(searchLiteral(events,{...defaultSearch,query:'"Request ready"'})).toEqual([events[1]]);
  });
  it('treats regex metacharacters as literal text and respects case sensitivity',()=>{
    expect(literalHighlight('a+b A+B [x].*',{...defaultSearch,query:'"a+b" "[x].*"'})).toEqual([[0,3],[4,7],[8,13]]);
    expect(searchLiteral(events,{...defaultSearch,query:'database',caseSensitive:true})).toEqual([]);expect(searchLiteral(events,{...defaultSearch,query:'database'})).toHaveLength(2);
  });
  it('preserves exact UTF-16 offsets and merges overlapping highlight spans',()=>{
    expect(literalHighlight('😀 timeout',{...defaultSearch,query:'timeout'})).toEqual([[3,10]]);expect(literalHighlight('foobar',{...defaultSearch,query:'foo foobar'})).toEqual([[0,6]]);expect(literalHighlight('İx',{...defaultSearch,query:'x'})).toEqual([[1,2]]);
  });
  it('limits patterns and keyword counts explicitly',()=>{
    expect(()=>searchLiteral(events,{...defaultSearch,query:'a'.repeat(257)})).toThrow('256');expect(()=>searchLiteral(events,{...defaultSearch,query:Array(17).fill('a').join(' ')})).toThrow('16');expect(searchLiteral(events,{...defaultSearch,query:'  '})).toBe(events);
  });
  it('searches original source and metadata even when message differs',()=>{
    expect(searchLiteral(events,{...defaultSearch,query:'demo.jsonl worker-2'})).toEqual([events[1]]);
    expect(searchLiteral(events,{...defaultSearch,query:'level'})).toHaveLength(4);
  });
});
describe('isolated regex search engine',()=>{
  it('returns matches and message ranges with stateless per-field checks',()=>{
    const result=executeRegexSearch(events.map(searchRow),{...defaultSearch,mode:'regex',query:'timeout|retry'});expect(result.ids).toEqual([events[0].id,events[2].id,events[3].id]);expect(result.messageRanges[events[0].id]).toEqual([[9,16]]);
  });
  it('reports invalid syntax and supports zero-width and Unicode matches without loops',()=>{
    expect(()=>executeRegexSearch(events.map(searchRow),{...defaultSearch,mode:'regex',query:'['})).toThrow();
    const result=executeRegexSearch([{id:'emoji',fields:['😀'],message:'😀'}],{...defaultSearch,mode:'regex',query:'(?=)'});expect(result.ids).toEqual(['emoji']);expect(result.messageRanges.emoji??[]).toEqual([]);
  });
  it('rejects oversized events/corpora rather than truncating search results',()=>{
    expect(()=>validateRegexRows([{id:'one',fields:['x'.repeat(MAX_REGEX_ROW_CHARS+1)],message:''}])).toThrow('128 Ki');
    const rows=Array.from({length:MAX_REGEX_TOTAL_CHARS/MAX_REGEX_ROW_CHARS+1},(_,i)=>({id:String(i),fields:['x'.repeat(MAX_REGEX_ROW_CHARS)],message:''}));expect(()=>validateRegexRows(rows)).toThrow('16 Mi');
  });
});
describe('virtual window',()=>{
  it('mounts a bounded window at top/middle/end of 100k events',()=>{
    for(const top of [0,620000,6200000]){const range=virtualWindow(100000,top);expect(range.end-range.start).toBeLessThanOrEqual(18);expect(range.top+(range.end-range.start)*62+range.bottom).toBe(6200000);}
    expect(virtualWindow(0,500)).toMatchObject({start:0,end:0,top:0,bottom:0});expect(virtualWindow(100000,Infinity).end).toBe(100000);
  });
});
