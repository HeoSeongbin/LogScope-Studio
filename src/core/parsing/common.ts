import type { LogEvent, LogInput, LogLevel } from '../../types/log';

export interface SourceLine { raw: string; start: number; end: number; number: number }
export function sourceLines(text: string): SourceLine[] {
  const result: SourceLine[]=[];
  const delimiter=/\r\n|\n|\r/g;
  let start=0; let match: RegExpExecArray|null;
  while((match=delimiter.exec(text))){result.push({raw:text.slice(start,match.index),start,end:match.index,number:result.length+1});start=match.index+match[0].length;}
  if(start<text.length) result.push({raw:text.slice(start),start,end:text.length,number:result.length+1});
  return result;
}
export function baseEvent(input: LogInput, line: SourceLine): LogEvent {
  return {id:`${input.fileId}:${line.number}`,sourceFileId:input.fileId,sourceFileName:input.fileName,lineStart:line.number,lineEnd:line.number,timestamp:null,level:'UNKNOWN',message:line.raw,rawText:line.raw,parsedFields:{},parserId:'generic'};
}
const aliases: Record<string,LogLevel>={TRACE:'TRACE',TRC:'TRACE',VERBOSE:'TRACE',VRB:'TRACE',DEBUG:'DEBUG',DBG:'DEBUG',DBUG:'DEBUG',INFO:'INFO',INF:'INFO',INFORMATION:'INFO',WARN:'WARN',WRN:'WARN',WARNING:'WARN',ERROR:'ERROR',ERR:'ERROR',FAIL:'ERROR',FATAL:'FATAL',FTL:'FATAL',CRITICAL:'FATAL',CRIT:'FATAL',UNKNOWN:'UNKNOWN'};
export function normalizeLevel(value: unknown): LogLevel {return typeof value==='string'?aliases[value.toUpperCase()]??'UNKNOWN':'UNKNOWN';}
export function genericEvent(input: LogInput,line: SourceLine,reason?:string): LogEvent {
  const event=baseEvent(input,line);
  event.level=normalizeLevel(line.raw.match(/\b(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/i)?.[1]);
  if(reason){event.parseErrors=[reason];event.parseWarnings=[reason];}
  return event;
}
export const timestampPattern='\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d{1,9})?(?: ?(?:Z|[+-]\\d{2}:?\\d{2}))?';
export function applyTimestamp(event: LogEvent,value: unknown,defaultZone?:'Z') {
  if(value===undefined || value===null) return;
  event.rawTimestamp=typeof value==='string'?value:String(value);
  if(typeof value==='string'&&/^\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(value)){
    (event.parseWarnings??=[]).push('TIMESTAMP_PARTIAL: 날짜와 시간대가 없어 원문 시각만 표시합니다.');return;
  }
  const m=typeof value==='string'?value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?(?: ?(Z|[+-]\d{2}:?\d{2}))?$/):null;
  const warning=(message:string)=>{(event.parseWarnings??=[]).push(message);};
  if(!m){warning('TIMESTAMP_INVALID: 지원하지 않거나 잘못된 시간 형식입니다.');return;}
  const [,year,month,day,hour,minute,second,fraction,zone]=m;
  const y=Number(year),mo=Number(month),d=Number(day),h=Number(hour),mi=Number(minute),s=Number(second);
  const leap=y%4===0&&(y%100!==0||y%400===0);const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(mo<1||mo>12||d<1||d>days[mo-1]||h>23||mi>59||s>59){warning('TIMESTAMP_INVALID: 달력 또는 시간 범위를 벗어났습니다.');return;}
  const effectiveZone=zone??defaultZone;
  if(!effectiveZone){warning('시간대 미지정: 원문 시각만 표시합니다.');return;}
  if(effectiveZone!=='Z'){
    const offset=effectiveZone.replace(':','');
    if(Number(offset.slice(1,3))>23||Number(offset.slice(3))>59){warning('TIMESTAMP_INVALID: 잘못된 시간대 오프셋입니다.');return;}
  }
  const normalizedZone=effectiveZone==='Z'?'Z':effectiveZone.replace(/^([+-]\d{2})(\d{2})$/,'$1:$2');
  const ms=(fraction??'').padEnd(3,'0').slice(0,3);
  const valueMs=Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${normalizedZone}`);
  if(Number.isFinite(valueMs)){event.timestamp=valueMs;event.timezone=normalizedZone;}
  else warning('TIMESTAMP_INVALID: 정규화할 수 없는 시간입니다.');
}
