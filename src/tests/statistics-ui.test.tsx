import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { App } from '../app/App';
import { parseLog } from '../core/parsers';
import { useWorkspace } from '../stores/workspace';

// Canvas painting requires a real browser. Keep UI tests about actual data wiring,
// controls and drill-down; chart dataset values are tested without this mock.
vi.mock('react-chartjs-2',()=>({
  Line:({options,...props}:{options:{onClick:(event:null,elements:Array<{index:number}>)=>void};'aria-label':string})=><button aria-label={props['aria-label']} onClick={()=>options.onClick(null,[{index:1}])}>테스트 차트</button>,
  Bar:(props:{'aria-label':string})=><div role="img" aria-label={props['aria-label']}/>,
}));
afterEach(()=>{cleanup();useWorkspace.getState().reset();});
const text=readFileSync('public/samples/statistics-demo.jsonl','utf8');
const events=parseLog({text,fileId:'demo',fileName:'statistics-demo.jsonl'}).events;
describe('Phase 5 dashboard and timeline',()=>{
  it('shows actual summary counts, measured concentrations and chart drill-down original source',()=>{
    useWorkspace.setState({events});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Dashboard/}));
    const dashboard=screen.getByLabelText('Dashboard');expect(within(dashboard).getByText('41.7%')).toBeInTheDocument();expect(within(dashboard).getByText('10 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'집중 구간 선택 2026-11-06T05:31:00.000Z'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'UTC 시간대별 전체·오류·경고·HTTP 5xx·예외 이벤트 차트'}));expect(screen.getByText('선택 구간 이벤트 · 5개')).toBeInTheDocument();fireEvent.click(screen.getAllByRole('button',{name:'Storage unavailable'})[0]);expect(screen.getByText('줄 3–3')).toBeInTheDocument();expect(events[2].rawText).toContain('Storage unavailable');
  });
  it('shares period/level/file filters and handles result reset without cached statistics',()=>{
    useWorkspace.setState({events});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Dashboard/}));fireEvent.click(screen.getByRole('button',{name:/ERROR/,pressed:false}));expect(within(screen.getByLabelText('Dashboard')).getByText('100.0%')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox',{name:'시작 시각'}),{target:{value:'2026-11-06T05:33:00Z'}});fireEvent.click(screen.getByRole('checkbox',{name:/정규화 시각 없는 이벤트 포함/}));fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));expect(screen.getByText('시간 차트에 배치할 수 있는 이벤트가 없습니다.')).toBeInTheDocument();expect(within(screen.getByLabelText('Dashboard')).getByText('—')).toBeInTheDocument();
  });
  it('selects concentration intervals by keyboard-accessible controls and switches bucket sizes',()=>{
    useWorkspace.setState({events});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Timeline/}));fireEvent.click(screen.getByRole('button',{name:'집중 구간 선택 2026-11-06T05:31:00.000Z'}));expect(screen.getByText('선택 구간 이벤트 · 5개')).toBeInTheDocument();fireEvent.change(screen.getByRole('combobox',{name:'시간 버킷'}),{target:{value:'5m'}});expect(screen.queryByText('선택 구간 이벤트 · 5개')).not.toBeInTheDocument();fireEvent.change(screen.getByRole('spinbutton',{name:'집중 구간 최소 건수'}),{target:{value:'0'}});expect(screen.getByRole('alert')).toHaveTextContent('1 이상');
  });
  it('lets a file statistics row focus the same original file in Explorer',()=>{
    useWorkspace.setState({events,files:[{id:'demo',name:'statistics-demo.jsonl',size:text.length,status:'done',count:12,warnings:1}]});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Dashboard/}));fireEvent.click(screen.getByRole('button',{name:'파일 탐색 statistics-demo.jsonl'}));expect(useWorkspace.getState().fileId).toBe('demo');expect(screen.getByRole('table',{name:'로그 이벤트'})).toBeInTheDocument();expect(useWorkspace.getState().sources.demo).toBeUndefined();expect(useWorkspace.getState().events).toBe(events);
  });
  it('handles empty sessions without displaying invented chart points or percentages',()=>{
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Dashboard/}));expect(screen.queryByRole('button',{name:'UTC 시간대별 전체·오류·경고·HTTP 5xx·예외 이벤트 차트'})).not.toBeInTheDocument();expect(screen.getByText('정규화 시각이 없어 집중 구간을 계산할 수 없습니다.')).toBeInTheDocument();
  });
});
