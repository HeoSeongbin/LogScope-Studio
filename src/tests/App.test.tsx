import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../app/App';
import { useWorkspace } from '../stores/workspace';
import { parseLog } from '../core/parsers';
import { FileParserSettings } from '../app/FileParserSettings';
afterEach(()=>{cleanup();useWorkspace.getState().reset();});
describe('explorer',()=>{
  it('filters ERROR and shows original event details',()=>{
    useWorkspace.setState({events:parseLog({text:'INFO ready\nERROR failed',fileId:'one',fileName:'demo.txt'}).events});
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:/ERROR/,pressed:false}));
    expect(screen.queryByRole('button',{name:'INFO ready'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'ERROR failed'}));expect(screen.getByText('줄 2–2')).toBeInTheDocument();
  });
  it('selects upload formats without parsing until a file is provided',()=>{
    render(<App/>);const select=screen.getByRole('combobox',{name:'새 파일 로그 형식'});fireEvent.change(select,{target:{value:'iis'}});expect(select).toHaveValue('iis');expect(useWorkspace.getState().events).toEqual([]);
  });
  it('allows per-file format and field mapping changes and shows untouched source',()=>{
    const source='{"body":"hello","level":"ERROR"}';
    const events=parseLog({text:source,fileId:'json',fileName:'json.log'},{parser:'generic'}).events;
    const file={id:'json',name:'json.log',size:source.length,status:'done' as const,parserChoice:'generic' as const,count:1,warnings:0};
    useWorkspace.setState({sources:{json:source},files:[file],events});
    function Settings(){const file=useWorkspace(state=>state.files[0]);return <FileParserSettings file={file}/>;}
    render(<Settings/>);
    fireEvent.change(screen.getByRole('combobox',{name:'json.log 로그 형식'}),{target:{value:'json'}});
    expect(useWorkspace.getState().events[0].parserId).toBe('json');
    fireEvent.click(screen.getByText('JSON 필드 매핑'));fireEvent.change(screen.getByRole('textbox',{name:'Message 매핑'}),{target:{value:'body'}});fireEvent.click(screen.getByRole('button',{name:'매핑 적용 및 재분석'}));
    expect(useWorkspace.getState().events[0].message).toBe('hello');expect(screen.getByRole('combobox',{name:'json.log 로그 형식'})).toHaveValue('json');
    fireEvent.click(screen.getByRole('button',{name:'파일 원본 보기'}));expect(screen.getByText(source,{selector:'pre'})).toBeInTheDocument();
  });
});
