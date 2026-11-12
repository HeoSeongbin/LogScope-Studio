import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { App } from '../app/App';
import { VirtualLogTable } from '../app/VirtualLogTable';
import { HighlightedText } from '../app/HighlightedText';
import { useWorkspace } from '../stores/workspace';
import { parseLog } from '../core/parsers';
import { useExplorerSearch } from '../hooks/useExplorerSearch';
import { defaultFilters, defaultSearch } from '../types/search';
import type { SearchOptions } from '../types/search';
import type { LogLevel } from '../types/log';

afterEach(()=>{cleanup();useWorkspace.getState().reset();vi.unstubAllGlobals();});
const events=parseLog({fileId:'one',fileName:'demo.log',text:'ERROR Database timeout\nINFO Request ready\nWARN Retry scheduled'}).events;
describe('Phase 3 explorer controls',()=>{
  it('applies keywords, marks matching text and preserves original detail',()=>{
    useWorkspace.setState({events});render(<App/>);
    fireEvent.change(screen.getByRole('textbox',{name:'검색어'}),{target:{value:'Database timeout'}});
    expect(screen.getByRole('button',{name:'INFO Request ready'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));expect(screen.queryByRole('button',{name:'INFO Request ready'})).not.toBeInTheDocument();
    const message=screen.getByRole('button',{name:'ERROR Database timeout'});expect(message.querySelectorAll('mark')).toHaveLength(2);
    fireEvent.click(message);expect(screen.getByText('줄 1–1')).toBeInTheDocument();expect(screen.getByText('ERROR',{selector:'pre'})).toBeInTheDocument();expect(useWorkspace.getState().events).toBe(events);
    fireEvent.click(screen.getByRole('button',{name:'검색 초기화'}));expect(screen.getByRole('button',{name:'INFO Request ready'})).toBeInTheDocument();
  });
  it('reports invalid ranges and supports no-time exclusion',()=>{
    useWorkspace.setState({events});render(<App/>);
    fireEvent.change(screen.getByRole('textbox',{name:'시작 시각'}),{target:{value:'2026-11-06T14:30:00'}});fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));expect(screen.getByRole('alert')).toHaveTextContent('시간대');
    fireEvent.click(screen.getByRole('button',{name:'검색 초기화'}));fireEvent.click(screen.getByRole('checkbox',{name:/정규화 시각 없는 이벤트 포함/}));fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));expect(screen.queryByRole('button',{name:'ERROR Database timeout'})).not.toBeInTheDocument();expect(screen.getByText('일치하는 이벤트가 없습니다')).toBeInTheDocument();
  });
  it('clears applied and draft search state on session reset',()=>{
    useWorkspace.setState({events,files:[{id:'one',name:'demo.log',size:10,status:'done',count:3,warnings:0}]});render(<App/>);
    fireEvent.change(screen.getByRole('textbox',{name:'검색어'}),{target:{value:'timeout'}});fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));fireEvent.click(screen.getByRole('button',{name:'세션 초기화'}));expect(screen.getByRole('textbox',{name:'검색어'})).toHaveValue('');expect(useWorkspace.getState().search).toEqual(defaultSearch);
  });
  it('shows a recoverable regex error when workers are unavailable',async()=>{
    vi.stubGlobal('Worker',undefined);useWorkspace.setState({events});render(<App/>);
    fireEvent.change(screen.getByRole('combobox',{name:'검색 방식'}),{target:{value:'regex'}});fireEvent.change(screen.getByRole('textbox',{name:'검색어'}),{target:{value:'timeout'}});fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument());fireEvent.click(screen.getByRole('button',{name:'검색 초기화'}));expect(screen.getByRole('button',{name:'ERROR Database timeout'})).toBeInTheDocument();
  });
  it('renders matching log HTML as inert text',()=>{
    const {container}=render(<HighlightedText text='<script>alert(1)</script>' ranges={[[1,7]]}/>);expect(container.querySelector('script')).toBeNull();expect(container.textContent).toBe('<script>alert(1)</script>');expect(container.querySelector('mark')).toHaveTextContent('script');
  });
});
describe('virtualized table',()=>{
  it('keeps mounted rows bounded while scrolling 10k events and selecting original provenance',()=>{
    const many=Array.from({length:10000},(_,index)=>({...events[0],id:`event-${index}`,message:`message-${index}`,lineStart:index+1,lineEnd:index+1}));const select=vi.fn();
    const {container}=render(<VirtualLogTable events={many} selectedId={null} select={select} search={defaultSearch}/>);expect(container.querySelectorAll('.log-row').length).toBeLessThan(20);expect(screen.queryByRole('button',{name:'message-9999'})).not.toBeInTheDocument();
    fireEvent.scroll(screen.getByLabelText('로그 이벤트 스크롤 목록'),{target:{scrollTop:620000}});expect(container.querySelectorAll('.log-row').length).toBeLessThan(20);fireEvent.click(screen.getByRole('button',{name:'message-9999'}));expect(select).toHaveBeenCalledWith('event-9999');expect(many[9999].lineStart).toBe(10000);
  });
});
describe('async search result lifetime',()=>{
  it('discards results from a superseded query and terminates obsolete workers',async()=>{
    const terminate=vi.fn();
    class FakeWorker {
      onmessage:((event:MessageEvent)=>void)|null=null;onerror=null;
      constructor(){queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}} as MessageEvent));}
      postMessage(data:{options:SearchOptions}){
        const callback=this.onmessage;const slow=data.options.query==='slow';setTimeout(()=>callback?.({data:{type:'result',result:{ids:[events[slow?0:1].id],messageRanges:{}}}} as MessageEvent),slow?400:1);
      }
      terminate(){terminate();}
    }
    vi.stubGlobal('Worker',FakeWorker);const levels:LogLevel[]=[];
    const {result,rerender,unmount}=renderHook(({search})=>useExplorerSearch(events,levels,'',defaultFilters,search),{initialProps:{search:{...defaultSearch,mode:'regex' as const,query:'slow'}}});
    await new Promise(resolve=>setTimeout(resolve,180));rerender({search:{...defaultSearch,mode:'regex',query:'fast'}});
    await waitFor(()=>expect(result.current.events).toEqual([events[1]]));await new Promise(resolve=>setTimeout(resolve,400));expect(result.current.events).toEqual([events[1]]);expect(terminate).toHaveBeenCalledTimes(2);unmount();
  });
});
