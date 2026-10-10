import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnswer} from '../gateway/compass.mjs';
test('List numbering is permitted while unsupported quantities remain blocked',()=>{const sources=[{id:'S1',sourceId:'guide:framework',kind:'guide',title:'Framework',text:'Specialists execute deterministic tools.'}];assert.equal(validateAnswer({answer:'1. Specialists execute deterministic tools. [S1]',citations:['S1']},sources).sources.length,1);assert.throws(()=>validateAnswer({answer:'1. There are 99 findings. [S1]',citations:['S1']},sources),/numeric/);});
