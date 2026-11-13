import { CHUNK_BYTES, MAX_LINE_CHARS, ParseLimitError } from './policy';
import type { SourceLine } from './common';
export interface StreamLine extends SourceLine { separator:string }
export async function detectEncoding(blob:Blob){
  const header=new Uint8Array(await blob.slice(0,3).arrayBuffer());
  return header[0]===255&&header[1]===254?'utf-16le':header[0]===254&&header[1]===255?'utf-16be':'utf-8';
}
export async function* decodedChunks(blob:Blob,encoding:string,chunkBytes=CHUNK_BYTES,onRead?:(bytes:number)=>void){
  if(!Number.isSafeInteger(chunkBytes)||chunkBytes<1)throw new Error('청크 크기는 양의 정수여야 합니다.');
  const decoder=new TextDecoder(encoding,{fatal:true});
  for(let offset=0;offset<blob.size;offset+=chunkBytes){
    const end=Math.min(blob.size,offset+chunkBytes);const text=decoder.decode(await blob.slice(offset,end).arrayBuffer(),{stream:true});
    if(text.includes('\0'))throw new Error('TEXT_BINARY: NUL이 포함된 텍스트는 지원하지 않습니다.');
    if(text)yield text;onRead?.(end);
  }
  const tail=decoder.decode();if(tail.includes('\0'))throw new Error('TEXT_BINARY: NUL이 포함된 입력입니다.');if(tail)yield tail;
}
export async function* streamLines(chunks:AsyncIterable<string>,maxLine=MAX_LINE_CHARS):AsyncGenerator<StreamLine>{
  let buffer='',offset=0,number=1;
  function line(raw:string,separator:string):StreamLine {if(raw.length>maxLine)throw new ParseLimitError('한 줄이 1 Mi 문자를 초과했습니다. 원본은 보존되며 분석은 취소됩니다.');const result={raw,separator,start:offset,end:offset+raw.length,number:number++};offset+=raw.length+separator.length;return result;}
  for await(const chunk of chunks){
    buffer+=chunk;let start=0;const newline=/\r\n|\r|\n/g;let match:RegExpExecArray|null;
    while((match=newline.exec(buffer))){if(match[0]==='\r'&&match.index===buffer.length-1)break;yield line(buffer.slice(start,match.index),match[0]);start=match.index+match[0].length;}
    buffer=buffer.slice(start);if(buffer.length>maxLine+1)throw new ParseLimitError('한 줄이 1 Mi 문자를 초과했습니다.');
  }
  if(buffer.endsWith('\r'))yield line(buffer.slice(0,-1),'\r');else if(buffer.length)yield line(buffer,'');
}
