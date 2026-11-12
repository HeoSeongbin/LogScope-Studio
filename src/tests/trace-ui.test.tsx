import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { App } from '../app/App';
import { TraceExplorer } from '../app/TraceExplorer';
import { parseLog } from '../core/parsers';
import { useWorkspace } from '../stores/workspace';
import type { SourceFile } from '../types/log';

afterEach(()=>{cleanup();useWorkspace.getState().reset();});
const api=readFileSync('public/samples/distributed-api.log','utf8');const db=readFileSync('public/samples/distributed-db.log','utf8');
const events=[...parseLog({text:api,fileId:'api',fileName:'api.log'},{serviceName:'demo-api'}).events,...parseLog({text:db,fileId:'db',fileName:'db.log'},{timezone:'UTC',serviceName:'demo-db'}).events];
const files:SourceFile[]=[{id:'api',name:'api.log',size:api.length,status:'done',count:4,warnings:0,serviceName:'demo-api',color:'#83d2af'},{id:'db',name:'db.log',size:db.length,status:'done',count:3,warnings:0,timezone:'UTC',serviceName:'demo-db',color:'#7cbbef'}];
describe('Trace Explorer integration',()=>{
  it('shows actual cross-file observations, separate unknown time and original source detail',()=>{
    useWorkspace.setState({events,files,sources:{api,db}});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/요청 추적/}));
    expect(screen.getByText('시간순 관측 이벤트 · 5개')).toBeInTheDocument();expect(screen.getByText('시각 미확인 이벤트 (시간축 제외) · 1개')).toBeInTheDocument();expect(screen.getByText(/4030 ms/)).toBeInTheDocument();expect(screen.getByText(/인과관계나 완전한 Span 트리가 아닙니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'추적 원본 보기 db.log 줄 2'}));expect(screen.getByText('줄 2–4')).toBeInTheDocument();expect(screen.getAllByText(/파일 설정: UTC/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('combobox',{name:'추적 식별자 타입'}),{target:{value:'spanId'}});expect(screen.getByText('2개 식별자 그룹')).toBeInTheDocument();
  });
  it('uses exact type/value search and an explicit whole-session mode without changing global filters',()=>{
    useWorkspace.setState({events,files,fileId:'api'});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/요청 추적/}));expect(screen.getByText('시간순 관측 이벤트 · 3개')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox',{name:/전체 세션에서 추적/}));expect(screen.getByText('시간순 관측 이벤트 · 5개')).toBeInTheDocument();expect(useWorkspace.getState().fileId).toBe('api');
    fireEvent.change(screen.getByRole('textbox',{name:'추적 식별자 값'}),{target:{value:'REQ-demo-001'}});fireEvent.click(screen.getByRole('button',{name:'식별자 검색'}));expect(screen.getByText('일치하는 식별자가 없습니다')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox',{name:'추적 식별자 값'}),{target:{value:'req-demo-002'}});fireEvent.click(screen.getByRole('button',{name:'식별자 검색'}));expect(screen.getByText('시간순 관측 이벤트 · 1개')).toBeInTheDocument();expect(screen.getByText(/계산 불가/)).toBeInTheDocument();
  });
  it('preserves file settings during parser changes, clears assumptions explicitly and handles invalid timezones atomically',()=>{
    useWorkspace.setState({events,files,sources:{api,db},fileId:'db'});render(<App/>);
    fireEvent.change(screen.getByRole('textbox',{name:'파일 시간대'}),{target:{value:'Not/AZone'}});fireEvent.click(screen.getByRole('button',{name:'파일 설정 적용 및 재분석'}));expect(screen.getByRole('alert')).toHaveTextContent('IANA');expect(useWorkspace.getState().files[1].timezone).toBe('UTC');
    fireEvent.change(screen.getByRole('textbox',{name:'파일 시간대'}),{target:{value:'+00:00'}});fireEvent.change(screen.getByRole('textbox',{name:'파일 서비스명'}),{target:{value:'database-user-label'}});fireEvent.change(screen.getByRole('textbox',{name:'파일 식별자 범위'}),{target:{value:'demo-scope'}});fireEvent.click(screen.getByRole('button',{name:'파일 설정 적용 및 재분석'}));expect(useWorkspace.getState().events.find(event=>event.sourceFileId==='db')).toMatchObject({service:'database-user-label',serviceSource:'file-setting',assumedTimezone:'+00:00',correlationScope:'demo-scope'});expect(useWorkspace.getState().sources.db).toBe(db);
    fireEvent.change(screen.getByRole('combobox',{name:'db.log 로그 형식'}),{target:{value:'serilog'}});expect(useWorkspace.getState().files[1].timezone).toBe('+00:00');
    fireEvent.change(screen.getByRole('textbox',{name:'파일 시간대'}),{target:{value:''}});fireEvent.change(screen.getByRole('textbox',{name:'파일 서비스명'}),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'파일 설정 적용 및 재분석'}));const updated=useWorkspace.getState().events.find(event=>event.sourceFileId==='db')!;expect(updated.timestamp).toBeNull();expect(updated.service).toBeUndefined();
  });
  it('can inspect the whole session when common filters are pending or invalid, without claiming zero matches',()=>{
    render(<TraceExplorer events={[]} allEvents={events} files={files} select={()=>{}} filterPending filterError="기간 오류"/>);expect(screen.getByRole('alert')).toHaveTextContent('기간 오류');expect(screen.queryByText('일치하는 식별자가 없습니다')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('checkbox',{name:/전체 세션에서 추적/}));expect(screen.getByText('시간순 관측 이벤트 · 5개')).toBeInTheDocument();
  });
  it('does not keep or silently substitute a selected trace after its source file is removed',()=>{
    useWorkspace.setState({events,files,sources:{api,db}});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/요청 추적/}));fireEvent.click(screen.getByRole('button',{name:/^req-demo-002/}));expect(screen.getByText('시간순 관측 이벤트 · 1개')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'api.log 제거'}));expect(screen.getByText(/선택했던 그룹이 현재 범위에 없습니다/)).toBeInTheDocument();expect(screen.queryByText('시간순 관측 이벤트 · 1개')).not.toBeInTheDocument();
  });
});
