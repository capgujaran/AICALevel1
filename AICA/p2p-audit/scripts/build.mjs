import {cp,mkdir,writeFile} from 'node:fs/promises';
const source=new URL('../site/',import.meta.url),destination=new URL('../dist/',import.meta.url);
await mkdir(destination,{recursive:true});await cp(source,destination,{recursive:true});await writeFile(new URL('.nojekyll',destination),'');
console.log('Built dist/ from site/ only. Gateway, originals and working evidence are excluded.');
