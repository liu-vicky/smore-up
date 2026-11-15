import {createServer} from 'node:http';
import worker from '../dist/server/index.js';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const env={};
const server=createServer(async(req,res)=>{try{
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413);res.end('Request too large');return}chunks.push(chunk)}
 const origin='http://'+req.headers.host;const init={method:req.method,headers:req.headers};if(!['GET','HEAD'].includes(req.method))init.body=Buffer.concat(chunks);
 const response=await worker.fetch(new Request(new URL(req.url,origin),init),env);
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error);res.writeHead(500,{'Content-Type':'text/plain'});res.end('Server error')}});
server.listen(port,host,()=>console.log(`s’more up is running at http://${host}:${port}\npress ctrl+c to stop`));
