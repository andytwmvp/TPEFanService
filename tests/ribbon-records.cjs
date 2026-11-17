const assert=require('node:assert/strict'),{create}=require('../ribbon-records.js');let value=null;const storage={getItem:()=>value,setItem:(_,v)=>value=v};let records=create(storage);const roster=Array.from({length:8},(_,i)=>i);
for(const member of roster)for(const row of 'ABCD')records.setAvailable(0,member,row,true);
for(const member of roster)for(const row of 'ABCD')records.hit(0,member,row,true);
records.finish(roster.map(member=>({ok:true,perfect:true,row:'D',member})),0,roster);
assert.deepEqual(records.collection(0,roster),{known:32,cells:32,got:32,perfect:32,total:32});
records=create(storage);assert.equal(records.get(0,7,'D'),2);assert.equal(records.get(1,7,'D'),0);assert.equal(records.snapshot().bestHit,8);assert(records.snapshot().titles.includes('allperfect'));assert(records.snapshot().titles.includes('eight'));
const saved=records.snapshot();records.hit(0,0,'A',false);assert.equal(records.get(0,0,'A'),2,'normal hit cannot downgrade perfect');assert.equal(saved.hits+1,records.snapshot().hits);
const limited=create({getItem:()=>'{corrupt',setItem:()=>{throw Error('quota')}});limited.hit(0,0,'A',true);assert.equal(limited.get(0,0,'A'),2);assert(limited.warning().includes('本次'));
console.log('record persistence, per-member rows, best score, milestones, perfect preservation and storage errors passed');

records.setAvailable(0,0,'A',false);assert.equal(records.available(0,0,'A'),true,'previously delivered cell remains reachable');
