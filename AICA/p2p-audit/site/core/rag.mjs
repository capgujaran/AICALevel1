import {TOOL_KNOWLEDGE} from './knowledge.mjs';
import {money} from './reports.mjs';
const STOP=new Set('a an the and or of to in is it this that are was be for with by on as do does can me my our please explain tell about how what why which'.split(' '));
const words=text=>String(text).toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>!STOP.has(w))??[];
const synonyms={duplicate:['repeated','duplicates'],receipt:['receipts','grn','received','acceptance'],payment:['payments','paid','pay'],invoice:['invoices','bill'],supplier:['suppliers','vendor','vendors'],order:['orders','po'],overpayment:['overpaid','excess'],framework:['agents','agent','planner'],report:['reports','export','workpaper'],privacy:['private','data','compass'],run:['results','result','audit'],value:['amount','amounts','total','totals']};
export function retrieve(query,documents,{limit=6,history=[]}={}){
  if(!documents.length)return[];
  const queryWords=words(query),followup=queryWords.length<3||/\b(it|that|those|them|more|why)\b/i.test(query);
  let tokens=[...queryWords,...(followup?words(history.slice(-2).join(' ')):[])];
  for(const [key,related] of Object.entries(synonyms))if(tokens.some(t=>t===key||related.includes(t)))tokens.push(key,...related);
  tokens=[...new Set(tokens)].slice(0,80);
  const frequency=new Map(),rows=documents.map(doc=>{const terms=words(doc.title+' '+doc.text),counts=new Map();for(const t of terms)counts.set(t,(counts.get(t)??0)+1);for(const t of counts.keys())frequency.set(t,(frequency.get(t)??0)+1);return {doc,counts,length:terms.length,title:new Set(words(doc.title))};}),avg=rows.reduce((n,r)=>n+r.length,0)/rows.length||1;
  return rows.map(({doc,counts,length,title})=>{let score=0;for(const token of tokens){const count=counts.get(token)??0;if(!count)continue;const df=frequency.get(token),idf=Math.log(1+(rows.length-df+.5)/(df+.5));score+=idf*count*2.2/(count+1.2*(.25+.75*length/avg));if(title.has(token))score+=idf;}return {...doc,score};}).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit).map(({score,...doc})=>doc);
}
export function auditSources(run,counts={}){
  if(!run)return[];
  const s=run.summary;
  const groups=run.findings.reduce((a,f)=>{a[f.title]=(a[f.title]??0)+1;return a;},{});
  const summary={id:'run:summary',kind:'run',title:'Current audit run — summary',view:'overview',text:`Current completed audit run. Completed ${run.completedAt}. Invoice records processed by the tools: ${s.invoiceCount}; invoice value: ${money(s.populationValue,s.currency)}; payment value: ${money(s.paymentValue,s.currency)}. Detected findings: ${s.findingCount}; distinct affected invoice records: ${s.affectedInvoiceCount}; distinct affected invoice value: ${money(s.flaggedInvoiceValue,s.currency)}, not confirmed loss. Extract counts: ${Object.entries(counts).map(([k,v])=>k+' '+v).join(', ')||'not supplied'}. Review status counts: ${['Pending','Accepted','Dismissed','Needs evidence'].map(status=>status+' '+run.findings.filter(f=>f.status===status).length).join('; ')}. Enabled controls: ${run.options.enabledControls.join(', ')}; tolerance: ${money(run.options.toleranceCents,s.currency)}. Tool calls: ${run.toolCalls}; core model calls: ${run.modelCalls}. Finding type counts: ${Object.entries(groups).map(([k,v])=>k+' '+v).join('; ')}. First ${Math.min(20,run.findings.length)} rule-specific amounts: ${run.findings.slice(0,20).map((f,i)=>`Finding ${i+1} ${f.title}: ${money(f.amountCents,f.currency)}; ${f.status}`).join(' | ')}. Rule amounts overlap and are not confirmed loss. Accepting a finding does not, by itself, establish fraud or confirm financial loss.`};
  return [summary,...run.findings.map((f,i)=>({id:`finding:${i+1}`,kind:'finding',title:`Finding ${i+1}: ${f.title}`,view:'exceptions',findingId:f.id,text:`Finding ${i+1} in the current run. Control: ${f.controlId}; title: ${f.title}; provisional risk: ${f.severity}; review decision: ${f.status}. Rule-specific flagged amount: ${money(f.amountCents,f.currency)}, not confirmed loss. Condition: ${f.narrative.condition} Impact: ${f.narrative.impact} Recommendation: ${f.narrative.recommendation} Follow-up questions: ${f.narrative.questions.join(' ')} Evidence: ${f.evidence.length} source records verified as present in the supplied extracts. Narrative origin: ${f.narrativeOrigin}.`}))];
}
export function browserRetrieval(question,{run,counts,includeRun=false,selectedId,history=[]}={}){
  const corpus=includeRun?auditSources(run,counts):[],selected=corpus.find(s=>s.findingId===selectedId),isRunQuestion=/\b(run|results?|findings?|exceptions?|detected|flagged|affected|reviewed|accepted|dismissed|summary)\b/i.test(question)||(/\b(it|this|selected)\b/i.test(question)&&selected);
  let ranked=retrieve(question,[...TOOL_KNOWLEDGE,...corpus],{history,limit:7});
  // Current run is authoritative for results; the synthetic sample never answers an uploaded run question.
  if(isRunQuestion)ranked=ranked.filter(s=>s.id!=='guide:demo');
  const pinned=includeRun&&run&&isRunQuestion?[corpus[0],...(selected&&/\b(it|this|selected|finding|exception)\b/i.test(question)?[selected]:[])]:[];
  const sources=[...new Map([...pinned,...ranked].map(s=>[s.id,s])).values()].slice(0,8);
  return {sources,auditSources:sources.filter(s=>s.kind!=='guide'),history:history.slice(-4)};
}
export function validateChatReply(reply){
  if(!reply||typeof reply.answer!=='string'||!reply.answer.trim()||reply.answer.length>8000||!Array.isArray(reply.sources)||reply.sources.length>10)throw new Error('The chatbot returned an invalid answer.');
  const known=new Set(reply.sources.map(s=>s.id));
  if(!reply.sources.length||reply.sources.some(s=>!/^S\d+$/.test(s.id)||typeof s.title!=='string'||typeof s.text!=='string'))throw new Error('The chatbot returned invalid source references.');
  const markers=[...reply.answer.matchAll(/\[(S\d+)\]/g)].map(m=>m[1]);if(!markers.length||markers.some(id=>!known.has(id)))throw new Error('The chatbot answer contains missing or unsupported citations.');
  return reply;
}
export function endpointURL(value){const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw new Error('Use an HTTPS gateway URL or localhost, without credentials or query parameters.');return url;}
