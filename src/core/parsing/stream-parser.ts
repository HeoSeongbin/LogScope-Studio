import type { LogEvent, LogInput, ParseOptions } from '../../types/log';
import { genericEvent } from './common';
import { parseDotnetLine, dotnetMessageLine, parseJavaLine, parseSerilogLine, parseSpringLine } from './text';
import { parseJsonLine } from './json';
import { parseIisLine, type IisContext } from './iis';
import { normalizeExceptions } from '../exceptions/merge';
import { exceptionHeader, isStackLine } from '../exceptions/stack';
import { MAX_RECORD_CHARS, ParseLimitError } from './policy';
import type { StreamLine } from './stream-reader';

interface RecordLine {event:LogEvent;full:string}
export class StreamTextParser {
  private iis:IisContext={};private pending:RecordLine[]=[];private pendingChars=0;private pendingHeader=false;
  private dotnet?:{event:LogEvent;line:StreamLine};
  sawStructured=false;
  constructor(private input:LogInput,private options:ParseOptions,private hasIis:boolean,private emit:(event:LogEvent)=>void){}
  private flush(){
    if(!this.pending.length)return;
    const offset=this.pending[0].event.lineStart-1;const text=this.pending.map(record=>record.full).join('');
    const base=this.pending.map(({event})=>({...event,lineStart:event.lineStart-offset,lineEnd:event.lineEnd-offset}));
    const choice=this.options.parser??'auto';
    for(const event of normalizeExceptions({...this.input,text},base,!['generic','json','iis'].includes(choice),choice==='auto')){
      event.lineStart+=offset;event.lineEnd+=offset;this.emit(event);
    }
    this.pending=[];this.pendingChars=0;this.pendingHeader=false;
  }
  private accept(event:LogEvent,full:string){
    if(event.parserId!=='generic')this.sawStructured=true;
    if(this.options.parser==='generic'){this.emit(event);return;}
    const header=exceptionHeader(event.rawText);const continuation=event.parserId==='generic'&&isStackLine(event.rawText)&&!event.parseErrors?.some(error=>/^(IIS_|JSON_)/.test(error));
    if(!continuation||(header&&!header.relation&&this.pendingHeader))this.flush();
    if(this.pendingChars+full.length>MAX_RECORD_CHARS)throw new ParseLimitError('여러 줄 이벤트가 2 Mi 문자를 초과했습니다.');
    this.pending.push({event,full});this.pendingChars+=full.length;
    this.pendingHeader ||= !!header||!!exceptionHeader(event.message);
    if(['json','serilog-json','iis'].includes(event.parserId))this.flush();
  }
  write(line:StreamLine){
    if(this.dotnet){
      const waiting=this.dotnet;this.dotnet=undefined;
      if(dotnetMessageLine(line.raw)){
        waiting.event.message=line.raw.slice(6);waiting.event.lineEnd=line.number;waiting.event.rawText+=waiting.line.separator+line.raw;
        this.accept(waiting.event,waiting.event.rawText+line.separator);return;
      }
      this.accept(waiting.event,waiting.line.raw+waiting.line.separator);
    }
    const choice=this.options.parser??'auto';
    if(choice==='iis'||(choice==='auto'&&(this.hasIis||line.raw.startsWith('#Fields:')))){
      if(line.raw.startsWith('#')){this.flush();const event=parseIisLine(this.input,line,this.iis);if(event)this.accept(event,line.raw+line.separator);return;}
    }
    let event:LogEvent|undefined;
    if(choice==='generic')event=genericEvent(this.input,line);
    else if(choice==='json')event=parseJsonLine(this.input,line,this.options);
    else if(choice==='iis')event=parseIisLine(this.input,line,this.iis);
    else if(choice==='auto'){
      event=parseSpringLine(this.input,line)??parseJavaLine(this.input,line)??parseDotnetLine(this.input,line)??parseSerilogLine(this.input,line);
      if(!event){if(/^\s*[{[]/.test(line.raw))event=parseJsonLine(this.input,line,this.options);else if(this.hasIis)event=parseIisLine(this.input,line,this.iis);else event=genericEvent(this.input,line);}
    }else{
      event=choice==='spring'?parseSpringLine(this.input,line):choice==='java-pattern'?parseJavaLine(this.input,line):choice==='dotnet'?parseDotnetLine(this.input,line):parseSerilogLine(this.input,line);
      if(!event)event=genericEvent(this.input,line,`${choice==='java-pattern'?'JAVA':choice==='dotnet'?'DOTNET':choice.toUpperCase()}_PATTERN: ${choice==='dotnet'?'ILogger 헤더와 일치하지 않습니다.':'형식과 일치하지 않아 원문으로 보존했습니다.'}`);
    }
    if(!event)return;
    if(event.parserId==='dotnet'&&event.message===''){this.dotnet={event,line};return;}
    this.accept(event,line.raw+line.separator);
  }
  finish(){if(this.dotnet){const {event,line}=this.dotnet;this.dotnet=undefined;this.accept(event,line.raw+line.separator);}this.flush();}
}
