import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLog } from '../core/parsers';
import { aggregateStatistics, bucketSizes, buildTimeline, eventsInBucket, findConcentrations, MAX_BUCKETS } from '../core/statistics';
import { timelineData } from '../core/statistics-chart';
import { filterEvents } from '../core/filter';
import { defaultFilters } from '../types/search';

const text=readFileSync('public/samples/statistics-demo.jsonl','utf8');
const events=parseLog({text,fileId:'demo',fileName:'statistics-demo.jsonl'}).events;
describe('statistics from observed events',()=>{
  it('computes actual sample counts and independent error/exception indicators',()=>{
    const result=aggregateStatistics(events);expect(result.summary).toMatchObject({total:12,errors:5,exceptions:3,http4xx:0,http5xx:0,levels:{INFO:3,DEBUG:1,ERROR:4,FATAL:1,WARN:1,TRACE:1,UNKNOWN:1}});expect(result.timed).toBe(10);expect(result.untimed).toBe(2);expect(result.errorRate).toBe(5/12);expect(result.topExceptions).toHaveLength(1);expect(result.topExceptions[0].events).toHaveLength(3);expect(result.topErrors[0]).toMatchObject({message:'Storage unavailable',count:3});expect(result.exceptionTypes).toEqual([{type:'DemoException',count:3}]);
  });
  it('keeps missing service/logger fields distinct and does not invent values',()=>{
    const result=aggregateStatistics(events);expect(result.services.find(item=>item.key===null)).toMatchObject({name:null,total:1,errors:1});expect(result.services.find(item=>item.key==='demo-api')?.total).toBe(8);expect(result.loggers.find(item=>item.key===null)?.total).toBe(1);expect(events[8].service).toBeUndefined();expect(events[8].timestamp).toBeNull();
  });
  it('deduplicates only identical event IDs and leaves equal content from other files as separate observations',()=>{
    const other={...events[0],id:'other:1',sourceFileId:'other',sourceFileName:'statistics-demo.jsonl'};const result=aggregateStatistics([events[0],events[0],other]);expect(result.summary.total).toBe(2);expect(result.duplicateIds).toBe(1);expect(result.files).toHaveLength(2);expect(result.files.every(file=>file.name==='statistics-demo.jsonl')).toBe(true);expect(buildTimeline([events[0],events[0],other],'1m').buckets[0].total).toBe(2);
  });
  it('handles empty or all-untimed data without fabricated ratios or chart timestamps',()=>{
    const empty=aggregateStatistics([]);expect(empty.errorRate).toBeNull();expect(empty.summary.total).toBe(0);expect(empty.firstSeen).toBeNull();expect(buildTimeline([],'1m').buckets).toEqual([]);
    const untimed=[events[8],events[9]];expect(aggregateStatistics(untimed).untimed).toBe(2);expect(buildTimeline(untimed,'1m').buckets).toEqual([]);
  });
  it('keeps IIS HTTP 4xx/5xx distinct from severity and exception counts, rejects invalid status values',()=>{
    const iis=parseLog({text:'#Fields: date time sc-status\n2026-11-06 00:00:00 500\n2026-11-06 00:00:10 404\n2026-11-06 00:00:20 bad',fileId:'iis',fileName:'iis.log'}).events;
    expect(aggregateStatistics(iis).summary).toMatchObject({total:3,errors:0,exceptions:0,http4xx:1,http5xx:1,levels:{UNKNOWN:3}});expect(buildTimeline(iis,'1m').buckets[0]).toMatchObject({http5xx:1,errors:0});
    expect(aggregateStatistics([{...events[0],parsedFields:{'sc-status':'500'}}]).summary.http5xx).toBe(0);
  });
  it('applies existing time/level/file filters before computing statistics without changing original inputs',()=>{
    const snapshot=JSON.stringify(events);const filtered=filterEvents(events,['ERROR','FATAL'],'demo',{...defaultFilters,from:'2026-11-06T14:31:00+09:00',to:'2026-11-06T05:31:40Z',includeUntimed:false});expect(aggregateStatistics(filtered).summary).toMatchObject({total:4,errors:4,exceptions:3});expect(aggregateStatistics(filtered).errorRate).toBe(1);expect(JSON.stringify(events)).toBe(snapshot);
  });
  it('updates derived statistics after file removal without duplicate exception/root counting',()=>{
    const root={...events[2],id:'root',sourceFileId:'second',sourceFileName:'second.log'};const initial=aggregateStatistics([...events,root]);expect(initial.summary.exceptions).toBe(4);const after=aggregateStatistics(initial.events.filter(event=>event.sourceFileId!=='demo'));expect(after.summary).toMatchObject({total:1,errors:1,exceptions:1});expect(after.files.map(file=>file.key)).toEqual(['second']);
  });
});
describe('UTC time buckets and concentrations',()=>{
  it('aligns to epoch UTC boundaries and keeps half-open intervals',()=>{
    const timeline=buildTimeline(events,'1m');expect(timeline.buckets).toHaveLength(5);expect(timeline.buckets.map(bucket=>bucket.total)).toEqual([2,5,0,1,2]);expect(timeline.buckets.map(bucket=>bucket.errors)).toEqual([0,4,0,0,0]);expect(timeline.buckets[0].start).toBe(Date.parse('2026-11-06T05:30:00Z'));expect(eventsInBucket(events,timeline.buckets[1])).toHaveLength(5);
    const atEnd={...events[0],id:'end',timestamp:timeline.buckets[1].end};expect(eventsInBucket([atEnd],timeline.buckets[1])).toEqual([]);expect(eventsInBucket([atEnd],timeline.buckets[2])).toEqual([atEnd]);
  });
  it('preserves the inclusive upper filter bound in its own half-open bucket',()=>{
    const filtered=filterEvents(events,[],'',{...defaultFilters,to:'2026-11-06T05:31:00Z',includeUntimed:false});const timeline=buildTimeline(filtered,'1m');expect(timeline.buckets.map(bucket=>bucket.total)).toEqual([2,1]);expect(eventsInBucket(filtered,timeline.buckets[1])).toEqual([events[2]]);
  });
  it('supports all specified resolutions and equivalent timezone offsets',()=>{
    for(const size of Object.keys(bucketSizes) as Array<keyof typeof bucketSizes>){const timeline=buildTimeline(events,size);expect(timeline.buckets.reduce((sum,bucket)=>sum+bucket.total,0)).toBe(10);expect(timeline.duration).toBe(bucketSizes[size]);expect(timeline.buckets[0].start%timeline.duration).toBe(0);}
    const day=buildTimeline(events,'1d');expect(day.buckets[0].start).toBe(Date.parse('2026-11-06T00:00:00Z'));
  });
  it('fills internal empty observed intervals but never extends the observation range to today',()=>{
    const timeline=buildTimeline(events,'1m');expect(timeline.buckets[2].total).toBe(0);expect(timeline.buckets.at(-1)?.end).toBe(Date.parse('2026-11-06T05:35:00Z'));
  });
  it('rejects oversized bucket spans explicitly and permits a coarser resolution',()=>{
    const first={...events[0],timestamp:0};const last={...events[1],timestamp:MAX_BUCKETS*60000};expect(buildTimeline([first,last],'1m').error).toContain('초과');expect(buildTimeline([first,last],'1m').buckets).toEqual([]);expect(buildTimeline([first,last],'1h').error).toBeUndefined();
  });
  it('uses floor rather than truncation for timestamps before the epoch',()=>{
    const timeline=buildTimeline([{...events[0],timestamp:-1},{...events[1],timestamp:0}],'1m');expect(timeline.buckets.map(bucket=>bucket.start)).toEqual([-60000,0]);expect(timeline.buckets.map(bucket=>bucket.total)).toEqual([1,1]);
  });
  it('classifies nonfinite timestamps as unplaced rather than creating invalid dates',()=>{
    const invalid=[{...events[0],timestamp:NaN},{...events[1],timestamp:Infinity}];expect(aggregateStatistics(invalid).untimed).toBe(2);expect(buildTimeline(invalid,'1m').buckets).toEqual([]);
    expect(buildTimeline([{...events[0],timestamp:8640000000000000}],'1m').error).toContain('날짜');
  });
  it('calculates threshold observations with an explicit denominator and independent signals',()=>{
    const buckets=buildTimeline(events,'1m').buckets;expect(findConcentrations(buckets,'application',3,80)).toEqual([buckets[1]]);expect(findConcentrations(buckets,'application',3,81)).toEqual([]);expect(findConcentrations(buckets,'exception',3,60)).toEqual([buckets[1]]);expect(findConcentrations(buckets,'http5xx',1,0)).toEqual([]);expect(()=>findConcentrations(buckets,'application',0,30)).toThrow();expect(()=>findConcentrations(buckets,'application',1,101)).toThrow();expect(()=>findConcentrations(buckets,'application',1.5,30)).toThrow();
  });
  it('passes only measured bucket values and UTC labels to charts',()=>{
    const timeline=buildTimeline(events,'1m');const data=timelineData(timeline.buckets);expect(data.labels).toHaveLength(5);expect(data.labels[0]).toBe('2026-11-06T05:30:00.000Z');expect(data.datasets[0].data).toEqual([2,5,0,1,2]);expect(data.datasets[1].data).toEqual([0,4,0,0,0]);expect(data.datasets[3].data).toEqual([0,0,0,0,0]);expect(data.datasets[4].data).toEqual([0,3,0,0,0]);
  });
});
