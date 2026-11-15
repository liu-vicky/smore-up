import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
for(const p of ['/','/app.js','/assets/fireplace.gif','/assets/smore-logo.png']){const r=await worker.fetch(new Request('https://test.local'+p),{});assert.equal(r.status,200);assert((await r.arrayBuffer()).byteLength>0)}
const r=await worker.fetch(new Request('https://test.local/api/invites'),{});assert.equal(r.status,404);
console.log('Passed app, artwork, and static-only route checks');
