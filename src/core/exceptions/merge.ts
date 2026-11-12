import type { LogEvent, LogInput } from '../../types/log';
import { applyTimestamp, normalizeLevel, sourceLines, timestampPattern } from '../parsing/common';
import { analyzeStack, enrichException, exceptionHeader, isStackLine } from './stack';

const textParsers=new Set(['spring','java-pattern','dotnet','serilog']);
const simpleContext=new RegExp(`^(${timestampPattern})\\s+(ERROR|FATAL|WARN)\\s+(.*)$`);
function eligible(event:LogEvent){return event.parserId==='generic'&&!event.parseErrors?.some(error=>/^(IIS_|JSON_)/.test(error));}
function withoutFallbackDiagnostics(event:LogEvent):LogEvent {
  const keep=(diagnostic:string)=>!/^FORMAT_UNRECOGNIZED:|^[A-Z]+_PATTERN:/.test(diagnostic);
  return {...event,parseErrors:event.parseErrors?.filter(keep),parseWarnings:event.parseWarnings?.filter(keep)};
}
export function normalizeExceptions(input:LogInput,events:LogEvent[],mergeText:boolean,auto=false):LogEvent[]{
  const lines=sourceLines(input.text);const result:LogEvent[]=[];
  for(let i=0;i<events.length;i++){
    const original=events[i];
    if(original.exception){
      const analysis=enrichException(original.exception);result.push({...original,exception:analysis.exception??original.exception,parseWarnings:[...original.parseWarnings??[],...analysis.warnings]});
      continue;
    }
    if(['json','serilog-json'].includes(original.parserId)&&exceptionHeader(original.message.split(/\r\n|\n|\r/,1)[0])){
      const analysis=analyzeStack(original.message);result.push({...original,exception:analysis.exception,parseWarnings:[...original.parseWarnings??[],...analysis.warnings]});continue;
    }
    const context=auto&&eligible(original)?original.rawText.match(simpleContext):null;
    const recognized=textParsers.has(original.parserId)||!!context;
    const ownStack=eligible(original)?isStackLine(original.rawText):recognized&&!!exceptionHeader(original.message);
    const next=events[i+1];
    const nextStack=recognized&&['ERROR','FATAL','WARN'].includes(context?.[2]??original.level)&&next&&eligible(next)&&next.lineStart===original.lineEnd+1&&isStackLine(next.rawText);
    if(!mergeText||(!ownStack&&!nextStack)){result.push(original);continue;}
    const event=withoutFallbackDiagnostics(original);
    if(context){event.message=context[3];event.level=normalizeLevel(context[2]);applyTimestamp(event,context[1]);}
    else if(original.parserId==='generic')event.level='UNKNOWN';
    const traceStart=ownStack?i:i+1;
    let end=traceStart;
    let lastLine=events[traceStart].lineEnd;
    while(end+1<events.length){
      const following=events[end+1];
      if(!eligible(following)||following.lineStart!==lastLine+1||!isStackLine(following.rawText))break;
      const header=exceptionHeader(following.rawText);
      if(header&&!header.relation)break;
      end++;lastLine=following.lineEnd;
    }
    const startOffset=lines[original.lineStart-1]?.start;const endOffset=lines[events[end].lineEnd-1]?.end;
    if(startOffset===undefined||endOffset===undefined){result.push(original);continue;}
    const traceOffset=lines[events[traceStart].lineStart-1].start;
    const stack=ownStack&&recognized?original.message+input.text.slice(lines[original.lineEnd-1].end,endOffset):input.text.slice(traceOffset,endOffset);
    const analysis=analyzeStack(stack);
    if(!analysis.exception){result.push(original);continue;}
    event.exception=analysis.exception;event.rawText=input.text.slice(startOffset,endOffset);event.lineEnd=events[end].lineEnd;
    if(!event.message)event.message=events[traceStart].rawText.trim();
    event.parseWarnings=[...event.parseWarnings??[],...analysis.warnings];
    result.push(event);i=end;
  }
  return result;
}
