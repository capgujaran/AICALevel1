// Synthetic diagnostic only. Never prints credentials or request headers.
import {compassConfig} from '../gateway/compass-config.mjs';
import {retrieveForGateway,compassRequest,validateAnswer} from '../gateway/compass.mjs';
const config=await compassConfig(process.env,{envPath:new URL('../../../.env',import.meta.url)}),body={question:'How does the agent framework work?',history:[],auditSources:[],runId:null},sources=retrieveForGateway(body);
try{
  const response=await fetch('https://api.core42.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(compassRequest(config.model,body,sources)),signal:AbortSignal.timeout(45000)});
  console.log(JSON.stringify({providerStatus:response.status}));
  if(response.ok){const result=await response.json(),choice=result.choices?.[0];console.log(JSON.stringify({finishReason:choice?.finish_reason,output:choice?.message?.content?.slice(0,6000)}));try{validateAnswer(JSON.parse(choice.message.content),sources);console.log('Citation and numeric checks passed.');}catch(error){console.log('Validation issue: '+error.message);}}
}catch(error){console.log(JSON.stringify({errorType:error.name,networkCode:error.cause?.code??null}));process.exitCode=1;}
