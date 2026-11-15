const test=require('node:test');
const assert=require('node:assert/strict');
const add=require('../src/office-add.cjs');
test('adds positive numbers',()=>assert.equal(add(2,3),5));
test('handles zero and negatives',()=>{assert.equal(add(0,0),0);assert.equal(add(-2,3),1);});
