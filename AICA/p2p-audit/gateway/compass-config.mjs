import {readFile} from 'node:fs/promises';
export function configuredModels(raw=''){
  return [...new Set(raw.replace(/\s*\([\d,]+\)/g,'').split(',').map(s=>s.trim().toLowerCase().replace(/\s+/g,'-').replace('gpt-4.o','gpt-4o')).filter(s=>/^gpt-[a-z0-9.-]+$/.test(s)))];
}
export async function compassConfig(env=process.env,{envPath}={}){
  const selected={};
  // Read only the Compass settings into memory. Never emit or copy .env credentials.
  if(envPath){try{const text=await readFile(envPath,'utf8');for(const line of text.split(/\r?\n/)){const m=line.match(/^\s*(KUST_PROD_KUIAA|COMPASS_MODELS|AICA_COMPASS_MODEL)\s*[:=]\s*(.*?)\s*$/);if(m)selected[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');}}catch(error){if(error.code!=='ENOENT')throw new Error('Could not read the Compass environment file.');}}
  const key=env.KUST_PROD_KUIAA?.trim()||selected.KUST_PROD_KUIAA?.trim(),models=configuredModels(env.COMPASS_MODELS||selected.COMPASS_MODELS),model=env.AICA_COMPASS_MODEL?.trim()||selected.AICA_COMPASS_MODEL||models[0];
  if(!key||!models.length)throw new Error('Set KUST_PROD_KUIAA and COMPASS_MODELS on the gateway host.');
  if(!models.includes(model))throw new Error('AICA_COMPASS_MODEL must be one of the configured Compass chat models.');
  const mode=env.AICA_GATEWAY_MODE||'local',token=env.AICA_GATEWAY_TOKEN?.trim()||'';
  if(!['local','hosted'].includes(mode))throw new Error('AICA_GATEWAY_MODE must be local or hosted.');
  if(mode==='hosted'&&token.length<32)throw new Error('Hosted mode requires an AICA_GATEWAY_TOKEN of at least 32 characters.');
  const origins=(env.AICA_ALLOWED_ORIGINS||'http://127.0.0.1:8773,http://127.0.0.1:8774,http://localhost:8773').split(',').map(s=>s.trim());
  for(const origin of origins){let url;try{url=new URL(origin);}catch{throw new Error('Use exact origins in AICA_ALLOWED_ORIGINS.');}if(url.origin!==origin||url.protocol!=='https:'&&!(mode==='local'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol==='http:'))throw new Error('Use HTTPS origins for hosted mode; localhost HTTP is supported locally.');}
  return {apiKey:key,model,models,token,origins,mode,host:mode==='local'?'127.0.0.1':'0.0.0.0',port:Number(env.PORT||env.AICA_CHAT_PORT||8781)};
}
