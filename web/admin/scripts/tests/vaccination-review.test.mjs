import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapVaccinationReview, reviewStatus } from '../../src/api/vaccinationReview.ts';

test('preserves all documents and source-specific vaccine/date pairs', () => {
 const d=mapVaccinationReview({recordId:5,status:'ANALYZED',dog:{dogId:8,name:'콩이',breed:'말티즈',weightKg:4},documents:[{documentId:1,url:'https://files/cert.jpg',contentType:'image/jpeg'},{documentId:2,url:'https://files/cert.pdf',contentType:'application/pdf'}],items:[{source:'AI',vaccineCode:'RABIES',vaccinatedAt:'2026-01-01'},{source:'GUARDIAN',vaccineCode:'RABIES',vaccinatedAt:'2026-02-03'},{source:'GUARDIAN',vaccineCode:'DHPPL',vaccinatedAt:'2026-03-04'}]},'5');
 assert.equal(d.dogName,'콩이'); assert.equal(d.files.length,2);assert.equal(d.files[1].contentType,'application/pdf');
 assert.equal(d.status,'OPERATOR_REVIEW');assert.equal(d.fields[1].aiValue,'RABIES: 2026-01-01');assert.equal(d.fields[1].value,'RABIES: 2026-02-03 · DHPPL: 2026-03-04');
 assert.deepEqual(d.verificationItems,[{vaccineCode:'RABIES',vaccinatedAt:'2026-02-03'},{vaccineCode:'DHPPL',vaccinatedAt:'2026-03-04'}]);
 assert.ok(d.fields.every(f=>!f.match),'operator must compare the document explicitly');
});
test('distinguishes unavailable URL from no attachment',()=>{
 const d=mapVaccinationReview({documents:[{documentId:9,readError:'retry'}]},'5');
 assert.equal(d.files.length,1);assert.equal(d.files[0].readError,'retry');assert.equal(d.files[0].url,'');assert.notEqual(d.fileName,'첨부 없음');
 assert.equal(mapVaccinationReview({},'6').files.length,0);
});
test('shows operator values after review and preserves completed/reupload statuses',()=>{
 const d=mapVaccinationReview({status:'VERIFIED',items:[{source:'AI',vaccineCode:'RABIES',vaccinatedAt:'2026-01-01'},{source:'OPERATOR',vaccineCode:'RABIES',vaccinatedAt:'2026-03-01'}]},'5');
 assert.equal(d.verificationItems[0].vaccinatedAt,'2026-03-01');assert.equal(d.status,'VERIFIED');assert.equal(reviewStatus('REJECTED'),'REUPLOAD');
});
