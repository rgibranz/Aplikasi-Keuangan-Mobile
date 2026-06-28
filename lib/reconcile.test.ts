// Run: node --experimental-strip-types lib/reconcile.test.ts
// ponytail: no test runner in this repo; node strips TS types (Node >= 22.6 via fnm).
import assert from 'node:assert';
import { computeAdjustment } from './reconcile.ts';

// actual > current -> Income for the difference
assert.deepStrictEqual(computeAdjustment(250000, 200000), { type: 'Income', amount: 50000 });

// actual < current -> Expense for the absolute difference
assert.deepStrictEqual(computeAdjustment(170000, 200000), { type: 'Expense', amount: 30000 });

// equal -> no adjustment
assert.strictEqual(computeAdjustment(200000, 200000), null);

// float noise rounds away to zero -> no adjustment
assert.strictEqual(computeAdjustment(200000.4, 200000), null);

// rounds to nearest integer Rupiah
assert.deepStrictEqual(computeAdjustment(200000.6, 200000), { type: 'Income', amount: 1 });

// negative real balance is allowed
assert.deepStrictEqual(computeAdjustment(-5000, 0), { type: 'Expense', amount: 5000 });

console.log('reconcile: all assertions passed');
