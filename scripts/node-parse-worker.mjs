import { parentPort } from 'node:worker_threads';
globalThis.self=globalThis;
globalThis.postMessage=message=>parentPort.postMessage(message);
parentPort.on('message',data=>globalThis.onmessage?.({data}));
await import('../.test-workers/parse-worker.mjs');
