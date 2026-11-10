import type { LogEvent, LogInput, LogParser } from '../../types/log';
import { applyTimestamp, baseEvent, genericEvent, sourceLines, type SourceLine } from './common';

export interface IisContext { fields?: string[] }
export function parseIisLine(input:LogInput,line:SourceLine,context:IisContext):LogEvent|undefined {
  if(line.raw.startsWith('#Fields:')){
    const fields=line.raw.slice(8).trim().split(/\s+/).filter(Boolean);
    if(!fields.length||new Set(fields).size!==fields.length){context.fields=undefined;return genericEvent(input,line,'IIS_FIELDS: 컬럼 선언이 비어 있거나 중복되었습니다.');}
    context.fields=fields;return;
  }
  if(line.raw.startsWith('#'))return;
  if(!context.fields)return genericEvent(input,line,'IIS_FIELDS_MISSING: 앞선 #Fields 선언이 없어 컬럼을 추정하지 않습니다.');
  const values=line.raw.trim().split(/\s+/);
  if(values.length!==context.fields.length)return genericEvent(input,line,`IIS_COLUMNS: 선언 ${context.fields.length}개, 실제 ${values.length}개 컬럼입니다.`);
  const fields=Object.fromEntries(context.fields.map((key,i)=>[key,values[i]]));
  const event={...baseEvent(input,line),parserId:'iis',parsedFields:fields};
  const available=(key:string)=>fields[key]&&fields[key]!=='-'?fields[key]:undefined;
  if(available('date')&&available('time'))applyTimestamp(event,`${fields.date} ${fields.time}`,'Z');
  else (event.parseWarnings??=[]).push('IIS_TIME_MISSING: date/time 컬럼이 없거나 값이 비어 있습니다.');
  // W3C has HTTP status, not an application severity or exception.
  const method=available('cs-method'),path=available('cs-uri-stem'),status=available('sc-status');
  event.message=[method,path,status?`HTTP ${status}`:undefined].filter(Boolean).join(' ')||line.raw;
  if(status&&!/^[1-5]\d{2}$/.test(status))(event.parseWarnings??=[]).push('IIS_STATUS_INVALID: HTTP 상태 코드가 올바르지 않습니다.');
  const duration=available('time-taken');if(duration&&!/^\d+$/.test(duration))(event.parseWarnings??=[]).push('IIS_DURATION_INVALID: time-taken 값은 음이 아닌 정수여야 합니다.');
  return event;
}
export const iisParser:LogParser={id:'iis',name:'IIS W3C',detect:sample=>/^#Fields:/m.test(sample)?1:0,parse(input){
  const context:IisContext={};const events:LogEvent[]=[];
  for(const line of sourceLines(input.text)){const event=parseIisLine(input,line,context);if(event)events.push(event);}
  return events;
}};
