const test=require('node:test');
const assert=require('node:assert/strict');
const add=require('../src/feature-add.cjs');
test('adds numbers',()=>assert.equal(add(2,3),5));
test('handles negative values',()=>assert.equal(add(-2,3),1));
