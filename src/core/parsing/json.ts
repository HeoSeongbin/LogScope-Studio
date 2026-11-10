import type { LogEvent, LogInput, LogParser, MappingField, ParseOptions } from '../../types/log';
import { applyTimestamp, baseEvent, genericEvent, normalizeLevel, sourceLines, type SourceLine } from './common';

function isObject(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function ownPath(object:Record<string,unknown>,path:string):unknown {
  if(Object.hasOwn(object,path))return object[path];
  let current:unknown=object;
  for(const part of path.split('.')){
    if(!isObject(current)||!Object.hasOwn(current,part))return undefined;
    current=current[part];
  }
  return current;
}
const fields:Record<MappingField,string[]>={
  timestamp:['timestamp','time','@timestamp','Timestamp','Time','@t'],
  level:['level','severity','logLevel','Level','LogLevel','SeverityText','@l'],
  message:['message','msg','renderedMessage','Message','RenderedMessage','@m','MessageTemplate','@mt','State.Message'],
  requestId:['requestId','request_id','RequestId','Properties.RequestId'],
  traceId:['traceId','trace_id','TraceId','@tr','Properties.TraceId'],
};
function first(object:Record<string,unknown>,paths:string[]){for(const path of paths){const value=ownPath(object,path);if(value!==undefined&&value!==null)return value;}}
function stringValue(value:unknown){return typeof value==='string'?value:undefined;}
function firstString(object:Record<string,unknown>,paths:string[]){for(const path of paths){const value=ownPath(object,path);if(typeof value==='string')return value;}}
export function jsonRecord(input:LogInput,line:SourceLine,value:unknown,options:ParseOptions={}):LogEvent {
  if(!isObject(value))return genericEvent(input,line,'JSON_RECORD_TYPE: JSON 이벤트는 객체여야 합니다.');
  const compact=Object.hasOwn(value,'@t')&&(Object.hasOwn(value,'@mt')||Object.hasOwn(value,'@m'));
  const standard=Object.hasOwn(value,'Timestamp')&&(Object.hasOwn(value,'MessageTemplate')||Object.hasOwn(value,'RenderedMessage'));
  const event={...baseEvent(input,line),parserId:compact||standard?'serilog-json':'json',parsedFields:value};
  const warn=(message:string)=>{(event.parseWarnings??=[]).push(message);};
  function mapped(field:MappingField){
    const path=options.fieldMapping?.[field];
    if(path){const result=ownPath(value as Record<string,unknown>,path);if(result===undefined)warn(`MAPPING_MISSING: ${field} → ${path} 필드가 없습니다.`);return result;}
    return first(value as Record<string,unknown>,fields[field]);
  }
  const level=mapped('level');
  // CLEF explicitly defines omitted @l as Information; ordinary JSON has no default.
  event.level=compact&&!Object.hasOwn(value,'@l')&&level===undefined&&!options.fieldMapping?.level?'INFO':normalizeLevel(level);
  if(level!==undefined&&event.level==='UNKNOWN'&&level!=='UNKNOWN')warn('LEVEL_UNKNOWN: 인식할 수 없는 로그 레벨입니다.');
  const message=mapped('message');
  if(typeof message==='string')event.message=message;
  else warn('MESSAGE_MISSING: 문자열 메시지 필드를 찾지 못해 원문을 표시합니다.');
  if(!options.fieldMapping?.message&&value['@m']===undefined&&value.RenderedMessage===undefined&&(value['@mt']!==undefined||value.MessageTemplate!==undefined))warn('MESSAGE_TEMPLATE: 렌더링되지 않은 메시지 템플릿을 그대로 표시합니다.');
  applyTimestamp(event,mapped('timestamp'));
  for(const field of ['requestId','traceId'] as const){const v=mapped(field);if(typeof v==='string')event[field]=v;else if(v!==undefined&&v!==null)warn(`FIELD_TYPE: ${field}는 문자열이어야 합니다.`);}
  event.service=firstString(value,['service','service.name','Service','Properties.Service']);
  event.host=firstString(value,['host','host.name','Host','MachineName','Properties.MachineName']);
  event.logger=stringValue(first(value,['logger','SourceContext','Category','Properties.SourceContext']));
  event.thread=stringValue(first(value,['thread','ThreadName','Properties.ThreadName']));
  event.spanId=stringValue(first(value,['spanId','span_id','SpanId','@sp','Properties.SpanId']));
  event.correlationId=stringValue(first(value,['correlationId','CorrelationId','Properties.CorrelationId']));
  const exception=first(value,['exception','Exception','@x']);
  if(typeof exception==='string')event.exception={stackTrace:exception};
  else if(isObject(exception))event.exception={type:stringValue(first(exception,['type','Type','ClassName'])),message:stringValue(first(exception,['message','Message'])),stackTrace:stringValue(first(exception,['stackTrace','StackTrace','StackTraceString']))};
  return event;
}
export function parseJsonLine(input:LogInput,line:SourceLine,options?:ParseOptions):LogEvent {
  try{return jsonRecord(input,line,JSON.parse(line.raw),options);}
  catch{return genericEvent(input,line,'JSON_SYNTAX: JSON 구문을 해석할 수 없습니다.');}
}
// JSON.parse validates syntax first; this scanner records original array value ranges.
function arrayRanges(text:string):Array<[number,number]> {
  const result:Array<[number,number]>=[];let start=-1;let depth=0;let quoted=false;let escaped=false;
  for(let i=text.indexOf('[')+1;i<text.length;i++){
    const c=text[i];
    if(start<0){if(/\s/.test(c)||c===',')continue;if(c===']')break;start=i;}
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='{'||c==='[')depth++;
    if(c==='}'||c===']'){
      if(c===']'&&depth===0){result.push([start,i]);break;}
      depth--;
    }
    if(c===','&&depth===0){result.push([start,i]);start=-1;}
  }
  return result.map(([start,end])=>{while(end>start&&/\s/.test(text[end-1]))end--;return [start,end];});
}
export function parseJsonDocument(input:LogInput,options?:ParseOptions):LogEvent[]|undefined {
  const trimmed=input.text.trim();if(!trimmed.startsWith('{')&&!trimmed.startsWith('['))return;
  let value:unknown;try{value=JSON.parse(input.text);}catch{return;}
  const lines=sourceLines(input.text);
  function lineAt(offset:number){let low=0,high=lines.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(lines[mid].start<=offset)low=mid;else high=mid-1;}return lines[low]?.number??1;}
  function record(value:unknown,start:number,end:number):LogEvent {
    const line=lineAt(start);const event=jsonRecord(input,{raw:input.text.slice(start,end),start,end,number:line},value,options);
    event.id=`${input.fileId}:${line}:${start}`;event.lineEnd=lineAt(Math.max(start,end-1));return event;
  }
  if(Array.isArray(value))return arrayRanges(input.text).map(([start,end],i)=>record(value[i],start,end));
  if(isObject(value)){
    const start=input.text.indexOf(trimmed);return [record(value,start,start+trimmed.length)];
  }
}
export const jsonParser:LogParser={id:'json',name:'JSON / Serilog JSON',detect:sample=>/^\s*[{[]/.test(sample)? .85:0,parse(input,options){
  const document=parseJsonDocument(input,options);if(document)return document;
  return sourceLines(input.text).map(line=>parseJsonLine(input,line,options));
}};
