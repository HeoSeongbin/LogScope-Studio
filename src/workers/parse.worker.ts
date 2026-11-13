import { parseBlob, type ParseBlobRequest } from '../core/parsing/parse-blob';
let last=0;
self.onmessage=async(event:MessageEvent<ParseBlobRequest>)=>{
  try{const result=await parseBlob(event.data,progress=>{const now=performance.now();if(now-last>=50||progress.bytesRead===progress.totalBytes){last=now;self.postMessage({type:'progress',progress});}});self.postMessage({type:'result',result});}
  catch(error){self.postMessage({type:'error',error:error instanceof Error?error.message:'파일 분석에 실패했습니다.'});}
};
self.postMessage({type:'ready'});
