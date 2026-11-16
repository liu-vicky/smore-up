import assert from 'node:assert/strict';import worker from '../dist/server/index.js';
const records=new Map();const env={BUCKET:{async put(key,value){if(records.has(key))return null;records.set(key,value);return {etag:'saved'}},async get(key){return records.has(key)?{json:async()=>JSON.parse(records.get(key))}:null}}};
const base='https://camp.test';const request=(path,init={})=>worker.fetch(new Request(base+path,init),env);
const data={name:'Our little fire',goalSpec:{count:3,unit:'months'}};
let response=await request('/api/invites',{method:'POST',headers:{Origin:base},body:JSON.stringify(data)});assert.equal(response.status,201);const {code}=await response.json();assert.match(code,/^[A-Z]{10}$/);response=await request('/api/invites/'+code);assert.deepEqual(await response.json(),data);
response=await request('/api/invites',{method:'POST',headers:{Origin:'https://other.test'},body:JSON.stringify(data)});assert.equal(response.status,403);
response=await request('/api/invites',{method:'POST',body:JSON.stringify({name:'x',goalSpec:{count:-1,unit:'days'}})});assert.equal(response.status,400);
response=await request('/api/invites/XXXXXXXXXX');assert.equal(response.status,404);
response=await request('/api/invites',{method:'POST',body:'{'});assert.equal(response.status,400);
for(const path of ['/','/app.js','/gaegu-latin.ttf','/assets/fireplace.gif','/assets/stamps/01.png']){response=await request(path);assert.equal(response.status,200,path);assert((await response.arrayBuffer()).byteLength>0)}
const html=await (await request('/')).text();assert(html.includes('island-lonely-note'));assert(!html.includes('We hung out today ♡'));
console.log('Passed short-code creation and lookup, validation, origin checks, missing-code handling, and embedded app/asset delivery');
