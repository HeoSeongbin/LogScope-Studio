import { create } from 'zustand';
import type { LogEvent, LogLevel, SourceFile, ParseOptions } from '../types/log';
import { defaultFilters, defaultSearch, type ExplorerFilters, type SearchOptions } from '../types/search';
import { validateZoneInput } from '../core/zone-validation';
import { startParse, ParseCancelled } from '../core/parsing/worker-client';
import { detectEncoding } from '../core/parsing/stream-reader';
import { MAX_FILE_BYTES, MAX_SESSION_BYTES, MAX_SESSION_EVENTS, MAX_SESSION_ESTIMATED_BYTES, SOURCE_CACHE_BYTES } from '../core/parsing/policy';
export { MAX_FILE_BYTES, MAX_SESSION_BYTES } from '../core/parsing/policy';

interface Workspace {
  search:SearchOptions; filters:ExplorerFilters; sessionVersion:number;
  setExplorer:(search:SearchOptions,filters:ExplorerFilters)=>void;
  setFileColor:(id:string,color:string)=>void;
  sources:Record<string,string>; files:SourceFile[]; events:LogEvent[];
  selectedId:string|null; selectedLevels:LogLevel[]; fileId:string;
  upload:(files:File[],options?:ParseOptions)=>Promise<void>;
  reparse:(id:string,options:ParseOptions)=>Promise<void>; cancelParse:(id:string)=>void;
  readSourcePreview:(id:string)=>Promise<{text:string;truncated:boolean}>;
  remove:(id:string)=>void; reset:()=>void;select:(id:string)=>void;
  toggleLevel:(level:LogLevel)=>void;setFile:(id:string)=>void;
}
const originals=new Map<string,Blob>();
const tasks=new Map<string,{cancel:()=>void}>();
function byFile(events:LogEvent[]){const map=new Map<string,LogEvent[]>();for(const event of events){const list=map.get(event.sourceFileId)??[];list.push(event);map.set(event.sourceFileId,list);}return map;}

export const useWorkspace=create<Workspace>((set,get)=>{
  function stop(id:string){const task=tasks.get(id);tasks.delete(id);task?.cancel();}
  async function analyze(id:string,source:Blob|string,options:ParseOptions){
    stop(id);const previous=get().files.find(file=>file.id===id);if(!previous)return;
    const completed=previous.status==='done'||previous.duration!==undefined;
    set(state=>({files:state.files.map(file=>file.id===id?{...file,status:'reading',phase:'queued',progress:0,error:undefined}:file)}));
    const task=startParse({source,fileId:id,fileName:previous.name,options},progress=>{
      if(tasks.get(id)!==task)return;
      set(state=>({files:state.files.map(file=>file.id===id?{...file,phase:progress.phase,progress:progress.totalBytes?Math.round(progress.bytesRead/progress.totalBytes*100):0}:file)}));
    });tasks.set(id,task);
    try{
      const parsed=await task.promise;
      if(tasks.get(id)!==task||!get().files.some(file=>file.id===id))return;
      const state=get(),groups=byFile(state.events);const oldCount=groups.get(id)?.length??0;
      if(state.events.length-oldCount+parsed.events.length>MAX_SESSION_EVENTS)throw new Error('PARSE_LIMIT: 세션 이벤트 한도 250,000개를 초과했습니다.');
      const retained=state.files.filter(file=>file.id!==id&&file.duration!==undefined).reduce((sum,file)=>sum+(file.estimatedBytes??file.size*12+file.count*1024),0);
      if(retained+parsed.estimatedBytes>MAX_SESSION_ESTIMATED_BYTES)throw new Error('PARSE_LIMIT: 세션 추정 보관량 한도를 초과했습니다.');
      groups.set(id,parsed.events);const sources={...state.sources};if(parsed.sourceText!==undefined)sources[id]=parsed.sourceText;else delete sources[id];
      set({sources,events:state.files.flatMap(file=>groups.get(file.id)??[]),selectedId:state.events.find(event=>event.id===state.selectedId)?.sourceFileId===id?null:state.selectedId,
        files:state.files.map(file=>file.id===id?{...file,status:'done',phase:undefined,progress:100,error:undefined,originalAvailable:originals.has(id)||parsed.sourceText!==undefined,encoding:parsed.encoding,parser:parsed.parser,parserChoice:options.parser??'auto',fieldMapping:options.fieldMapping,timezone:options.timezone,serviceName:options.serviceName,correlationScope:options.correlationScope,count:parsed.events.length,warnings:parsed.warnings,failures:parsed.failures,directives:parsed.directives,duration:parsed.duration,estimatedBytes:parsed.estimatedBytes,levelCounts:parsed.levelCounts}:file)});
    }catch(error){
      if(tasks.get(id)===task)set(state=>({files:state.files.map(file=>file.id===id?{...file,status:completed?'done':error instanceof ParseCancelled?'cancelled':'error',phase:undefined,progress:0,error:error instanceof Error?error.message:'파일 분석 실패'}:file)}));
      throw error;
    }finally{if(tasks.get(id)===task)tasks.delete(id);}
  }
  return {
    search:{...defaultSearch},filters:{...defaultFilters},sessionVersion:0,
    setExplorer:(search,filters)=>set({search,filters}),
    setFileColor:(id,color)=>{if(/^#[0-9a-f]{6}$/i.test(color))set(state=>({files:state.files.map(file=>file.id===id?{...file,color}:file)}));},
    sources:{},files:[],events:[],selectedId:null,selectedLevels:[],fileId:'',
    select:selectedId=>set({selectedId}),setFile:fileId=>set({fileId}),
    toggleLevel:level=>set(state=>({selectedLevels:state.selectedLevels.includes(level)?state.selectedLevels.filter(item=>item!==level):[...state.selectedLevels,level]})),
    reset:()=>{for(const id of [...tasks.keys()])stop(id);originals.clear();set(state=>({sources:{},files:[],events:[],selectedId:null,selectedLevels:[],fileId:'',search:{...defaultSearch},filters:{...defaultFilters},sessionVersion:state.sessionVersion+1}));},
    remove:id=>{stop(id);originals.delete(id);set(state=>({sources:Object.fromEntries(Object.entries(state.sources).filter(([key])=>key!==id)),files:state.files.filter(file=>file.id!==id),events:state.events.filter(event=>event.sourceFileId!==id),selectedId:state.events.find(event=>event.id===state.selectedId)?.sourceFileId===id?null:state.selectedId,fileId:state.fileId===id?'':state.fileId}));},
    cancelParse:id=>{stop(id);set(state=>({files:state.files.map(file=>file.id===id&&file.status==='reading'?{...file,status:file.duration!==undefined?'done':'cancelled',phase:undefined,progress:0,error:'사용자가 분석을 취소했습니다.'}:file)}));},
    reparse(id,options){
      const state=get(),file=state.files.find(file=>file.id===id);if(!file)return Promise.resolve();
      const effective={parser:file.parserChoice??'auto',fieldMapping:file.fieldMapping,timezone:file.timezone,serviceName:file.serviceName,correlationScope:file.correlationScope,...options};
      if(effective.timezone)validateZoneInput(effective.timezone);
      const source=originals.get(id)??state.sources[id];if(source===undefined)throw new Error('재분석할 원본이 없습니다. 파일을 다시 추가하세요.');
      return analyze(id,source,effective);
    },
    async readSourcePreview(id){
      const cached=get().sources[id];if(cached!==undefined)return {text:cached,truncated:false};
      const source=originals.get(id);if(!source)throw new Error('원본 파일이 제거되었습니다.');
      const encoding=await detectEncoding(source),truncated=source.size>SOURCE_CACHE_BYTES;
      const text=new TextDecoder(encoding,{fatal:true}).decode(await source.slice(0,SOURCE_CACHE_BYTES).arrayBuffer(),{stream:truncated});
      if(!get().files.some(file=>file.id===id))throw new Error('원본 파일이 제거되었습니다.');
      return {text,truncated};
    },
    async upload(files,options={}){
      const version=get().sessionVersion;
      for(const file of files){
        if(get().sessionVersion!==version)break;
        const id=crypto.randomUUID(),state=get();const size=state.files.reduce((sum,file)=>sum+(file.originalAvailable?file.size:0),0);
        const error=file.size>MAX_FILE_BYTES?'현재 파일 제한은 50 MiB입니다.':size+file.size>MAX_SESSION_BYTES?'세션 원본 크기 한도는 64 MiB입니다.':/\.(evtx|etl|zip|gz)$/i.test(file.name)?'바이너리·압축 형식은 현재 지원하지 않습니다.':undefined;
        if(!error)originals.set(id,file);
        set(state=>({files:[...state.files,{id,name:file.name,size:file.size,status:error?'error':'reading',phase:error?undefined:'queued',progress:0,originalAvailable:!error,parserChoice:options.parser??'auto',fieldMapping:options.fieldMapping,timezone:options.timezone,serviceName:options.serviceName,correlationScope:options.correlationScope,color:['#83d2af','#7cbbef','#baa1e9','#e5c277'][state.files.length%4],count:0,warnings:0,failures:0,error}]}));
        if(error)continue;
        try{await analyze(id,file,options);}catch{/* per-file status records the failure; continue other inputs */}
      }
    },
  };
});
