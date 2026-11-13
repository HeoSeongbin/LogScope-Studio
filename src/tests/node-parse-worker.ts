import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import type { SearchWorker } from '../core/regex-client';
export function createNodeParseWorker():SearchWorker {
  const native=new Worker(resolve('scripts/node-parse-worker.mjs'));
  const adapter:SearchWorker={onmessage:null,onerror:null,postMessage:data=>native.postMessage(data),terminate:()=>{void native.terminate();}};
  native.on('message',data=>adapter.onmessage?.({data} as MessageEvent));native.on('error',()=>adapter.onerror?.(new Event('error')));
  return adapter;
}
