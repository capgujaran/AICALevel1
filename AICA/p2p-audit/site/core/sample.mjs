import {TYPES, normalizeRecords} from './data.mjs';
export function createDemo() {
  const raw=Object.fromEntries(TYPES.map(t=>[t,[]]));
  for(let i=1;i<=29;i++) {
    const id=String(i).padStart(3,'0'), vendor=`VEN-${String((i%7)+1).padStart(2,'0')}`, amount=500+i*75, date=`2026-09-${String((i%27)+1).padStart(2,'0')}`;
    raw.invoices.push({invoice_id:`INV-${id}`,invoice_number:`AICA-${id}`,vendor_id:vendor,po_id:`PO-${id}`,date,amount,currency:'AED'});
    raw.purchaseOrders.push({po_id:`PO-${id}`,vendor_id:vendor,date:'2026-09-01',amount,currency:'AED'});
    raw.receipts.push({receipt_id:`GRN-${id}`,po_id:`PO-${id}`,date,accepted:true});
    raw.payments.push({payment_id:`PAY-${id}`,invoice_id:`INV-${id}`,vendor_id:vendor,date:'2026-09-30',amount,currency:'AED'});
  }
  raw.invoices.push({...raw.invoices[4],invoice_id:'INV-030'});
  raw.purchaseOrders[4].amount*=2; // Keep the duplicate test distinct from the aggregate PO-limit test.
  raw.purchaseOrders[8].amount=raw.invoices[8].amount-300;
  raw.receipts=raw.receipts.filter(r=>r.po_id!=='PO-014');
  raw.payments[19].amount+=125;
  raw.payments[24].vendor_id='VEN-99';
  return Object.fromEntries(TYPES.map(type=>[type,normalizeRecords(type,raw[type],`demo-${type}.csv`)]));
}
export const DEMO_EXPECTED=['duplicate_invoice','po_exceeded','paid_without_receipt','overpayment','vendor_mismatch'];
