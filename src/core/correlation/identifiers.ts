import type { IdentifierKind, LogEvent } from '../../types/log';

export const identifierNames:Record<IdentifierKind,string>={requestId:'Request ID',traceId:'Trace ID',correlationId:'Correlation ID',spanId:'Span ID',customId:'사용자 지정 ID'};
const aliases:Record<string,IdentifierKind>={requestid:'requestId','request_id':'requestId','request-id':'requestId','x-request-id':'requestId',traceid:'traceId',trace_id:'traceId','trace-id':'traceId',correlationid:'correlationId',correlation_id:'correlationId','correlation-id':'correlationId','x-correlation-id':'correlationId',spanid:'spanId',span_id:'spanId','span-id':'spanId'};
export function extractTextIdentifiers(event:LogEvent):LogEvent {
  if(event.parserId==='iis'){
    const values=new Map<IdentifierKind,Set<string>>();
    for(const [key,value] of Object.entries(event.parsedFields)){const normalized=key.replace(/^cs\((.*)\)$/i,'$1').toLowerCase();const kind=aliases[normalized];if(!kind||typeof value!=='string'||value===''||value==='-')continue;const candidates=values.get(kind)??new Set<string>();candidates.add(value);values.set(kind,candidates);}
    return assignIdentifiers(event,values);
  }
  if(['json','serilog-json'].includes(event.parserId)||event.parseErrors?.some(error=>/^(JSON_|IIS_)/.test(error)))return event;
  // Read only the root log header, never a nested stack/cause or JSON payload.
  const header=event.rawText.split(/\r\n|\n|\r/,1)[0];if(/^\s*[{]/.test(header)||/^\s*\[\s*[{"\d[]/.test(header))return event;
  const pairs=header.matchAll(/(?:^|[\s[{,(])(?:["']?)(requestId|request_id|request-id|x-request-id|traceId|trace_id|trace-id|correlationId|correlation_id|correlation-id|x-correlation-id|spanId|span_id|span-id)(?:["']?)\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([A-Za-z0-9][A-Za-z0-9._:/+@=-]*))/gi);
  const values=new Map<IdentifierKind,Set<string>>();
  for(const match of pairs){const kind=aliases[match[1].toLowerCase()];const value=match[2]??match[3]??match[4];if(!kind||!value)continue;let candidates=values.get(kind);if(!candidates){candidates=new Set();values.set(kind,candidates);}candidates.add(value);}
  return assignIdentifiers(event,values);
}
function assignIdentifiers(event:LogEvent,values:Map<IdentifierKind,Set<string>>){
  const result={...event,parseWarnings:event.parseWarnings?.slice()};
  for(const [kind,candidates] of values){
    if(candidates.size!==1){(result.parseWarnings??=[]).push(`IDENTIFIER_CONFLICT: ${identifierNames[kind]}가 여러 값으로 기록되어 자동 선택하지 않았습니다.`);continue;}
    const value=[...candidates][0];if(value.length>256){(result.parseWarnings??=[]).push(`IDENTIFIER_LIMIT: ${identifierNames[kind]}가 256자를 초과해 자동 추출하지 않았습니다.`);continue;}
    if(event[kind]!==undefined&&event[kind]!==value){(result.parseWarnings??=[]).push(`IDENTIFIER_CONFLICT: 기존 ${identifierNames[kind]}와 텍스트 값이 다릅니다.`);continue;}
    result[kind]=value;
  }
  return result;
}
