import { build } from 'vite';
await build({configFile:false,logLevel:'error',build:{lib:{entry:'src/workers/parse.worker.ts',formats:['es'],fileName:()=> 'parse-worker.mjs'},outDir:'.test-workers',emptyOutDir:true,minify:false}});
