import './build-worker-test.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const results=[1,10,50].map(size=>{const row=JSON.parse(execFileSync(process.execPath,['scripts/benchmark-case.mjs',String(size)],{encoding:'utf8',maxBuffer:1024*1024}));if(row.events!==row.expectedEvents||row.failures!==0)throw new Error('Benchmark lost events or produced parsing failures');console.log(row);return row;});
const output=process.argv[2]??'docs/benchmarks/phase7.json';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({date:new Date().toISOString(),method:'Production parsing worker in Node worker_threads; synthetic Spring lines ~1 KiB; one run per size in a fresh process. RSS includes fixture, main, worker and message cloning. Heartbeat is 10ms, not browser FPS.',results},null,2)+'\n');
