import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TYPES} from '../site/core/data.mjs';
import {importInstruction,prepareEvidenceFiles} from '../site/core/evidence-import.mjs';
import {runAudit} from '../site/core/agents.mjs';

async function samples(){return Promise.all(TYPES.map(async type=>{const name=`sample-${type}.csv`,text=await readFile(new URL(`../site/samples/${name}`,import.meta.url),'utf8');return {name,size:Buffer.byteLength(text),text:async()=>text};}));}

test('Local action recognizes explicit import instructions without executing explanatory or negative questions',()=>{
  assert.deepEqual(importInstruction('Import these files and run the P2P audit.'),{sample:false,run:true});
  assert.deepEqual(importInstruction('Load sample files and run the audit.'),{sample:true,run:true});
  assert.deepEqual(importInstruction('Please upload CSV files without running the audit.'),{sample:false,run:false});
  assert.equal(importInstruction('How do I upload files?'),null);
  assert.equal(importInstruction('Do not upload these files.'),null);
  assert.equal(importInstruction('Explain my audit results.'),null);
});

test('Packaged source samples are classified by their headers in any order and reproduce five findings',async()=>{
  const files=(await samples()).reverse().map((file,i)=>({...file,name:`extract-${i}.csv`}));
  const data=await prepareEvidenceFiles(files);
  const run=await runAudit(data);
  assert.equal(run.summary.invoiceCount,30);
  assert.equal(run.findings.length,5);
  assert.ok(data.invoices[0]._source.file.startsWith('extract-'));
});

test('Incomplete, duplicate and invalid populations fail before any data can be returned',async()=>{
  const files=await samples();
  await assert.rejects(prepareEvidenceFiles(files.slice(0,3)),/four CSV/);
  await assert.rejects(prepareEvidenceFiles([files[0],files[0],files[2],files[3]]),/Two files/);
  await assert.rejects(prepareEvidenceFiles(files.map((f,i)=>i===3?{...f,text:async()=>'unknown,data\n1,2'}:f)),/cannot uniquely identify/);
  await assert.rejects(prepareEvidenceFiles(files.map((f,i)=>i===3?{...f,size:3000000}:f)),/exceeds 2 MB/);
  const payment=await files[3].text();
  await assert.rejects(prepareEvidenceFiles(files.map((f,i)=>i===3?{...f,text:async()=>payment.replaceAll('AED','USD')}:f)),/one currency/);
});
