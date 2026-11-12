import type { LogEvent, LogInput, ParseOptions } from '../types/log';
import { genericEvent, sourceLines } from './parsing/common';
import { dotnetParser, dotnetWithMessage, genericParser, javaParser, parseJavaLine, parseSerilogLine, parseSpringLine, serilogParser, springParser } from './parsing/text';
import { jsonParser, parseJsonDocument, parseJsonLine } from './parsing/json';
import { iisParser, parseIisLine, type IisContext } from './parsing/iis';
import { normalizeExceptions } from './exceptions/merge';
export { genericParser, springParser } from './parsing/text';
export const parsers=[springParser,javaParser,dotnetParser,serilogParser,jsonParser,iisParser,genericParser];
export const parserChoices=[{id:'auto',name:'자동 감지 (혼합 형식)'},...parsers.map(parser=>({id:parser.id,name:parser.name}))];
export function parseLog(input:LogInput,options:ParseOptions={}) {
  const choice=options.parser??'auto';
  let events:LogEvent[];
  if(choice!=='auto'){
    const parser=parsers.find(parser=>parser.id===choice);
    if(!parser)throw new Error(`지원하지 않는 파서: ${choice}`);
    events=parser.parse(input,options);
  }else{
    const document=parseJsonDocument(input,options);
    if(document)events=document;
    else{
      events=[];const lines=sourceLines(input.text);const iis:IisContext={};const hasIisFields=lines.some(line=>line.raw.startsWith('#Fields:'));
      for(let i=0;i<lines.length;i++){
        const line=lines[i];
        if(line.raw.startsWith('#Fields:')){const event=parseIisLine(input,line,iis);if(event)events.push(event);continue;}
        if(hasIisFields&&line.raw.startsWith('#'))continue;
        const dotnet=dotnetWithMessage(input,lines,i);
        const event=parseSpringLine(input,line)??parseJavaLine(input,line)??dotnet?.event??parseSerilogLine(input,line);
        if(event){events.push(event);if(event===dotnet?.event)i+=(dotnet?.consumed??1)-1;continue;}
        if(/^\s*[{[]/.test(line.raw)){events.push(parseJsonLine(input,line,options));continue;}
        if(hasIisFields){const record=parseIisLine(input,line,iis);if(record)events.push(record);continue;}
        events.push(genericEvent(input,line));
      }
      if(events.some(event=>event.parserId!=='generic')){
        for(const event of events)if(event.parserId==='generic'&&!event.parseErrors){const reason='FORMAT_UNRECOGNIZED: 인식된 형식과 일치하지 않는 행을 원문으로 보존했습니다.';event.parseWarnings=[reason];event.parseErrors=[reason];}
      }
    }
  }
  events=normalizeExceptions(input,events,!['generic','json','iis'].includes(choice),choice==='auto');
  const ids=[...new Set(events.filter(event=>event.parserId!=='generic').map(event=>event.parserId))];
  let parser=ids.length>1?`혼합 (${ids.join(', ')})`:ids.length===1?(ids[0]==='serilog-json'?'Serilog JSON':parsers.find(parser=>parser.id===ids[0])?.name??ids[0]):'Generic Text';
  if(choice!=='auto')parser=parsers.find(parser=>parser.id===choice)!.name;
  else if(!events.length&&/^#Fields:/m.test(input.text))parser='IIS W3C';
  else if(!events.length&&input.text.trim().startsWith('['))parser='JSON / Serilog JSON';
  return {parser,events,directives:(choice==='iis'||(choice==='auto'&&/^#Fields:/m.test(input.text)))?sourceLines(input.text).filter(line=>line.raw.startsWith('#')).length:0};
}
