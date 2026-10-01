import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const children=[
 spawn(process.execPath,['server/index.mjs'],{cwd:root,stdio:'inherit',env:process.env}),
 spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0'],{cwd:root,stdio:'inherit',env:process.env})
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');setTimeout(()=>process.exit(code),250).unref();}
for(const child of children){child.on('exit',code=>{if(!stopping)stop(code||0)});child.on('error',error=>{console.error(error);stop(1);});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(0));
