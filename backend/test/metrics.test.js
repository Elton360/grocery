import assert from 'node:assert/strict'
import { test } from 'node:test'

import { measure } from '../src/lib/metrics.js'
import { pyRound } from '../src/lib/util.js'

import { golden, parity } from './helpers.js'

test('measure matches the Python goldens for every item and observation', () => {
  const cases = golden('metrics')
  const failures = []
  for (const { args, out } of cases) {
    const d = parity(measure(...args), out)
    if (d.length) failures.push(`${JSON.stringify(args)} -> ${d.join('; ')}`)
  }
  assert.deepEqual(
    failures.slice(0, 10),
    [],
    `${failures.length}/${cases.length} cases differ`,
  )
})

test('pyRound rounds exact halves to even like Python', () => {
  assert.equal(pyRound(0.125, 2), 0.12)
  assert.equal(pyRound(0.375, 2), 0.38)
  assert.equal(pyRound(2.675, 2), 2.67) // binary value is just below the half
  assert.equal(pyRound(1.005, 2), 1)
  assert.equal(pyRound(-0.125, 2), -0.12)
  assert.equal(pyRound(3.14159, 4), 3.1416)
})
