import { executeRegexSearch } from '../core/search';
import type { SearchOptions, SearchRow } from '../types/search';

self.onmessage=(event:MessageEvent<{rows:SearchRow[];options:SearchOptions}>)=>{
  try{self.postMessage({type:'result',result:executeRegexSearch(event.data.rows,event.data.options)});}
  catch(error){self.postMessage({type:'error',error:error instanceof Error?error.message:'정규식 검색에 실패했습니다.'});}
};
self.postMessage({type:'ready'});
