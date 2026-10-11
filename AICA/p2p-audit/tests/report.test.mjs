import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../site/core/sample.mjs';
import {runAudit,reviewFinding} from '../site/core/agents.mjs';
import {buildReport} from '../site/core/reports.mjs';

test('Branded report charts preserve accepted-only scope and distinguish full-run context',async()=>{
  const run=await runAudit(createDemo());
  run.findings[1].narrative.condition='EXCLUDED-FINDING-NARRATIVE';
  run.findings[0]=reviewFinding(run.findings[0],{decision:'Accepted',reviewer:'Demo reviewer',note:'Checked synthetic evidence.'});
  run.findings[1]=reviewFinding(run.findings[1],{decision:'Dismissed',reviewer:'Demo reviewer',note:'Illustrative dismissal.'});
  const html=buildReport(run,{reviewedOnly:true,engagement:'<Audit & report>'});
  assert.match(html,/P2P Audit Lab logo/);
  assert.match(html,/Pending: 3; Accepted: 1; Dismissed: 1; Needs evidence: 0/);
  assert.match(html,/1 included \/ 5 full-run findings/);
  assert.match(html,/6 affected invoice records; 24 other invoice records/);
  assert.match(html,/Only findings included in this report/);
  assert.equal((html.match(/<article class="finding">/g)??[]).length,1);
  assert.ok(!html.includes('EXCLUDED-FINDING-NARRATIVE'));
  assert.match(html,/&lt;Audit &amp; report&gt;/);
  assert.ok(!/<script|<link|<img|src=/i.test(html));
  assert.match(html,/@page\{size:A4/);
});
test('Zero-finding report has finite chart geometry and states assurance limits',async()=>{
  const data=createDemo();for(const type of Object.keys(data))data[type]=data[type].slice(0,1);
  const run=await runAudit(data),html=buildReport(run);
  assert.equal(run.findings.length,0);
  assert.ok(!/NaN|Infinity|undefined/.test(html));
  assert.match(html,/0 affected invoice records; 1 other invoice records/);
  assert.match(html,/No exceptions were detected under the selected controls/);
  assert.match(html,/does not establish the absence/);
});
