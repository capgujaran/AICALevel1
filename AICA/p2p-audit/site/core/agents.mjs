import {createContext,inspectInvoices,inspectMatching,inspectPayments,verifyFindings,summarize,CONTROLS} from './engine.mjs';
export const AGENTS=[
  {id:'intake',name:'Evidence steward',role:'Validate the four extracts, record provenance and isolate the working population.',tool:'validate_population'},
  {id:'planner',name:'Audit planner',role:'Select specialist checks from the enabled controls and create a bounded execution plan.',tool:'plan_checks'},
  {id:'invoice',name:'Invoice specialist',role:'Find repeated supplier invoice numbers across distinct records.',tool:'inspect_invoices'},
  {id:'matching',name:'Matching specialist',role:'Compare invoice commitments and corroborate receipt evidence.',tool:'inspect_matching'},
  {id:'payment',name:'Payment specialist',role:'Reconcile payment totals and linked supplier identifiers.',tool:'inspect_payments'},
  {id:'verifier',name:'Evidence verifier',role:'Check that every exception cites an existing source and that amounts are valid.',tool:'verify_findings'},
  {id:'reporter',name:'Report preparer',role:'Create a review queue and aggregate invoice value without counting an invoice twice.',tool:'prepare_review'},
  {id:'human',name:'Human reviewer',role:'Accept, dismiss or request further evidence. Only accepted findings enter the reviewed report.',tool:'review_decision'}
];
const tools={invoice:inspectInvoices,matching:inspectMatching,payment:inspectPayments};
export async function runAudit(data,options={}, {signal,onEvent=()=>{}}={}) {
  const started=Date.now(),budgetMs=30000,events=[],operationId=globalThis.crypto?.randomUUID?.()??`run-${started}`;
  let ctx,toolCalls=0;
  const check=()=>{if(signal?.aborted)throw new DOMException('Audit stopped. Partial results were discarded.','AbortError');if(Date.now()-started>budgetMs)throw new Error('Audit reached its 30-second execution budget. Reduce the population.');};
  async function step(agentId,task) {
    check(); const agent=AGENTS.find(a=>a.id===agentId),event={step:events.length+1,agentId,agent:agent.name,tool:agent.tool,status:'running',startedAt:new Date().toISOString(),elapsedMs:0};
    events.push(event);onEvent({...event});
    const mark=Date.now();
    try{await new Promise(resolve=>setTimeout(resolve,15));check();task();toolCalls++;check();event.status='complete';event.elapsedMs=Date.now()-mark;onEvent({...event});}
    catch(error){event.status=error.name==='AbortError'?'stopped':'failed';event.elapsedMs=Date.now()-mark;onEvent({...event});throw error;}
  }
  await step('intake',()=>{ctx=createContext(structuredClone(data),options);});
  let plan;
  await step('planner',()=>{plan=['invoice','matching','payment'].filter(id=>CONTROLS.some(c=>c.agent===id&&ctx.enabled.has(c.id)));});
  for(const id of plan)await step(id,()=>tools[id](ctx));
  await step('verifier',()=>verifyFindings(ctx));
  let summary;
  await step('reporter',()=>{summary=summarize(ctx);});
  check();
  return {operationId,runtime:'Local tool agents',modelCalls:0,toolCalls,budgetMs,durationMs:Date.now()-started,plan,events,findings:ctx.findings,summary,diagnostics:ctx.diagnostics,options:{toleranceCents:ctx.toleranceCents,enabledControls:[...ctx.enabled]},completedAt:new Date().toISOString()};
}
export function reviewFinding(finding,{decision,reviewer,note,narrative}) {
  if(!finding.verified)throw new Error('Only evidence-verified findings can be reviewed.');
  if(!['Accepted','Dismissed','Needs evidence'].includes(decision))throw new Error('Select a review decision.');
  if(!reviewer?.trim()||reviewer.length>100)throw new Error('Enter a reviewer name (at most 100 characters).');
  if(!note?.trim()||note.length>3000)throw new Error('Record the basis of your decision (at most 3,000 characters).');
  if(narrative&&['condition','impact','recommendation'].some(k=>typeof narrative[k]!=='string'||!narrative[k].trim()||narrative[k].length>4000))throw new Error('Complete each narrative field (at most 4,000 characters).');
  const review={decision,reviewer:reviewer.trim(),note:note.trim(),at:new Date().toISOString()};
  const edited=narrative&&['condition','impact','recommendation'].some(k=>narrative[k]!==finding.narrative[k]);
  return {...finding,status:decision,narrative:narrative?{...finding.narrative,...narrative}:finding.narrative,narrativeOrigin:edited?'Auditor edited':finding.narrativeOrigin,review,reviewHistory:[...(finding.reviewHistory??[]),review]};
}
export function verifiedAiPayload(finding) {
  if(!finding.verified)throw new Error('Verify evidence before requesting an AI draft.');
  return {controlId:finding.controlId,condition:finding.narrative.condition,impact:finding.narrative.impact,recommendation:finding.narrative.recommendation,questions:finding.narrative.questions,evidenceRefs:finding.evidence.map((_,i)=>`E${i+1}`)};
}
export function validateAiDraft(draft,payload) {
  if(!draft||typeof draft!=='object'||Array.isArray(draft))throw new Error('AI gateway returned an invalid draft.');
  if(Object.keys(draft).sort().join(',')!=='evidenceRefs,impact,questions,recommendation')throw new Error('AI draft contains unsupported fields.');
  for(const k of ['impact','recommendation'])if(typeof draft[k]!=='string'||!draft[k].trim()||draft[k].length>4000||/\d/.test(draft[k]))throw new Error('AI draft must use concise text without new numeric claims.');
  if(!Array.isArray(draft.questions)||!draft.questions.length||draft.questions.length>5||draft.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>500||/\d/.test(q)))throw new Error('AI follow-up questions are invalid.');
  if(!Array.isArray(draft.evidenceRefs)||draft.evidenceRefs.length!==payload.evidenceRefs.length||new Set(draft.evidenceRefs).size!==payload.evidenceRefs.length||draft.evidenceRefs.some(r=>!payload.evidenceRefs.includes(r)))throw new Error('AI draft references do not match the supplied evidence aliases.');
  return draft;
}
export async function requestAiDraft(endpoint,token,payload,{signal}={}) {
  const url=new URL(endpoint),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw new Error('Use HTTPS for an AI gateway, or localhost for development.');
  if(url.username||url.password||url.search||url.hash)throw new Error('Gateway URLs must not contain credentials, query strings or fragments.');
  if(!token.trim())throw new Error('Enter your gateway access token. Provider API keys belong on the server.');
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({finding:payload}),signal,credentials:'omit',redirect:'error'});
  if(!response.ok)throw new Error(`AI gateway rejected the request (${response.status}). No draft was applied.`);
  const text=await response.text();if(text.length>30000)throw new Error('AI gateway response exceeds the allowed size.');
  return validateAiDraft(JSON.parse(text),payload);
}
