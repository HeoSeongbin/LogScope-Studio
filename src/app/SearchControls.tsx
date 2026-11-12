import { useState } from 'react';
import { useWorkspace } from '../stores/workspace';
import { defaultFilters, defaultSearch } from '../types/search';
import type { ExplorerFilters, SearchOptions } from '../types/search';

export function SearchControls(){
  const storedSearch=useWorkspace(state=>state.search);const storedFilters=useWorkspace(state=>state.filters);
  const setExplorer=useWorkspace(state=>state.setExplorer);
  const [search,setSearch]=useState<SearchOptions>({...storedSearch});const [filters,setFilters]=useState<ExplorerFilters>({...storedFilters});
  const dirty=JSON.stringify(search)!==JSON.stringify(storedSearch)||JSON.stringify(filters)!==JSON.stringify(storedFilters);
  return <form className="search-controls" aria-label="로그 검색 및 필터" onSubmit={event=>{event.preventDefault();setExplorer({...search},{...filters});}}>
    <div className="search-main"><label className="query-label">검색<input aria-label="검색어" value={search.query} maxLength={256} placeholder={search.mode==='regex'?'예: timeout|failed (슬래시 없이)':'키워드 또는 "공백 포함 구문"'} onChange={event=>setSearch({...search,query:event.target.value})}/></label>
      <label>검색 방식<select aria-label="검색 방식" value={search.mode} onChange={event=>setSearch({...search,mode:event.target.value as SearchOptions['mode']})}><option value="literal">일반 문자열</option><option value="regex">정규식</option></select></label>
      <label>키워드 조건<select aria-label="키워드 조건" disabled={search.mode==='regex'} value={search.operator} onChange={event=>setSearch({...search,operator:event.target.value as SearchOptions['operator']})}><option>AND</option><option>OR</option></select></label>
      <label className="checkbox-label"><input type="checkbox" checked={search.caseSensitive} onChange={event=>setSearch({...search,caseSensitive:event.target.checked})}/>대소문자 구분</label>
      <button type="submit" className="primary">검색 적용</button><button type="button" onClick={()=>{setSearch({...defaultSearch});setFilters({...defaultFilters});setExplorer({...defaultSearch},{...defaultFilters});}}>검색 초기화</button>
    </div>
    <div className="filter-fields"><label>시작 시각 (오프셋 포함)<input aria-label="시작 시각" value={filters.from} placeholder="2026-11-06T14:30:00+09:00" onChange={event=>setFilters({...filters,from:event.target.value})}/></label><label>종료 시각 (오프셋 포함)<input aria-label="종료 시각" value={filters.to} placeholder="2026-11-06T15:00:00+09:00" onChange={event=>setFilters({...filters,to:event.target.value})}/></label>
      <label>Logger<input aria-label="Logger 필터" value={filters.logger} onChange={event=>setFilters({...filters,logger:event.target.value})}/></label><label>Thread<input aria-label="Thread 필터" value={filters.thread} onChange={event=>setFilters({...filters,thread:event.target.value})}/></label>
      <label>정렬<select aria-label="시간 정렬" value={filters.sort} onChange={event=>setFilters({...filters,sort:event.target.value as ExplorerFilters['sort']})}><option value="source">파일 원본 순서</option><option value="oldest">오래된 순</option><option value="newest">최신 순</option></select></label>
    </div>
    <div className="search-help"><label className="checkbox-label"><input type="checkbox" checked={filters.includeUntimed} onChange={event=>setFilters({...filters,includeUntimed:event.target.checked})}/>정규화 시각 없는 이벤트 포함 (시간순 정렬 시 맨 뒤)</label><span>{dirty?'변경사항은 검색 적용 후 반영됩니다.':search.mode==='regex'?'정규식: 검색 전용 Worker · 실행 1초 제한':'일반 검색: 공백으로 키워드 구분 · 따옴표로 구문 묶기'}</span></div>
  </form>;
}
