import {csvCell} from './data.mjs';
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=(cents,currency='AED')=>new Intl.NumberFormat('en-AE',{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);
export function reportCSV(run) {
  const headers=['Finding ID','Control','Risk','Status','Flagged amount','Currency','Condition','Impact','Recommendation','Source references','Reviewer','Review basis'];
  const rows=run.findings.map(f=>[f.id,f.title,f.severity,f.status,(f.amountCents/100).toFixed(2),f.currency,f.narrative.condition,f.narrative.impact,f.narrative.recommendation,f.evidence.map(e=>`${e.file} row ${e.row} (${e.recordId})`).join('; '),f.review?.reviewer??'',f.review?.note??'']);
  return [headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export {buildReport} from './report-layout.mjs';
