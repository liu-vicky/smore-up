import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=4399;const child=spawn(process.execPath,['scripts/dev-server.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit']});
try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Local server startup timed out')),10000);child.stdout.on('data',chunk=>{if(String(chunk).includes('is running')){clearTimeout(timeout);resolve()}});child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('Local server exited: '+code))})});
const base='http://127.0.0.1:'+port;
for(const file of ['/','/app.js','/assets/fireplace.gif','/assets/smore-logo.png','/gaegu-latin.ttf']){const response=await fetch(base+file);assert.equal(response.status,200,file);assert((await response.arrayBuffer()).byteLength>0)}
const data={name:'export test',goalSpec:{count:2,unit:'weeks'}};const create=await fetch(base+'/api/invites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(create.status,201);const {code}=await create.json();const lookup=await fetch(base+'/api/invites/'+code);assert.deepEqual(await lookup.json(),data);console.log('Passed local HTTP server, font/artwork delivery, and persistent invite lookup');
}finally{child.kill();}
