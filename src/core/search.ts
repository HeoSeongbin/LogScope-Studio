import type { LogEvent } from '../types/log';
import type { MatchRange, SearchOptions, SearchResult, SearchRow } from '../types/search';

export const MAX_PATTERN_LENGTH=256;
export const MAX_TERMS=16;
export const MAX_REGEX_ROW_CHARS=131072;
export const MAX_REGEX_TOTAL_CHARS=16*1024*1024;
export const MAX_HIGHLIGHT_RANGES=20000;
const rowCache=new WeakMap<LogEvent,SearchRow>();
export function searchRow(event:LogEvent):SearchRow {
  const cached=rowCache.get(event);if(cached)return cached;
  const row={id:event.id,message:event.message,fields:[event.rawText,event.message,event.logger,event.thread,event.service,event.requestId,event.traceId,event.correlationId,event.spanId,event.customId,event.sourceFileName].filter((value):value is string=>value!==undefined)};
  rowCache.set(event,row);return row;
}
export function literalTerms(query:string):string[]{
  return Array.from(query.matchAll(/"([^"]+)"|(\S+)/g),match=>match[1]??match[2]);
}
export function validateSearch(options:SearchOptions){
  if(options.query.length>MAX_PATTERN_LENGTH)throw new Error(`검색식은 ${MAX_PATTERN_LENGTH}자까지 입력할 수 있습니다.`);
  if(options.mode==='literal'&&literalTerms(options.query).length>MAX_TERMS)throw new Error(`키워드는 ${MAX_TERMS}개까지 사용할 수 있습니다.`);
}
function escaped(term:string){return term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function literalPatterns(options:SearchOptions){return literalTerms(options.query).map(term=>new RegExp(escaped(term),options.caseSensitive?'gu':'giu'));}
export function mergeRanges(ranges:MatchRange[]):MatchRange[]{
  const sorted=ranges.filter(([start,end])=>end>start).sort((a,b)=>a[0]-b[0]);const result:MatchRange[]=[];
  for(const range of sorted){const previous=result.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else result.push([...range]);}
  return result;
}
function rangesFor(text:string,patterns:RegExp[],limit=100):MatchRange[]{
  const ranges:MatchRange[]=[];
  for(const pattern of patterns){
    pattern.lastIndex=0;let match:RegExpExecArray|null;
    while((match=pattern.exec(text))){
      if(match[0].length)ranges.push([match.index,match.index+match[0].length]);
      else {const point=text.codePointAt(pattern.lastIndex);pattern.lastIndex+=point!==undefined&&point>0xffff?2:1;}
      if(ranges.length>=limit)return mergeRanges(ranges);
    }
  }
  return mergeRanges(ranges);
}
export function literalHighlight(text:string,options:SearchOptions):MatchRange[]{
  if(options.mode!=='literal'||!options.query.trim())return [];
  validateSearch(options);return rangesFor(text,literalPatterns(options));
}
export function searchLiteral(events:LogEvent[],options:SearchOptions):LogEvent[]{
  validateSearch(options);if(!options.query.trim())return events;
  // Compile once per query rather than once per event.
  const patterns=literalPatterns(options);
  return events.filter(event=>{
    const fields=searchRow(event).fields;
    const test=(pattern:RegExp)=>fields.some(field=>{pattern.lastIndex=0;return pattern.test(field);});
    return options.operator==='AND'?patterns.every(test):patterns.some(test);
  });
}
export function validateRegexRows(rows:SearchRow[]){
  let total=0;
  for(const row of rows){const count=row.fields.reduce((sum,field)=>sum+field.length,0);if(count>MAX_REGEX_ROW_CHARS)throw new Error('정규식 검색 대상 이벤트가 128 Ki 문자를 초과했습니다. 파일/기간 필터를 좁히거나 일반 검색을 사용하세요.');total+=count;}
  if(total>MAX_REGEX_TOTAL_CHARS)throw new Error('정규식 검색 대상이 16 Mi 문자를 초과했습니다. 파일/기간 필터를 좁혀 주세요.');
}
// Call only in a terminable worker. Arbitrary patterns never execute on the UI thread.
export function executeRegexSearch(rows:SearchRow[],options:SearchOptions):SearchResult {
  validateSearch(options);validateRegexRows(rows);
  const pattern=new RegExp(options.query,options.caseSensitive?'gu':'giu');
  const ids:string[]=[];const messageRanges:Record<string,MatchRange[]>={};const rawRanges:Record<string,MatchRange[]>={};let remaining=MAX_HIGHLIGHT_RANGES;let highlightLimited=false;
  for(const row of rows){
    const match=row.fields.some(field=>{pattern.lastIndex=0;return pattern.test(field);});
    if(!match)continue;ids.push(row.id);
    for(const [text,target] of [[row.message,messageRanges],[row.fields[0]??'',rawRanges]] as const){
      if(remaining>0){const ranges=rangesFor(text,[pattern],Math.min(100,remaining));if(ranges.length)target[row.id]=ranges;remaining-=ranges.length;}
      else highlightLimited=true;
    }
  }
  return {ids,messageRanges,rawRanges,highlightLimited};
}
