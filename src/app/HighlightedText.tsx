import type { MatchRange } from '../types/search';
export function HighlightedText({text,ranges=[]}:{text:string;ranges?:MatchRange[]}){
  const nodes=[];let cursor=0;
  for(const [start,end] of ranges){if(start<cursor||end>text.length)continue;nodes.push(text.slice(cursor,start));nodes.push(<mark key={`${start}:${end}`}>{text.slice(start,end)}</mark>);cursor=end;}
  nodes.push(text.slice(cursor));return <>{nodes}</>;
}
