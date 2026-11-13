import '@testing-library/jest-dom/vitest';
import { setParseWorkerFactory } from '../core/parsing/worker-client';
import { createNodeParseWorker } from './node-parse-worker';
setParseWorkerFactory(createNodeParseWorker);
