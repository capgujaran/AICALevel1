import {compassConfig} from './compass-config.mjs';
import {createGateway} from './server.mjs';
const config=await compassConfig(process.env,{envPath:process.env.AICA_ENV_FILE||(process.env.AICA_GATEWAY_MODE==='hosted'?undefined:new URL('../../../.env',import.meta.url))});
const server=createGateway({...config,provider:'compass'});
server.requestTimeout=50000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||process.env.AICA_DRAFT_PORT||8780),config.host,()=>console.log('Compass drafting gateway ready. Provider credentials remain server-side.'));
