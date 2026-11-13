import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

// Test the exact production artifact at the repository's Pages prefix.
const root=resolve('dist'),prefix='/LogScope-Studio/';
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.log':'text/plain;charset=utf-8','.jsonl':'text/plain;charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
createServer(async(request,response)=>{
  try{
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(!pathname.startsWith(prefix)){response.writeHead(404).end();return;}
    const path=resolve(root,pathname.slice(prefix.length)||'index.html');
    if(path!==root&&!path.startsWith(root+sep)){response.writeHead(403).end();return;}
    if(!(await stat(path)).isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});
    if(request.method==='HEAD')response.end();else createReadStream(path).pipe(response);
  }catch{response.writeHead(404).end();}
}).listen(4173,'127.0.0.1',()=>console.log('Production artifact: http://127.0.0.1:4173'+prefix));
