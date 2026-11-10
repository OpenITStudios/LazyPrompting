// Loopback-only fixture server. There is intentionally no ChatGPT route.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const files=new Map([
  ['/fixture-chat/index.html',['index.html','text/html; charset=utf-8']],
  ['/fixture-chat/simulator.mjs',['simulator.mjs','text/javascript; charset=utf-8']]
]);
const server=createServer(async(req,res)=>{
  const path=new URL(req.url??'/', 'http://127.0.0.1').pathname;
  const match=files.get(path);
  if(req.method!=='GET'||!match){res.writeHead(404).end('Not Found');return;}
  try {
    const bytes=await readFile(join(here,match[0]));
    res.writeHead(200,{'content-type':match[1], 'cache-control':'no-store',
      'x-content-type-options':'nosniff', 'content-security-policy':"default-src 'self'; script-src 'self'"}).end(bytes);
  } catch {res.writeHead(500).end('Fixture read failed');}
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({fixtureUrl:
  `http://127.0.0.1:${server.address().port}/fixture-chat/index.html?smoke=1`})));
