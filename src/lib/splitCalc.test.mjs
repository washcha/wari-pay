import { computeSplits } from './splitCalc.js'

let passed = 0, failed = 0
const results = []

const assert = (name, cond, extra = '') => {
  if (cond) { passed++; results.push(['✅', name]) }
  else { failed++; results.push(['❌', `${name}  ${extra}`]) }
}

const assertEq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  assert(name, ok, ok ? '' : `\n   got:      ${JSON.stringify(actual)}\n   expected: ${JSON.stringify(expected)}`)
}

// -----------------------------------------------------------------------------
// Edge: empty state
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1000, splitAmong: ['A', 'B', 'C'],
    customSplits: {}, autoFilledUids: [],
  })
  assertEq('empty: allocated=0', r.allocated, 0)
  assertEq('empty: diff=1000', r.diff, 1000)
  assertEq('empty: effectiveSplits all 0', r.effectiveSplits, { A: 0, B: 0, C: 0 })
  assertEq('empty: hasEmptySlot=true', r.hasEmptySlot, true)
}

// -----------------------------------------------------------------------------
// All manual, balanced
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1000, splitAmong: ['A', 'B', 'C'],
    customSplits: { A: '400', B: '300', C: '300' }, autoFilledUids: [],
  })
  assertEq('manual balanced: allocated=1000', r.allocated, 1000)
  assertEq('manual balanced: diff=0', r.diff, 0)
  assertEq('manual balanced: no empty', r.hasEmptySlot, false)
}

// -----------------------------------------------------------------------------
// All manual, over
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 500, splitAmong: ['A', 'B'],
    customSplits: { A: '400', B: '400' }, autoFilledUids: [],
  })
  assertEq('manual over: diff=-300', r.diff, -300)
}

// -----------------------------------------------------------------------------
// B scenario: user's bill — B paid 200/consumed 250, C paid 100/consumed 50
// We only test the SPLIT side (consumption).
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 300, splitAmong: ['B', 'C'],
    customSplits: { B: '250', C: '50' }, autoFilledUids: [],
  })
  assertEq('B 250 / C 50: diff=0', r.diff, 0)
  assertEq('B 250 / C 50: effective', r.effectiveSplits, { B: 250, C: 50 })
}

// -----------------------------------------------------------------------------
// Quick-fill flow: 1 manual + rest auto
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1200, splitAmong: ['A', 'B', 'C', 'D'],
    customSplits: { A: '500' }, autoFilledUids: ['B', 'C', 'D'],
  })
  assertEq('quickfill: autos share remainder', r.effectiveSplits, { A: 500, B: 233.33, C: 233.33, D: 233.33 })
  // The rounded sum is 500 + 233.33*3 = 1199.99 -> diff rounds to 0.01
  assert('quickfill: diff close to 0', Math.abs(r.diff) < 0.02, `diff=${r.diff}`)
}

// -----------------------------------------------------------------------------
// Change manual amount — autos re-balance
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1200, splitAmong: ['A', 'B', 'C', 'D'],
    customSplits: { A: '300' }, autoFilledUids: ['B', 'C', 'D'],
  })
  assertEq('change manual -> autos re-balance', r.effectiveSplits, { A: 300, B: 300, C: 300, D: 300 })
  assertEq('change manual -> diff=0', r.diff, 0)
}

// -----------------------------------------------------------------------------
// Uncheck a member — remaining autos re-balance
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1200, splitAmong: ['A', 'B', 'C'],  // D unchecked
    customSplits: { A: '300' }, autoFilledUids: ['B', 'C', 'D'], // D still in auto set
  })
  assertEq('uncheck D: splits only A/B/C', r.effectiveSplits, { A: 300, B: 450, C: 450 })
  assertEq('uncheck D: diff=0', r.diff, 0)
}

// -----------------------------------------------------------------------------
// Re-check D after uncheck — auto restored
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1200, splitAmong: ['A', 'B', 'C', 'D'],
    customSplits: { A: '300' }, autoFilledUids: ['B', 'C', 'D'],
  })
  assertEq('recheck D: autos include D again', r.effectiveSplits, { A: 300, B: 300, C: 300, D: 300 })
}

// -----------------------------------------------------------------------------
// Manual amount > total — autos clamp to 0
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 1000, splitAmong: ['A', 'B', 'C'],
    customSplits: { A: '2000' }, autoFilledUids: ['B', 'C'],
  })
  assertEq('A over total: autos=0', r.effectiveSplits, { A: 2000, B: 0, C: 0 })
  assertEq('A over total: diff=-1000', r.diff, -1000)
}

// -----------------------------------------------------------------------------
// hasEmptySlot — all manual
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 100, splitAmong: ['A', 'B'],
    customSplits: { A: '60', B: '40' }, autoFilledUids: [],
  })
  assertEq('all manual: hasEmptySlot=false', r.hasEmptySlot, false)
}

// -----------------------------------------------------------------------------
// hasEmptySlot — some unassigned
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 100, splitAmong: ['A', 'B'],
    customSplits: { A: '60' }, autoFilledUids: [],
  })
  assertEq('one unassigned: hasEmptySlot=true', r.hasEmptySlot, true)
}

// -----------------------------------------------------------------------------
// hasEmptySlot — one manual, one auto (post quickfill)
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 100, splitAmong: ['A', 'B'],
    customSplits: { A: '60' }, autoFilledUids: ['B'],
  })
  assertEq('manual+auto: hasEmptySlot=false', r.hasEmptySlot, false)
  assertEq('manual+auto: B gets 40', r.effectiveSplits, { A: 60, B: 40 })
}

// -----------------------------------------------------------------------------
// Toggling off then on: customSplits preserved → "restore" works
// Simulated by passing same inputs — we don't test the state mutation here.
// -----------------------------------------------------------------------------
{
  const base = {
    amount: 500, splitAmong: ['A', 'B'],
    customSplits: { A: '200', B: '300' }, autoFilledUids: [],
  }
  const off = computeSplits({ ...base, splitAmong: ['A'] })
  assertEq('toggle B off: A only', off.effectiveSplits, { A: 200 })
  const on = computeSplits(base)
  assertEq('toggle B on: restored', on.effectiveSplits, { A: 200, B: 300 })
}

// -----------------------------------------------------------------------------
// Empty amount — autos distribute 0
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 0, splitAmong: ['A', 'B'],
    customSplits: {}, autoFilledUids: ['A', 'B'],
  })
  assertEq('amount=0: autos=0', r.effectiveSplits, { A: 0, B: 0 })
  assertEq('amount=0: diff=0', r.diff, 0)
}

// -----------------------------------------------------------------------------
// Amount updated while autos locked in — autos recompute
// -----------------------------------------------------------------------------
{
  const r = computeSplits({
    amount: 4000, splitAmong: ['A', 'B'],
    customSplits: {}, autoFilledUids: ['A', 'B'],
  })
  assertEq('amount changed from 1000->4000 with autos: 2000 each', r.effectiveSplits, { A: 2000, B: 2000 })
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('')
results.forEach(([icon, name]) => console.log(icon, name))
console.log('')
console.log(`${passed}/${passed + failed} passed`)
process.exit(failed > 0 ? 1 : 0)
