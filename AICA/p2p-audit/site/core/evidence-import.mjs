import {TYPES,LABELS,SCHEMAS,parseCSV,parseDataset,validatePopulation} from './data.mjs';

export function importInstruction(question){
  const text=question.trim().toLowerCase();
  if(!/^(?:please\s+)?(?:alpha[, :]\s*)?(?:import|upload|load)\b/.test(text)||!/(?:files?|csv|extracts?|sample|demo)\b/.test(text))return null;
  const run=/\b(?:run|start|execute)\b/.test(text)&&!/(?:do not|don't|without|not)\s+(?:run|running|start|execute)/.test(text);
  return {sample:/\b(?:sample|demo)\b/.test(text),run};
}

// Stage and validate the entire selection before the application commits it.
export async function prepareEvidenceFiles(files){
  if(files.length!==TYPES.length)throw new Error('Select four CSV files: invoices, purchase orders, goods receipts and payments.');
  const data={};
  for(const file of files){
    if(!file.name.toLowerCase().endsWith('.csv'))throw new Error(`${file.name}: select a CSV file.`);
    if(file.size>2*1024*1024)throw new Error(`${file.name}: extract exceeds 2 MB.`);
    const text=await file.text();
    const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];
    parseCSV(first+'\n');
    const headers=first.split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    const matches=TYPES.filter(type=>SCHEMAS[type].every(field=>headers.includes(field)));
    const specific=matches.filter(type=>!matches.some(other=>SCHEMAS[other].length>SCHEMAS[type].length));
    if(specific.length!==1)throw new Error(`${file.name}: cannot uniquely identify the extract from its column headers. Use the supplied CSV templates.`);
    const type=specific[0];
    if(data[type])throw new Error(`Two files contain ${LABELS[type].toLowerCase()}. Select one file for each extract.`);
    data[type]=parseDataset(type,text,file.name);
  }
  for(const type of TYPES)if(!data[type])throw new Error(`The ${LABELS[type].toLowerCase()} file is missing.`);
  validatePopulation(data);
  return data;
}
