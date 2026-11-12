import { create } from 'zustand';
import { parseLog } from '../core/parsers';
import type { LogEvent, LogLevel, SourceFile, ParseOptions } from '../types/log';
import { defaultFilters, defaultSearch, type ExplorerFilters, type SearchOptions } from '../types/search';
export const MAX_FILE_BYTES=2*1024*1024;
export const MAX_SESSION_BYTES=8*1024*1024;
interface Workspace {
  search: SearchOptions; filters: ExplorerFilters; sessionVersion:number;
  setExplorer:(search:SearchOptions,filters:ExplorerFilters)=>void;
  setFileColor:(id:string,color:string)=>void;
  sources: Record<string,string>;
  files: SourceFile[]; events: LogEvent[]; selectedId: string | null; selectedLevels: LogLevel[]; fileId: string;
  upload: (files: File[],options?:ParseOptions)=>Promise<void>; reparse:(id:string,options:ParseOptions)=>void; remove:(id:string)=>void; reset:()=>void;
  select:(id:string)=>void; toggleLevel:(level:LogLevel)=>void; setFile:(id:string)=>void;
}
export const useWorkspace=create<Workspace>((set,get)=>({
  search:{...defaultSearch},filters:{...defaultFilters},sessionVersion:0,
  setExplorer:(search,filters)=>set({search,filters}),
  setFileColor:(id,color)=>{if(/^#[0-9a-f]{6}$/i.test(color))set(state=>({files:state.files.map(file=>file.id===id?{...file,color}:file)}));},
  sources:{},files:[],events:[],selectedId:null,selectedLevels:[],fileId:'',
  select:selectedId=>set({selectedId}),setFile:fileId=>set({fileId}),
  toggleLevel:level=>set(state=>({selectedLevels:state.selectedLevels.includes(level)?state.selectedLevels.filter(item=>item!==level):[...state.selectedLevels,level]})),
  reset:()=>set(state=>({sources:{},files:[],events:[],selectedId:null,selectedLevels:[],fileId:'',search:{...defaultSearch},filters:{...defaultFilters},sessionVersion:state.sessionVersion+1})),
  remove:id=>set(state=>({sources:Object.fromEntries(Object.entries(state.sources).filter(([key])=>key!==id)),files:state.files.filter(file=>file.id!==id),events:state.events.filter(event=>event.sourceFileId!==id),selectedId:state.events.find(event=>event.id===state.selectedId)?.sourceFileId===id?null:state.selectedId,fileId:state.fileId===id?'':state.fileId})),
  reparse(id,options){
    const state=get();const file=state.files.find(file=>file.id===id);
    const text=state.sources[id];if(!file||file.status!=='done'||text===undefined)return;
    const start=performance.now();
    const effective:ParseOptions={parser:file.parserChoice??'auto',fieldMapping:file.fieldMapping,timezone:file.timezone,serviceName:file.serviceName,correlationScope:file.correlationScope,...options};
    const parsed=parseLog({text,fileId:id,fileName:file.name},effective);
    // Replace in source file order; never append duplicates or mutate the original.
    const byFile=new Map(state.files.map(file=>[file.id,file.id===id?parsed.events:state.events.filter(event=>event.sourceFileId===file.id)]));
    set({events:state.files.flatMap(file=>byFile.get(file.id)??[]),selectedId:state.events.find(event=>event.id===state.selectedId)?.sourceFileId===id?null:state.selectedId,files:state.files.map(item=>item.id===id?{...item,parser:parsed.parser,parserChoice:effective.parser??'auto',fieldMapping:effective.fieldMapping,timezone:effective.timezone,serviceName:effective.serviceName,correlationScope:effective.correlationScope,count:parsed.events.length,warnings:parsed.events.filter(event=>event.parseWarnings?.length).length,failures:parsed.events.filter(event=>event.parseErrors?.length).length,directives:parsed.directives,duration:performance.now()-start}:item)});
  },
  async upload(files,options={}){
    for(const file of files){
      const id=crypto.randomUUID(); const start=performance.now();
      const total=get().files.filter(item=>item.status!=='error').reduce((sum,item)=>sum+item.size,0);
      const error=file.size>MAX_FILE_BYTES?'현재 파일 제한은 2 MiB입니다.':total+file.size>MAX_SESSION_BYTES?'세션 제한 8 MiB를 초과했습니다.':/\.(evtx|etl|zip|gz)$/i.test(file.name)?'바이너리·압축 형식은 현재 지원하지 않습니다.':undefined;
      set(state=>({files:[...state.files,{id,name:file.name,size:file.size,status:error?'error':'reading',parserChoice:options.parser??'auto',fieldMapping:options.fieldMapping,timezone:options.timezone,serviceName:options.serviceName,correlationScope:options.correlationScope,color:['#83d2af','#7cbbef','#baa1e9','#e5c277'][get().files.length%4],count:0,warnings:0,failures:0,error}]}));
      if(error) continue;
      try{
        const bytes=await file.arrayBuffer();
        const header=new Uint8Array(bytes,0,Math.min(2,bytes.byteLength));
        const encoding=header[0]===255&&header[1]===254?'utf-16le':header[0]===254&&header[1]===255?'utf-16be':'utf-8';
        const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
        if(text.includes('\0')) throw new Error('텍스트 로그가 아닙니다.');
        // Yield before the bounded Phase 1 parser. Worker/streaming arrives in Phase 7.
        await new Promise(resolve=>setTimeout(resolve,0));
        if(!get().files.some(item=>item.id===id)) continue;
        const parsed=parseLog({text,fileId:id,fileName:file.name},options);
        set(state=>({sources:{...state.sources,[id]:text},events:state.files.flatMap(file=>file.id===id?parsed.events:state.events.filter(event=>event.sourceFileId===file.id)),files:state.files.map(item=>item.id===id?{...item,status:'done',encoding,parser:parsed.parser,count:parsed.events.length,warnings:parsed.events.filter(event=>event.parseWarnings?.length).length,failures:parsed.events.filter(event=>event.parseErrors?.length).length,directives:parsed.directives,duration:performance.now()-start}:item)}));
      }catch(error){set(state=>({files:state.files.map(item=>item.id===id?{...item,status:'error',error:error instanceof Error?error.message:'파일을 읽지 못했습니다.'}:item)}));}
    }
  },
}));
