import type { LogEvent, LogInput, LogParser } from '../../types/log';
import { applyTimestamp, baseEvent, genericEvent, normalizeLevel, sourceLines, timestampPattern, type SourceLine } from './common';

const springLine=new RegExp(`^(${timestampPattern})\\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\s+(\\d+)\\s+---\\s+((?:\\[[^\\]]+\\]\\s+)+)([^\\s]+)\\s*:\\s?(.*)$`);
// Explicitly supported PatternLayout variants; arbitrary user templates are not guessed.
const javaPatterns=[
  new RegExp(`^(${timestampPattern})\\s+\\[([^\\]]+)\\]\\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\s+(?:\\[[^\\]]*[:=][^\\]]*\\]\\s+)?([\\w.$]+)\\s+(?:\\[[^\\]]*[:=][^\\]]*\\]\\s+)?(?:-|:)\\s?(.*)$`),
  new RegExp(`^(${timestampPattern})\\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\s+\\[([^\\]]+)\\]\\s+(?:\\[[^\\]]*[:=][^\\]]*\\]\\s+)?([\\w.$]+)\\s+(?:\\[[^\\]]*[:=][^\\]]*\\]\\s+)?(?:-|:)\\s?(.*)$`),
];
const serilogLine=new RegExp(`^(?:(${timestampPattern})\\s+)?\\[(VRB|DBG|INF|WRN|ERR|FTL)\\]\\s?(.*)$`);
const serilogConsole=/^\[(\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?) (VRB|DBG|INF|WRN|ERR|FTL)\]\s?(.*)$/;
const iloggerLine=/^(?:(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\s+)?(trce|dbug|info|warn|fail|crit):\s+([^\s[]+)\[(\d+)\](?:\s(.*))?$/i;
function rows(input:LogInput,parse:(line:SourceLine)=>LogEvent|undefined,expected:string){
  return sourceLines(input.text).map(line=>parse(line)??genericEvent(input,line,`${expected}_PATTERN: 형식과 일치하지 않아 원문으로 보존했습니다.`));
}
export function parseSpringLine(input:LogInput,line:SourceLine){
  const match=line.raw.match(springLine);if(!match)return;
  const [,time,level,pid,blocks,logger,message]=match;
  const contexts=Array.from(blocks.matchAll(/\[([^\]]+)\]/g),match=>match[1]).filter(block=>!/(?:request[_-]?id|trace[_-]?id|correlation[_-]?id|span[_-]?id)\s*[:=]/i.test(block));
  const event={...baseEvent(input,line),parserId:'spring',level:normalizeLevel(level),thread:contexts.length<=2?contexts.at(-1)?.trim():undefined,logger,message,parsedFields:{pid:Number(pid)}};
  if(contexts.length>2)(event.parseWarnings??=[]).push('THREAD_CONTEXT_AMBIGUOUS: 여러 bracket 문맥의 Thread를 확정할 수 없습니다.');
  applyTimestamp(event,time);return event;
}
export function parseJavaLine(input:LogInput,line:SourceLine){
  for(let i=0;i<javaPatterns.length;i++){
    const match=line.raw.match(javaPatterns[i]);if(!match)continue;
    const [,time,second,third,logger,message]=match;
    const event={...baseEvent(input,line),parserId:'java-pattern',level:normalizeLevel(i===0?third:second),thread:i===0?second:third,logger,message};
    applyTimestamp(event,time);return event;
  }
}
export function parseSerilogLine(input:LogInput,line:SourceLine){
  const match=line.raw.match(serilogLine)??line.raw.match(serilogConsole);if(!match)return;
  const [,time,level,message]=match;const event={...baseEvent(input,line),parserId:'serilog',level:normalizeLevel(level),message};
  applyTimestamp(event,time);return event;
}
export function parseDotnetLine(input:LogInput,line:SourceLine){
  const match=line.raw.match(iloggerLine);if(!match)return;
  const [,time,level,logger,eventId,message]=match;
  const event={...baseEvent(input,line),parserId:'dotnet',level:normalizeLevel(level==='trce'?'TRACE':level),logger,message:message??'',parsedFields:{eventId:Number(eventId)}};
  applyTimestamp(event,time);return event;
}
export function dotnetWithMessage(input:LogInput,lines:SourceLine[],index:number){
  const event=parseDotnetLine(input,lines[index]);if(!event)return;
  // SimpleConsole writes its first message on a line with six spaces. Only that
  // formatter boundary is merged here; stack/cause continuations remain separate.
  const next=lines[index+1];
  if(event.message===''&&next&&dotnetMessageLine(next.raw)){
    event.message=next.raw.slice(6);event.lineEnd=next.number;event.rawText=input.text.slice(lines[index].start,next.end);
    return {event,consumed:2};
  }
  return {event,consumed:1};
}
export function dotnetMessageLine(raw:string){return /^ {6}\S/.test(raw)&&!/^ {6}(?:at\s|Caused by:|--->|[\w.]+(?:Exception|Error)(?::|$))/.test(raw);}
export const genericParser:LogParser={id:'generic',name:'Generic Text',detect:()=>0,parse:input=>sourceLines(input.text).map(line=>genericEvent(input,line))};
export const springParser:LogParser={id:'spring',name:'Spring Boot',detect:sample=>sourceLines(sample).some(line=>springLine.test(line.raw))?.95:0,parse:input=>rows(input,line=>parseSpringLine(input,line),'SPRING')};
export const javaParser:LogParser={id:'java-pattern',name:'Logback / Log4j2',detect:sample=>sourceLines(sample).some(line=>javaPatterns.some(pattern=>pattern.test(line.raw)))?.9:0,parse:input=>rows(input,line=>parseJavaLine(input,line),'JAVA')};
export const serilogParser:LogParser={id:'serilog',name:'Serilog Text',detect:sample=>sourceLines(sample).some(line=>serilogLine.test(line.raw)||serilogConsole.test(line.raw))?.9:0,parse:input=>rows(input,line=>parseSerilogLine(input,line),'SERILOG')};
export const dotnetParser:LogParser={id:'dotnet',name:'.NET ILogger',detect:sample=>sourceLines(sample).some(line=>iloggerLine.test(line.raw))?.9:0,parse(input){
  const result:LogEvent[]=[];const lines=sourceLines(input.text);
  for(let i=0;i<lines.length;){const parsed=dotnetWithMessage(input,lines,i);result.push(parsed?.event??genericEvent(input,lines[i],'DOTNET_PATTERN: ILogger 헤더와 일치하지 않습니다.'));i+=parsed?.consumed??1;}
  return result;
}};
