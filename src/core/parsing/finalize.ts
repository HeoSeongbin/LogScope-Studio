import type { LogEvent, ParseOptions } from '../../types/log';
import { applyFileContext } from '../file-context';
import { extractTextIdentifiers } from '../correlation/identifiers';
import { parserNames } from '../parser-catalog';
export function finalizeEvent(event:LogEvent,options:ParseOptions,fallback=false):LogEvent{
  if(fallback&&event.parserId==='generic'&&!event.exception&&!event.parseErrors?.length){const reason='FORMAT_UNRECOGNIZED: 인식된 형식과 일치하지 않는 행을 원문으로 보존했습니다.';event={...event,parseErrors:[reason],parseWarnings:[reason]};}
  const result=applyFileContext(extractTextIdentifiers(event),options);
  result.parseErrors=result.parseErrors?.length?result.parseErrors:undefined;result.parseWarnings=result.parseWarnings?.length?result.parseWarnings:undefined;
  return result;
}
export function resultParser(events:LogEvent[],options:ParseOptions,hints:{iis?:boolean;array?:boolean}={}){
  if(options.parser&&options.parser!=='auto')return parserNames[options.parser];
  const ids=[...new Set(events.filter(event=>event.parserId!=='generic').map(event=>event.parserId))];
  return ids.length>1?`혼합 (${ids.join(', ')})`:ids.length===1?parserNames[ids[0]]??ids[0]:!events.length&&hints.iis?'IIS W3C':!events.length&&hints.array?'JSON / Serilog JSON':'Generic Text';
}

export { parserNames } from '../parser-catalog';
