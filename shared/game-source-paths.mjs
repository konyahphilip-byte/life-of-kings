// Portable source-file paths shared by folder import and ZIP export.
// Server Vault validation remains backward compatible with existing stored projects.
export function assertPortableSourcePaths(paths){
 const files=new Set(),folders=new Map();
 for(const path of paths){
  if(typeof path!=='string'||!path||path.length>160||path!==path.trim()||!path.split('/').every(p=>/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(p)))throw Error('Use portable relative source paths without hidden folders, whitespace or traversal.');
  const parts=path.split('/');
  for(const part of parts)if(part.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))throw Error('Use portable source paths without reserved device names or trailing dots. Rename the file and update its references before exporting.');
  const key=path.toLowerCase();if(files.has(key)||[...files].some(existing=>existing.startsWith(key+'/')||key.startsWith(existing+'/')))throw Error('Source paths cannot collide or be both a file and directory.');files.add(key);
  for(let i=1;i<parts.length;i++){const folder=parts.slice(0,i).join('/'),name=folder.toLowerCase();if(folders.has(name)&&folders.get(name)!==folder)throw Error('Use consistent folder capitalization before importing or exporting.');folders.set(name,folder);}
 }
}
