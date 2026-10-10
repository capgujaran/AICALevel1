import {sourceRef,validatePopulation,TYPES} from './data.mjs';
export const CONTROLS=[
  {id:'duplicate_invoice',name:'Duplicate invoice',purpose:'Same supplier and normalized invoice number appear on more than one source record.',severity:'High',agent:'invoice'},
  {id:'po_exceeded',name:'Purchase order exceeded',purpose:'Combined invoice value against a purchase order exceeds its approved value.',severity:'High',agent:'matching'},
  {id:'paid_without_receipt',name:'Payment without receipt evidence',purpose:'A paid invoice has no accepted goods receipt for its purchase order in the supplied extract.',severity:'High',agent:'matching'},
  {id:'overpayment',name:'Invoice overpaid',purpose:'Combined payments against an invoice exceed its recorded amount.',severity:'High',agent:'payment'},
  {id:'vendor_mismatch',name:'Supplier mismatch',purpose:'The payment supplier differs from the invoice supplier, or the invoice supplier differs from its purchase order.',severity:'High',agent:'payment'},
  {id:'missing_po',name:'Purchase order not found',purpose:'An invoice references a purchase order absent from the supplied extract.',severity:'Medium',agent:'matching'},
  {id:'orphan_payment',name:'Invoice not found for payment',purpose:'A payment references an invoice absent from the supplied extract.',severity:'High',agent:'payment'}
];
const group=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
const sum=rows=>rows.reduce((n,r)=>n+r.amountCents,0);
const normalizeNumber=v=>v.toUpperCase().replace(/[\s\-_./]/g,'');
export function createContext(data,{toleranceCents=0,enabledControls=CONTROLS.map(c=>c.id)}={}) {
  const currency=validatePopulation(data);
  if(!Number.isSafeInteger(toleranceCents)||toleranceCents<0)throw new Error('Tolerance must be a non-negative amount.');
  const enabled=new Set(enabledControls);
  if(!enabled.size||[...enabled].some(id=>!CONTROLS.some(c=>c.id===id)))throw new Error('Select at least one known control.');
  return {data,currency,toleranceCents,enabled,invoices: new Map(data.invoices.map(r=>[r.invoice_id,r])),pos:new Map(data.purchaseOrders.map(r=>[r.po_id,r])),receipts:group(data.receipts,r=>r.po_id),payments:group(data.payments,r=>r.invoice_id),poInvoices:group(data.invoices,r=>r.po_id),findings:[],seen:new Set(),diagnostics:[]};
}
function add(ctx,controlId,key,records,affected,amountCents,condition,impact,recommendation,questions) {
  if(!ctx.enabled.has(controlId))return;
  const id=`${controlId}:${key}`;if(ctx.seen.has(id))return;ctx.seen.add(id);
  const control=CONTROLS.find(c=>c.id===controlId), unique=[...new Map(records.map(r=>[sourceRef(r),r])).values()];
  ctx.findings.push({id,controlId,title:control.name,severity:control.severity,status:'Pending',amountCents,currency:ctx.currency,affectedInvoiceIds:[...new Set(affected)],evidence:unique.map(r=>({ref:sourceRef(r),...r._source,fields:Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('_')&&k!=='amountCents'))})),narrative:{condition,impact,recommendation,questions},narrativeOrigin:'Local template',review:null});
}
export function inspectInvoices(ctx) {
  for(const [key,rows] of group(ctx.data.invoices,r=>JSON.stringify([r.vendor_id,normalizeNumber(r.invoice_number)]))) {
    if(rows.length>1)add(ctx,'duplicate_invoice',key,rows,rows.map(r=>r.invoice_id),sum(rows.slice(1)),`${rows.length} invoice records have the same supplier and normalized invoice number.`, 'Duplicate records may lead to duplicate recognition or payment. The records do not, by themselves, prove a duplicate payment.', 'Confirm whether the records represent the same obligation before processing further payments.', ['Are both records valid, or is one a duplicate entry?','Provide the original invoices and any reversal records.']);
  }
}
export function inspectMatching(ctx) {
  for(const [poId,rows] of ctx.poInvoices) {
    const po=ctx.pos.get(poId);
    if(!po) {add(ctx,'missing_po',poId,rows,rows.map(r=>r.invoice_id),sum(rows),'The referenced purchase order is absent from the supplied purchase-order extract.','Approval and commitment limits cannot be corroborated from the supplied records.','Obtain the referenced purchase order and reconcile the extract coverage.',['Was a purchase order issued?','Provide the approved purchase order or the applicable exception approval.']);continue;}
    const value=sum(rows);
    if(value>po.amountCents+ctx.toleranceCents)add(ctx,'po_exceeded',poId,[po,...rows],rows.map(r=>r.invoice_id),value-po.amountCents,'Combined invoice value exceeds the recorded purchase-order value.','The difference may represent spending beyond the recorded commitment. Duplicate invoice records can also contribute to this exception.','Reconcile all invoices assigned to this order and obtain any approved amendment.',['Is there an approved purchase-order amendment?','Are all invoices allocated to the correct purchase order?']);
  }
  for(const invoice of ctx.data.invoices) {
    const payments=ctx.payments.get(invoice.invoice_id)??[], receipts=ctx.receipts.get(invoice.po_id)??[];
    if(sum(payments)>0&&!receipts.some(r=>r.accepted))add(ctx,'paid_without_receipt',invoice.invoice_id,[invoice,...payments,...receipts],[invoice.invoice_id],sum(payments),'A payment is recorded, but no accepted goods receipt for the purchase order appears in the supplied extract.','Receipt or acceptance cannot be corroborated. Missing extract evidence does not establish that goods or services were not received.','Obtain the goods receipt or service acceptance and assess whether payment was supported.',['Provide the signed goods receipt or service acceptance.','Could the receipt be outside the supplied extraction period?']);
  }
}
export function inspectPayments(ctx) {
  for(const [invoiceId,payments] of ctx.payments) {
    const invoice=ctx.invoices.get(invoiceId);
    if(!invoice){add(ctx,'orphan_payment',invoiceId,payments,[],sum(payments),'Payments reference an invoice absent from the supplied invoice extract.','Payment support cannot be corroborated from this population.','Obtain the referenced invoice and confirm extraction coverage.',['Provide the supporting invoice.','Was the invoice outside the supplied extraction period?']);continue;}
    const paid=sum(payments);
    if(paid>invoice.amountCents+ctx.toleranceCents)add(ctx,'overpayment',invoiceId,[invoice,...payments],[invoiceId],paid-invoice.amountCents,'Combined recorded payments exceed the invoice value.','The excess may require recovery or reconciliation against credits and allocation corrections.','Reconcile allocations, credit notes and reversals before concluding that recovery is due.',['Are there credit notes, reversals or payment allocation corrections?']);
    const po=ctx.pos.get(invoice.po_id), mismatched=payments.filter(r=>r.vendor_id!==invoice.vendor_id);
    if(mismatched.length||(po&&po.vendor_id!==invoice.vendor_id))add(ctx,'vendor_mismatch',invoiceId,[invoice,...(po?[po]:[]),...payments],[invoiceId],mismatched.length?sum(mismatched):invoice.amountCents,'Supplier identifiers differ between linked invoice, purchase-order or payment records.','The mismatch may indicate incorrect allocation or payment to an unintended supplier.','Confirm supplier identities, authorized payee arrangements and allocation accuracy.',['Why do the supplier identifiers differ?','Is a third-party payee arrangement approved and documented?']);
  }
  // Invoice-to-PO supplier checks also apply to unpaid invoices.
  for(const invoice of ctx.data.invoices) {const po=ctx.pos.get(invoice.po_id);if(po&&po.vendor_id!==invoice.vendor_id&&!ctx.payments.has(invoice.invoice_id))add(ctx,'vendor_mismatch',invoice.invoice_id,[invoice,po],[invoice.invoice_id],invoice.amountCents,'The invoice supplier differs from the referenced purchase-order supplier.','The invoice may be allocated to the wrong commitment.','Confirm supplier identity and purchase-order allocation.',['Is this the correct purchase order for the supplier?']);}
}
export function verifyFindings(ctx) {
  const refs=new Set(TYPES.flatMap(t=>ctx.data[t].map(sourceRef)));
  for(const f of ctx.findings) {
    if(!f.evidence.length||f.evidence.some(e=>!refs.has(e.ref))||!Number.isSafeInteger(f.amountCents)||f.amountCents<0)throw new Error('Evidence verification failed. Results were withheld.');
    f.verified=true;
  }
  const poIds=new Set(ctx.data.purchaseOrders.map(p=>p.po_id));
  const orphanReceipts=ctx.data.receipts.filter(r=>!poIds.has(r.po_id));
  if(orphanReceipts.length)ctx.diagnostics.push(`${orphanReceipts.length} receipt record(s) reference purchase orders outside the supplied extract.`);
  return ctx.findings;
}
export function summarize(ctx) {
  const affected=new Set(ctx.findings.flatMap(f=>f.affectedInvoiceIds));
  // This measure counts each invoice once. Rule-level flagged values overlap and must not be summed as a loss.
  const flaggedInvoiceValue=ctx.data.invoices.filter(r=>affected.has(r.invoice_id)).reduce((n,r)=>n+r.amountCents,0);
  return {invoiceCount:ctx.data.invoices.length,populationValue:sum(ctx.data.invoices),paymentValue:sum(ctx.data.payments),findingCount:ctx.findings.length,affectedInvoiceCount:affected.size,flaggedInvoiceValue,currency:ctx.currency};
}
export function analyze(data,options={}) {const ctx=createContext(data,options);inspectInvoices(ctx);inspectMatching(ctx);inspectPayments(ctx);verifyFindings(ctx);return {findings:ctx.findings,summary:summarize(ctx),diagnostics:ctx.diagnostics};}
