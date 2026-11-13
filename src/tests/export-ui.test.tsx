import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../app/App';
import { ExportControls } from '../app/ExportControls';
import { VirtualLogTable } from '../app/VirtualLogTable';
import { useWorkspace } from '../stores/workspace';
import { useUi } from '../stores/ui';
import { parseLog } from '../core/parsers';
import { eventDataset } from '../core/export';
import { downloadArtifact } from '../core/download';
import { readFileSync } from 'node:fs';
vi.mock('../core/download',()=>({downloadArtifact:vi.fn()}));
const events=parseLog({text:'INFO first\nERROR failed',fileId:'file',fileName:'demo.log'}).events;
afterEach(()=>{cleanup();useWorkspace.getState().reset();useUi.setState({theme:'dark',detailWidth:320});vi.clearAllMocks();});
function openExports(){fireEvent.click(screen.getByText('분석 결과 내보내기',{selector:'summary'}));}
describe('Phase 8 workspace controls',()=>{
  it('switches themes, bounds and resets detail width without changing log data',()=>{
    useWorkspace.setState({events});const {container}=render(<App/>);const original=useWorkspace.getState().events;
    fireEvent.click(screen.getByRole('button',{name:'밝은 테마'}));expect(container.querySelector('.workspace')).toHaveAttribute('data-theme','light');expect(screen.getByRole('button',{name:'밝은 테마'})).toHaveAttribute('aria-pressed','true');
    fireEvent.change(screen.getByRole('slider',{name:'상세 패널 너비'}),{target:{value:'560'}});expect(container.querySelector('.workspace')).toHaveStyle('--detail-width:560px');fireEvent.click(screen.getByRole('button',{name:'너비 초기화'}));expect(screen.getByRole('slider',{name:'상세 패널 너비'})).toHaveValue('320');expect(useWorkspace.getState().events).toBe(original);
    expect(screen.getByRole('link',{name:'본문으로 바로가기'})).toHaveAttribute('href','#main-content');expect(screen.getByRole('navigation',{name:'분석 화면'})).toBeInTheDocument();
  });
  it('downloads explicit filtered and whole-session snapshots without changing filters',async()=>{
    useWorkspace.setState({events,selectedLevels:['ERROR']});render(<App/>);openExports();
    fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));await waitFor(()=>expect(downloadArtifact).toHaveBeenCalledTimes(1));
    const first=vi.mocked(downloadArtifact).mock.calls[0][0];const document=JSON.parse(await first.blob.text());expect(document.rows.map((row:{level:string})=>row.level)).toEqual(['ERROR']);expect(document.metadata.context.levels).toEqual(['ERROR']);
    fireEvent.change(screen.getByRole('combobox',{name:'분석 결과 내보내기 대상'}),{target:{value:'all'}});fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));await waitFor(()=>expect(downloadArtifact).toHaveBeenCalledTimes(2));
    const all=JSON.parse(await vi.mocked(downloadArtifact).mock.calls[1][0].blob.text());expect(all.rows).toHaveLength(2);expect(all.metadata.context.scope).toBe('session');expect(all.metadata.context.levels).toBeUndefined();expect(useWorkspace.getState().selectedLevels).toEqual(['ERROR']);
  });
  it('does not download stale work after scope changes or unmount',async()=>{
    const target={id:'test',label:'test',build:()=>eventDataset(Array.from({length:1000},(_,i)=>({...events[0],id:String(i)})),{})};const {rerender,unmount}=render(<ExportControls targets={[target]} revision={1}/>);openExports();fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));
    rerender(<ExportControls targets={[target]} revision={2}/>);await new Promise(resolve=>setTimeout(resolve,30));expect(downloadArtifact).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'선택 범위 다운로드'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));unmount();await new Promise(resolve=>setTimeout(resolve,30));expect(downloadArtifact).not.toHaveBeenCalled();
  });
  it('supports cancel and presents actionable export failures',async()=>{
    const target={id:'test',label:'test',build:()=>eventDataset(events,{})};const {rerender}=render(<ExportControls targets={[target]} revision={1}/>);openExports();fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));fireEvent.click(screen.getByRole('button',{name:'내보내기 취소'}));await screen.findByText('내보내기를 취소했습니다.');expect(downloadArtifact).not.toHaveBeenCalled();
    rerender(<ExportControls targets={[{...target,build:()=>{throw new Error('EXPORT_LIMIT: too large');}}]} revision={1}/>);fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));expect(await screen.findByRole('alert')).toHaveTextContent('조건을 좁혀');
  });
  it('blocks invalid filtered exports while allowing explicit whole-session output',()=>{
    useWorkspace.setState({events,filters:{...useWorkspace.getState().filters,from:'invalid'}});render(<App/>);openExports();expect(screen.getByRole('button',{name:'선택 범위 다운로드'})).toBeDisabled();fireEvent.change(screen.getByRole('combobox',{name:'분석 결과 내보내기 대상'}),{target:{value:'all'}});expect(screen.getByRole('button',{name:'선택 범위 다운로드'})).toBeEnabled();
  });
  it('connects selected trace exports to actual source events',async()=>{
    const text=readFileSync('public/samples/distributed-db.log','utf8');const rows=parseLog({text,fileId:'db',fileName:'db.log'},{timezone:'UTC'}).events;useWorkspace.setState({events:rows});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/요청 추적/,pressed:false}));fireEvent.click(screen.getByText('선택 추적 내보내기',{selector:'summary'}));fireEvent.click(within(screen.getByRole('region',{name:'선택 추적 내보내기'})).getByRole('button',{name:'선택 범위 다운로드'}));await waitFor(()=>expect(downloadArtifact).toHaveBeenCalledOnce());
    const artifact=vi.mocked(downloadArtifact).mock.calls[0][0];const document=JSON.parse(await artifact.blob.text());expect(document.metadata.kind).toBe('trace');expect(document.rows.every((row:{requestId:string})=>row.requestId==='req-demo-001')).toBe(true);expect(document.rows.some((row:{timestamp:number|null})=>row.timestamp===null)).toBe(true);
  });
  it('exports the selected exception outside common filters with its actual tree and source',async()=>{
    const text=readFileSync('public/samples/spring-exception.log','utf8');const rows=parseLog({text,fileId:'java',fileName:'java.log'}).events;useWorkspace.setState({events:rows,selectedId:rows[0].id,selectedLevels:['INFO']});render(<App/>);openExports();
    fireEvent.change(screen.getByRole('combobox',{name:'분석 결과 내보내기 대상'}),{target:{value:'exception'}});fireEvent.click(screen.getByRole('button',{name:'선택 범위 다운로드'}));await waitFor(()=>expect(downloadArtifact).toHaveBeenCalledOnce());
    const document=JSON.parse(await vi.mocked(downloadArtifact).mock.calls[0][0].blob.text());expect(document.rows).toEqual([JSON.parse(JSON.stringify(rows[0]))]);expect(document.metadata.context.scope).toBe('selected-event');expect(document.metadata.context.levels).toBeUndefined();
  });
  it('allows keyboard scrolling to the final virtual row and selecting its source',()=>{
    const rows=Array.from({length:1000},(_,i)=>({...events[0],id:String(i),message:`row ${i}`}));const select=vi.fn();render(<VirtualLogTable events={rows} selectedId={null} select={select} search={{query:'',mode:'literal',caseSensitive:false,operator:'AND'}}/>);
    const list=screen.getByLabelText('로그 이벤트 스크롤 목록');Object.defineProperty(list,'clientHeight',{value:360});fireEvent.keyDown(list,{key:'End'});expect(list.scrollTop).toBe(1000*62+36-360);fireEvent.click(screen.getByRole('button',{name:'row 999'}));expect(select).toHaveBeenCalledWith('999');fireEvent.keyDown(list,{key:'Home'});expect(list.scrollTop).toBe(0);expect(screen.getByRole('button',{name:'row 0'})).toBeInTheDocument();
  });
});
