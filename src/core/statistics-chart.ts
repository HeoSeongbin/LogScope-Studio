import type { TimeBucket } from './statistics';
export function timelineData(buckets:TimeBucket[]){
  return {labels:buckets.map(bucket=>new Date(bucket.start).toISOString()),datasets:[
    {label:'전체 이벤트',data:buckets.map(bucket=>bucket.total),borderColor:'#83d2af',backgroundColor:'#83d2af',pointRadius:2},
    {label:'ERROR + FATAL',data:buckets.map(bucket=>bucket.errors),borderColor:'#ef9099',backgroundColor:'#ef9099',pointRadius:2},
    {label:'WARN',data:buckets.map(bucket=>bucket.levels.WARN),borderColor:'#e5c277',backgroundColor:'#e5c277',pointRadius:2},
    {label:'HTTP 5xx',data:buckets.map(bucket=>bucket.http5xx),borderColor:'#b9a0e8',backgroundColor:'#b9a0e8',pointRadius:2},
    {label:'예외 이벤트',data:buckets.map(bucket=>bucket.exceptions),borderColor:'#72b9dc',backgroundColor:'#72b9dc',pointRadius:2},
  ]};
}
