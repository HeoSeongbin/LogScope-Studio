import type { LogEvent, LogInput, ParseOptions } from '../../types/log';
import { levels } from '../../types/log';
import { normalizeExceptions } from '../exceptions/merge';
import { validateTimezone } from '../file-context';
import { finalizeEvent, parserNames, resultParser } from './finalize';
import { JsonDocumentStream } from './json-stream';
import { StreamTextParser } from './stream-parser';
import { decodedChunks, detectEncoding, streamLines } from './stream-reader';
import { CHUNK_BYTES, MAX_ESTIMATED_BYTES, MAX_EVENTS, MAX_FILE_BYTES, ParseLimitError, SOURCE_CACHE_BYTES } from './policy';

export interface ParseProgress { phase:'scan'|'parse'|'fallback'; bytesRead:number; totalBytes:number; events:number }
export interface ParseBlobRequest { source:Blob|string; fileId:string; fileName:string; options:ParseOptions; chunkBytes?:number; limits?:{events?:number;estimatedBytes?:number} }
function estimate(event:LogEvent){
  let frames=0;const pending=event.exception?[event.exception]:[];
  while(pending.length){const node=pending.pop()!;frames+=node.frames?.length??0;pending.push(...node.causeChain??[],...node.suppressed??[]);}
  return 1024+event.rawText.length*8+event.message.length*2+frames*256;
}
export async function parseBlob(request:ParseBlobRequest,onProgress?:(progress:ParseProgress)=>void){
  const started=performance.now();const blob=typeof request.source==='string'?new Blob([request.source]):request.source;
  if(blob.size>MAX_FILE_BYTES)throw new ParseLimitError('파일 크기는 최대 50 MiB입니다.');
  if(request.options.timezone)validateTimezone(request.options.timezone);
  if(request.options.parser&&request.options.parser!=='auto'&&!parserNames[request.options.parser])throw new Error('지원하지 않는 파서입니다.');
  const encoding=await detectEncoding(blob),chunkBytes=request.chunkBytes??CHUNK_BYTES;
  let directives=0,hasIis=false,first:string|undefined;const cache:string[]=[];
  async function* scanChunks(){for await(const chunk of decodedChunks(blob,encoding,chunkBytes,bytesRead=>onProgress?.({phase:'scan',bytesRead,totalBytes:blob.size,events:0}))){if(blob.size<=SOURCE_CACHE_BYTES)cache.push(chunk);first??=chunk.match(/\S/)?.[0];yield chunk;}}
  for await(const line of streamLines(scanChunks())){if(line.raw.startsWith('#Fields:'))hasIis=true;if(line.raw.startsWith('#'))directives++;}
  const input:LogInput={text:'',fileId:request.fileId,fileName:request.fileName};
  let events:LogEvent[]=[];let estimatedBytes=0;
  const maxEvents=Math.min(MAX_EVENTS,request.limits?.events??MAX_EVENTS),maxBytes=Math.min(MAX_ESTIMATED_BYTES,request.limits?.estimatedBytes??MAX_ESTIMATED_BYTES);
  function emit(event:LogEvent){if(events.length>=maxEvents)throw new ParseLimitError(`이벤트 수 한도 ${maxEvents.toLocaleString()}개를 초과했습니다.`);estimatedBytes+=estimate(event);if(estimatedBytes>maxBytes)throw new ParseLimitError('추정 보관량 한도를 초과했습니다. 파일을 나눠 분석하세요.');events.push(event);}
  let document=false,array=false;
  const choice=request.options.parser??'auto';
  if((choice==='auto'||choice==='json')&&(first==='{'||first==='[')){
    const parser=new JsonDocumentStream(input,request.options,event=>{
      // JSON records never merge with adjacent array values or log lines.
      const result=normalizeExceptions({...input,text:event.rawText},[event],false);for(const item of result)emit(item);
    });
    for await(const chunk of decodedChunks(blob,encoding,chunkBytes,bytesRead=>onProgress?.({phase:'parse',bytesRead,totalBytes:blob.size,events:events.length}))){parser.write(chunk);if(parser.invalid)break;}
    document=parser.complete();array=document&&parser.isArray;
    if(!document){events=[];estimatedBytes=0;}
  }
  let fallback=false;
  if(!document){
    const parser=new StreamTextParser(input,request.options,hasIis,emit);const phase=first==='{'||first==='['?'fallback':'parse';
    for await(const line of streamLines(decodedChunks(blob,encoding,chunkBytes,bytesRead=>onProgress?.({phase,bytesRead,totalBytes:blob.size,events:events.length}))))parser.write(line);
    parser.finish();fallback=choice==='auto'&&parser.sawStructured;
  }
  const levelCounts=Object.fromEntries(levels.map(level=>[level,0])) as Record<typeof levels[number],number>;let warnings=0,failures=0;
  // Mutate only unpublished worker-owned events: avoid retaining a second array.
  for(const event of events){Object.assign(event,finalizeEvent(event,request.options,fallback));levelCounts[event.level]++;if(event.parseWarnings?.length)warnings++;if(event.parseErrors?.length)failures++;}
  return {events,parser:resultParser(events,request.options,{iis:hasIis,array}),directives:choice==='iis'||choice==='auto'&&hasIis?directives:0,encoding,
    sourceText:blob.size<=SOURCE_CACHE_BYTES?cache.join(''):undefined,estimatedBytes,levelCounts,warnings,failures,duration:performance.now()-started};
}
export type ParseBlobResult=Awaited<ReturnType<typeof parseBlob>>;
