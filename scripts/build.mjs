import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,rmSync} from 'node:fs';
import path from 'node:path';
const assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.ttf':'font/ttf','.json':'application/json'};
function walk(dir){for(const name of readdirSync(dir)){const p=path.join(dir,name);if(statSync(p).isDirectory())walk(p);else{const ext=path.extname(name);if(!types[ext])continue;assets['/'+path.relative('web',p).split(path.sep).join('/')]={type:types[ext],body:readFileSync(p).toString('base64')}}}}
walk('web');rmSync('dist',{recursive:true,force:true});mkdirSync('dist/server',{recursive:true});const bundle='const ASSETS='+JSON.stringify(assets)+';\n'+readFileSync('worker/index.js','utf8');writeFileSync('dist/server/index.js',bundle);console.log('Built Worker with '+Object.keys(assets).length+' embedded assets ('+bundle.length+' bytes)');
