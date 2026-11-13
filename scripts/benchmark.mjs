import './build-worker-test.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const results=[1,10,50].map(size=>{const row=JSON.parse(execFileSync(process.execPath,['scripts/benchmark-case.mjs',String(size)],{encoding:'utf8',maxBuffer:1024*1024}));console.log(row);return row;});
mkdirSync('docs/benchmarks',{recursive:true});writeFileSync('docs/benchmarks/phase7.json',JSON.stringify({date:'2026-11-12',method:'Production parsing worker in Node worker_threads; synthetic Spring lines ~1 KiB; one run per size in a fresh process. RSS includes fixture, main, worker and message cloning. Heartbeat is 10ms, not browser FPS.',results},null,2)+'\n');
