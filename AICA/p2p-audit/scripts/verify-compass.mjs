// Explicit live smoke check: synthetic demo and tool-guide context only.
import {runAudit} from '../site/core/agents.mjs';
import {createDemo} from '../site/core/sample.mjs';
import {browserRetrieval} from '../site/core/rag.mjs';
const run=await runAudit(createDemo());
for(const question of ['How does the agent framework work?','Summarize my current audit results and explain whether the affected value is a loss.']){
  const current=question.startsWith('Summarize'),r=browserRetrieval(question,{run,includeRun:current}),body={question,history:[],auditSources:r.auditSources.map(({id,kind,title,text})=>({id,kind,title,text:text.slice(0,7000)})),runId:current?run.operationId:null};
  const response=await fetch('http://127.0.0.1:8781/chat',{method:'POST',headers:{Origin:'http://127.0.0.1:8773','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)}),reply=await response.json();
  console.log(JSON.stringify({question,status:response.status,provider:reply.provider,model:reply.model,answer:reply.answer,error:reply.error,sources:reply.sources?.map(s=>s.title),usage:reply.usage}));
  if(!response.ok)process.exitCode=1;
}
