import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TYPES,parseDataset} from '../site/core/data.mjs';
import {runAudit} from '../site/core/agents.mjs';

test('Separate shipped CSV samples import and reproduce evidence-linked demo findings',async()=>{
  const data={};
  for(const type of TYPES){
    const name=`sample-${type}.csv`;
    data[type]=parseDataset(type,await readFile(new URL(`../site/samples/${name}`,import.meta.url),'utf8'),name);
  }
  const run=await runAudit(data);
  assert.equal(run.summary.invoiceCount,30);
  assert.equal(run.findings.length,5);
  assert.deepEqual(new Set(run.findings.map(f=>f.controlId)),new Set(['duplicate_invoice','po_exceeded','paid_without_receipt','overpayment','vendor_mismatch']));
  assert.ok(run.findings.every(f=>f.evidence.every(e=>e.file.startsWith('sample-')&&e.row>=2)));
});
