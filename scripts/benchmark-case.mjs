import { Worker } from 'node:worker_threads';
import { cpus, platform, arch } from 'node:os';
const mib=Number(process.argv[2]);
const line='2026-11-06T14:30:00.123Z INFO 1 --- [main] demo.App : '+ 'x'.repeat(970)+'\n';
const count=Math.floor(mib*1024*1024/Buffer.byteLength(line));
const source=new Blob([line.repeat(count)]);
const started=performance.now();let last=started,maxGap=0,peakRss=process.memoryUsage().rss;
const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;peakRss=Math.max(peakRss,process.memoryUsage().rss);},10);
const worker=new Worker(new URL('./node-parse-worker.mjs',import.meta.url));
worker.on('error',error=>{console.error(error);process.exitCode=1;clearInterval(timer);});
worker.on('message',message=>{
  if(message.type==='ready')worker.postMessage({source,fileId:'benchmark',fileName:'synthetic.log',options:{}});
  if(message.type==='error'){console.error(message.error);process.exitCode=1;clearInterval(timer);void worker.terminate();}
  if(message.type==='result'){
    const elapsedMs=performance.now()-started;maxGap=Math.max(maxGap,performance.now()-last);peakRss=Math.max(peakRss,process.memoryUsage().rss);
    console.log(JSON.stringify({requestedMiB:mib,bytes:source.size,events:message.result.events.length,expectedEvents:count,parserMs:message.result.duration,elapsedMs,maxMainHeartbeatGapMs:maxGap,peakProcessRssBytes:peakRss,estimatedRetainedBytes:message.result.estimatedBytes,failures:message.result.failures,node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0].model}));
    clearInterval(timer);void worker.terminate();
  }
});
