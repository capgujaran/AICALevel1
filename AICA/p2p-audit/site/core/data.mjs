export const TYPES = ['invoices', 'purchaseOrders', 'receipts', 'payments'];
export const LABELS = { invoices: 'Invoices', purchaseOrders: 'Purchase orders', receipts: 'Goods receipts', payments: 'Payments' };
export const SCHEMAS = {
  invoices: ['invoice_id','invoice_number','vendor_id','po_id','date','amount','currency'],
  purchaseOrders: ['po_id','vendor_id','date','amount','currency'],
  receipts: ['receipt_id','po_id','date','accepted'],
  payments: ['payment_id','invoice_id','vendor_id','date','amount','currency']
};
export function cents(value) {
  const text = String(value).trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) throw new Error(`Invalid amount “${text}”. Use a positive decimal with up to two decimal places and no separators.`);
  const [whole, fraction=''] = text.split('.');
  const result = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds the supported range.');
  return result;
}
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/,'');
  const rows=[]; let row=[], value='', quoted=false, closed=false, line=1, rowLine=1;
  const pushCell=()=>{ row.push(value); value=''; closed=false; };
  const pushRow=()=>{ pushCell(); if(row.some(x=>x.trim())) rows.push({cells:row,line:rowLine}); row=[]; rowLine=line+1; };
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"') { if(text[i+1]==='"'){value+='"';i++;} else {quoted=false;closed=true;} }
      else {value+=c;if(c==='\n')line++;}
    } else if(c==='"') { if(value.length||closed)throw new Error(`Unexpected quote at line ${line}.`);quoted=true; }
    else if(c===',')pushCell();
    else if(c==='\n'||c==='\r') { if(c==='\r'&&text[i+1]==='\n')i++;pushRow();line++; }
    else {if(closed&&!/\s/.test(c))throw new Error(`Unexpected text after quoted value at line ${line}.`); if(!closed)value+=c;}
  }
  if(quoted)throw new Error('Unclosed quoted CSV value.');
  if(value.length||row.length||closed)pushRow();
  if(!rows.length)throw new Error('The file has no header row.');
  const headers=rows.shift().cells.map(h=>h.trim());
  if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error('CSV headers must be unique and non-empty.');
  return rows.map(({cells,line})=>{
    if(cells.length!==headers.length)throw new Error(`Line ${line} contains ${cells.length} fields; expected ${headers.length}.`);
    return {record:Object.fromEntries(headers.map((h,i)=>[h,cells[i]])),line};
  });
}
export function normalizeRecords(type, input, filename='uploaded-data') {
  if(!TYPES.includes(type))throw new Error('Unknown dataset.');
  if(!Array.isArray(input)||input.length>5000)throw new Error('Use an array with at most 5,000 records per dataset.');
  const idField=SCHEMAS[type][0], ids=new Set();
  return input.map((entry,index)=>{
    const raw=entry.record??entry, row=entry.line??index+2;
    if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new Error(`${filename}, row ${row}: expected a record.`);
    const result={};
    for(const field of SCHEMAS[type]) {
      if(raw[field]===null||raw[field]===undefined||String(raw[field]).trim()==='')throw new Error(`${filename}, row ${row}: ${field} is required.`);
      const value=String(raw[field]).trim();
      if(value.length>200||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))throw new Error(`${filename}, row ${row}: ${field} is too long or contains control characters.`);
      result[field]=value;
    }
    if(ids.has(result[idField]))throw new Error(`${filename}, row ${row}: duplicate ${idField} ${result[idField]}. Keep source record IDs unique; duplicate invoice numbers are allowed for testing.`);
    ids.add(result[idField]);
    const date=new Date(result.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==result.date)throw new Error(`${filename}, row ${row}: use a valid YYYY-MM-DD date.`);
    if('amount' in result)result.amountCents=cents(result.amount);
    if('currency' in result&&!/^[A-Z]{3}$/.test(result.currency))throw new Error(`${filename}, row ${row}: currency must be a three-letter uppercase code.`);
    if('accepted' in result) {
      if(!['true','false'].includes(result.accepted.toLowerCase()))throw new Error(`${filename}, row ${row}: accepted must be true or false.`);
      result.accepted=result.accepted.toLowerCase()==='true';
    }
    result._source={dataset:type,file:filename,row,recordId:result[idField]};
    return result;
  });
}
export function parseDataset(type,text,filename) {
  if(text.length>2*1024*1024)throw new Error('Files must be at most 2 MB.');
  let records;
  if(filename.toLowerCase().endsWith('.json'))records=JSON.parse(text);
  else {
    // Validate required headers even when an extract is explicitly empty.
    const header=parseCSV(text.split(/\r?\n/)[0]+ '\n');
    void header;
    const rawHeaders=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0].split(',').map(v=>v.trim().replace(/^"|"$/g,''));
    for(const field of SCHEMAS[type])if(!rawHeaders.includes(field))throw new Error(`${filename}: missing required header ${field}.`);
    records=parseCSV(text);
  }
  return normalizeRecords(type,records,filename);
}
export function validatePopulation(data) {
  for(const type of TYPES)if(!Array.isArray(data[type]))throw new Error(`Provide the ${LABELS[type].toLowerCase()} extract, even if it has no records.`);
  for(const type of TYPES){let total=0;for(const r of data[type]){if('amountCents' in r){if(!Number.isSafeInteger(r.amountCents)||r.amountCents<0)throw new Error('Invalid normalized amount.');total+=r.amountCents;if(!Number.isSafeInteger(total))throw new Error('Population total exceeds the supported exact monetary range.');}}}
  if(!data.invoices.length)throw new Error('At least one invoice is required.');
  const currencies=new Set([...data.invoices,...data.purchaseOrders,...data.payments].map(r=>r.currency));
  if(currencies.size!==1)throw new Error('Use one currency across all extracts. Split multi-currency populations into separate audits.');
  return [...currencies][0];
}
export function csvCell(value) {
  let text=String(value??'');
  if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function toCSV(headers, rows) {return [headers.map(csvCell).join(','),...rows.map(row=>row.map(csvCell).join(','))].join('\r\n');}
export function sourceRef(record) {const s=record._source;return `${s.dataset}:${s.recordId}`;}
export function exportPopulation(data) {
  return Object.fromEntries(TYPES.map(type=>[type,data[type].map(r=>Object.fromEntries(SCHEMAS[type].map(k=>[k,r[k]])))]));
}
