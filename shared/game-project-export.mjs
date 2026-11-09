import {emptyVault,normalizeVault} from './game-vault.mjs';
import {assertPortableSourcePaths} from './game-source-paths.mjs';

// Bounded, deterministic ZIP STORE archives: source files only, never engine execution.
export const PROJECT_ZIP_BYTES=140000;
const encoder=new TextEncoder();
function losslessUtf8(value){
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Source must be lossless UTF-8 text before export.');}else if(c>=0xdc00&&c<=0xdfff)throw Error('Source must be lossless UTF-8 text before export.');}
 return encoder.encode(value);
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function projectSourceArchive(value){
 const project=normalizeVault({...emptyVault(),projects:[value]}).projects[0];
 if(!project.files.length)throw Error('Add at least one source file before exporting a project ZIP.');
 assertPortableSourcePaths(value.files.map(file=>file.path));
 const rootDirectory='ecogames-'+project.id;
 const files=project.files.map(file=>{
  const name=encoder.encode(rootDirectory+'/'+file.path),data=losslessUtf8(file.content);
  return {name,data,crc:crc32(data)};
 });
 const localSize=files.reduce((n,f)=>n+30+f.name.length+f.data.length,0),centralSize=files.reduce((n,f)=>n+46+f.name.length,0),size=localSize+centralSize+22;
 if(size>PROJECT_ZIP_BYTES)throw Error('The source archive exceeds this pilot’s export limit.');
 const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);
 const u16=(p,n)=>v.setUint16(p,n,true),u32=(p,n)=>v.setUint32(p,n,true);
 let offset=0;
 for(const file of files){
  file.offset=offset;u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x0800);u16(offset+8,0);u16(offset+10,0);u16(offset+12,33);u32(offset+14,file.crc);u32(offset+18,file.data.length);u32(offset+22,file.data.length);u16(offset+26,file.name.length);
  bytes.set(file.name,offset+30);bytes.set(file.data,offset+30+file.name.length);offset+=30+file.name.length+file.data.length;
 }
 for(const file of files){
  u32(offset,0x02014b50);u16(offset+4,0x0314);u16(offset+6,20);u16(offset+8,0x0800);u16(offset+10,0);u16(offset+12,0);u16(offset+14,33);u32(offset+16,file.crc);u32(offset+20,file.data.length);u32(offset+24,file.data.length);u16(offset+28,file.name.length);u32(offset+38,(0o100644<<16)>>>0);u32(offset+42,file.offset);
  bytes.set(file.name,offset+46);offset+=46+file.name.length;
 }
 u32(offset,0x06054b50);u16(offset+8,files.length);u16(offset+10,files.length);u32(offset+12,centralSize);u32(offset+16,localSize);
 return {filename:rootDirectory+'.zip',rootDirectory,bytes,sourceFiles:files.length,engineEntryPoint:project.engine==='godot'&&project.files.some(f=>f.path==='project.godot')?rootDirectory+'/project.godot':null};
}
