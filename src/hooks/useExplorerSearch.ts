import { useEffect, useMemo, useRef, useState } from 'react';
import { filterEvents, sortEvents } from '../core/filter';
import { searchLiteral, searchRow } from '../core/search';
import { startRegexSearch } from '../core/regex-client';
import type { LogEvent, LogLevel } from '../types/log';
import type { ExplorerFilters, SearchOptions, SearchResult } from '../types/search';

interface Completed { events:LogEvent[]; search:SearchOptions; result?:SearchResult; error?:string }
export function useExplorerSearch(events:LogEvent[],levels:LogLevel[],fileId:string,filters:ExplorerFilters,search:SearchOptions){
  const candidates=useMemo(()=>{
    try{return {events:sortEvents(filterEvents(events,levels,fileId,filters),filters.sort),error:undefined};}
    catch(error){return {events:[],error:error instanceof Error?error.message:'필터에 실패했습니다.'};}
  },[events,levels,fileId,filters]);
  const literal=useMemo(()=>{
    if(search.mode==='regex')return {events:candidates.events,error:undefined};
    try{return {events:searchLiteral(candidates.events,search),error:undefined};}
    catch(error){return {events:[],error:error instanceof Error?error.message:'검색에 실패했습니다.'};}
  },[candidates.events,search]);
  const [completed,setCompleted]=useState<Completed|null>(null);
  const cancelRef=useRef<(()=>void)|null>(null);
  const regex=search.mode==='regex'&&search.query.length>0&&!candidates.error;
  useEffect(()=>{
    let active=true;
    // Release references to the previous file set after reset/remove/query changes.
    queueMicrotask(()=>{if(active)setCompleted(null);});
    if(!regex)return ()=>{active=false;};
    let cancel:(()=>void)|undefined;
    const timeout=setTimeout(()=>{
      const task=startRegexSearch(candidates.events.map(searchRow),search);cancel=task.cancel;
      task.promise.then(result=>{if(active)setCompleted({events:candidates.events,search,result});},error=>{if(active)setCompleted({events:candidates.events,search,error:error instanceof Error?error.message:'검색에 실패했습니다.'});});
    },150);
    cancelRef.current=()=>{clearTimeout(timeout);cancel?.();if(active)setCompleted({events:candidates.events,search,error:'검색이 취소되었습니다.'});};
    return ()=>{active=false;clearTimeout(timeout);cancel?.();cancelRef.current=null;};
  },[candidates.events,search,regex]);
  const current=completed?.events===candidates.events&&completed.search===search?completed:null;
  const regexEvents=useMemo(()=>{
    if(!current?.result)return [];
    const ids=new Set(current.result.ids);return candidates.events.filter(event=>ids.has(event.id));
  },[current,candidates.events]);
  return {
    events:regex?regexEvents:literal.events,
    error:candidates.error??(regex?current?.error:literal.error),
    pending:regex&&!current,
    messageRanges:regex?current?.result?.messageRanges:undefined,
    rawRanges:regex?current?.result?.rawRanges:undefined,
    highlightLimited:regex&&current?.result?.highlightLimited,
    cancel:()=>cancelRef.current?.(),
  };
}
