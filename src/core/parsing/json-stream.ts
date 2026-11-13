import type { LogEvent, LogInput, ParseOptions } from '../../types/log';
import { jsonRecord } from './json';
import { MAX_RECORD_CHARS, ParseLimitError } from './policy';

// Validates one complete JSON document, retaining only the current top-level
// value. An invalid document is discarded and re-read with line recovery.
export class JsonDocumentStream {
  private mode:'start'|'array'|'object'|'done'='start';
  private expectation:'valueOrEnd'|'value'|'separator'='valueOrEnd';
  private record='';private depth=0;private quoted=false;private escaped=false;
  private offset=0;private line=1;private cr=false;private start=0;private startLine=1;private lastLine=1;
  invalid=false;isArray=false;
  constructor(private input:LogInput,private options:ParseOptions,private emit:(event:LogEvent)=>void){}
  private finishRecord(){
    const raw=this.record.replace(/[ \t\r\n]+$/,'');let value:unknown;
    try{value=JSON.parse(raw);}catch{this.invalid=true;return;}
    const event=jsonRecord(this.input,{raw,start:this.start,end:this.start+raw.length,number:this.startLine},value,this.options);
    event.id=`${this.input.fileId}:${this.startLine}:${this.start}`;event.lineEnd=this.lastLine;this.emit(event);this.record='';
  }
  write(chunk:string){
    if(this.invalid)return;
    for(const c of chunk){
      const white=/[ \t\r\n]/.test(c);
      if(this.mode==='done'){if(!white){this.invalid=true;return;}}
      else if(this.mode==='start'){
        if(!white){if(c==='['){this.mode='array';this.isArray=true;}else if(c==='{'){this.mode='object';this.record='{';this.depth=1;this.start=this.offset;this.startLine=this.line;this.lastLine=this.line;}else{this.invalid=true;return;}}
      }else{
        let consumed=false;
        if(this.mode==='array'&&!this.record){
          if(white)consumed=true;
          else if(this.expectation==='separator'){
            if(c===',')this.expectation='value';else if(c===']')this.mode='done';else this.invalid=true;consumed=true;
          }else if(c===']'){
            if(this.expectation==='value')this.invalid=true;else this.mode='done';consumed=true;
          }else{this.start=this.offset;this.startLine=this.line;this.lastLine=this.line;this.depth=0;this.quoted=false;this.escaped=false;}
        }
        if(!consumed&&!this.invalid){
          if(this.mode==='array'&&!this.quoted&&this.depth===0&&(c===','||c===']')){
            this.finishRecord();this.expectation=c===','?'value':'separator';if(c===']')this.mode='done';
          }else{
            this.record+=c;if(!white)this.lastLine=this.line;
            if(this.record.length>MAX_RECORD_CHARS)throw new ParseLimitError('JSON 레코드가 2 Mi 문자를 초과했습니다.');
            if(this.quoted){if(this.escaped)this.escaped=false;else if(c==='\\')this.escaped=true;else if(c==='"')this.quoted=false;}
            else if(c==='"')this.quoted=true;
            else if(c==='{'||c==='[')this.depth++;
            else if(c==='}'||c===']')this.depth--;
            if(this.depth<0){this.invalid=true;return;}
            if(this.mode==='object'&&this.depth===0&&!this.quoted){this.finishRecord();this.mode='done';}
          }
        }
      }
      if(this.invalid)return;
      this.offset+=c.length;
      if(c==='\r'){this.line++;this.cr=true;}else if(c==='\n'){if(!this.cr)this.line++;this.cr=false;}else this.cr=false;
    }
  }
  complete(){return !this.invalid&&this.mode==='done';}
}
