import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { App } from '../app/App';
import { parseLog } from '../core/parsers';
import { useWorkspace } from '../stores/workspace';
afterEach(()=>{cleanup();useWorkspace.getState().reset();});
const text=readFileSync('public/samples/spring-exception.log','utf8');
const events=parseLog({text,fileId:'java',fileName:'spring-exception.log'}).events;
describe('Exception Analyzer',()=>{
  it('shows repeat counts, observed dates, cause/suppressed tree and original source range',()=>{
    useWorkspace.setState({events});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/예외 분석/}));
    expect(screen.getByText('1개 그룹')).toBeInTheDocument();expect(screen.getByText('2개 예외 이벤트')).toBeInTheDocument();expect(screen.getByText('2026-11-06T05:30:01.123Z')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'예외 원본 보기 spring-exception.log 줄 10'}));expect(screen.getByText('줄 10–18')).toBeInTheDocument();expect(screen.getByText('Caused by · java.net.SocketTimeoutException')).toBeInTheDocument();expect(screen.getByText('Suppressed · java.io.IOException')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/로그 탐색기/}));expect(screen.getByRole('table',{name:'로그 이벤트'})).toBeInTheDocument();expect(useWorkspace.getState().events).toBe(events);
  });
  it('applies the existing shared search and level filters to exception occurrences',()=>{
    useWorkspace.setState({events});render(<App/>);fireEvent.click(screen.getByRole('button',{name:/예외 분석/}));fireEvent.change(screen.getByRole('textbox',{name:'검색어'}),{target:{value:'UserRepository.java:42'}});fireEvent.click(screen.getByRole('button',{name:'검색 적용'}));expect(screen.getByText('2개 예외 이벤트')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/INFO/,pressed:false}));expect(screen.getByText('분석할 예외가 없습니다')).toBeInTheDocument();
  });
  it('offers dedicated Java/.NET/incomplete sample choices without fetching user data',()=>{
    render(<App/>);expect(screen.getByRole('option',{name:'Java 반복 예외'})).toHaveValue('spring-exception.log');expect(screen.getByRole('option',{name:'.NET 내부 예외'})).toHaveValue('dotnet-exception.log');
  });
});
