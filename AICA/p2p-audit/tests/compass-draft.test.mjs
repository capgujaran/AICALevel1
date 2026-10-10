import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,compassDraftRequest} from '../gateway/server.mjs';
const finding={controlId:'overpayment',condition:'Recorded payments exceed the invoice value.',impact:'The excess may need reconciliation.',recommendation:'Check allocations and reversals.',questions:['Are credits available?'],evidenceRefs:['E1','E2']};
test('Local drafting uses Compass, preserves aliases and rejects other website origins',async()=>{
  let calls=0;const server=createGateway({apiKey:'mock',model:'gpt-5.1',mode:'local',provider:'compass',origins:['http://127.0.0.1:8773']},{providerFetch:async(url,options)=>{
    calls++;assert.equal(url,'https://api.core42.ai/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer mock');
    const body=JSON.parse(options.body);assert.equal(body.max_completion_tokens,4500);assert.equal(body.response_format.type,'json_object');
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({impact:'The excess may require reconciliation.',recommendation:'Reconcile credits and payment allocations.',questions:['Are payment reversals available?'],evidenceRefs:finding.evidenceRefs})}}]})};
  }});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  try{assert.equal((await fetch(base+'/health')).status,200);assert.equal((await fetch(base+'/draft',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({finding})})).status,403);
    const response=await fetch(base+'/draft',{method:'POST',headers:{Origin:'http://127.0.0.1:8773','Content-Type':'application/json'},body:JSON.stringify({finding})});assert.equal(response.status,200);assert.deepEqual((await response.json()).evidenceRefs,['E1','E2']);assert.equal(calls,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
  assert.throws(()=>createGateway({apiKey:'mock',model:'gpt-5.1',mode:'hosted',origins:['https://example.com']}),/token required/);
  assert.match(compassDraftRequest('gpt-5.1',finding).messages[0].content,/Never include digits/);
});
