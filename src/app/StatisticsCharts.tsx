import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import type { TimeBucket, Counts, DimensionCounts } from '../core/statistics';
import { levels } from '../types/log';
import { timelineData } from '../core/statistics-chart';

ChartJS.register(CategoryScale,LinearScale,PointElement,LineElement,BarElement,Tooltip,Legend);
const levelColors=['#9cabc2','#baa1e9','#7cbbef','#e5c277','#ef9099','#df6c9b','#8f9caa'];
const base={responsive:true,maintainAspectRatio:false,animation:false as const,plugins:{legend:{labels:{color:'#a6b6c8',boxWidth:12,font:{size:10}}},tooltip:{enabled:true}},scales:{x:{ticks:{color:'#8c9fb4',maxTicksLimit:7,font:{size:9}},grid:{color:'#29323d'}},y:{beginAtZero:true,ticks:{color:'#8c9fb4',precision:0},grid:{color:'#29323d'}}}};
export function TimelineChart({buckets,onSelect}:{buckets:TimeBucket[];onSelect:(start:number)=>void}){
  const options:ChartOptions<'line'>={...base,onClick:(_event,elements)=>{const index=elements[0]?.index;if(index!==undefined&&buckets[index])onSelect(buckets[index].start);}};
  return <div className="chart-canvas"><Line data={timelineData(buckets)} options={options} role="img" aria-label="UTC 시간대별 전체·오류·경고·HTTP 5xx·예외 이벤트 차트"/></div>;
}
export function LevelChart({summary}:{summary:Counts}){
  return <div className="chart-canvas level-chart"><Bar role="img" aria-label="현재 결과 로그 레벨 분포" data={{labels:[...levels],datasets:[{label:'이벤트 수',data:levels.map(level=>summary.levels[level]),backgroundColor:levelColors}]}} options={{...base,plugins:{...base.plugins,legend:{display:false}}}}/></div>;
}
export function ServiceChart({items}:{items:DimensionCounts[]}){
  const top=items.slice(0,10);
  return <div className="chart-canvas"><Bar role="img" aria-label="전체 이벤트 수 상위 10개 서비스의 오류·예외 분포" data={{labels:top.map(item=>item.name===null?'미기록':item.name===''?'빈 문자열':item.name),datasets:[{label:'ERROR + FATAL',data:top.map(item=>item.errors),backgroundColor:'#ef9099'},{label:'예외 이벤트',data:top.map(item=>item.exceptions),backgroundColor:'#72b9dc'},{label:'HTTP 5xx',data:top.map(item=>item.http5xx),backgroundColor:'#b9a0e8'}]}} options={base}/></div>;
}
