/** Headless Claude Code runner for converge: `claude -p "/converge"` in the repo, one run at a time. */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { ROOT } from '../paths.js'

import { BATCH_DIR } from './converge.js'
import { batchId, now } from './util.js'

const RUN_TIMEOUT = 600 // seconds
const ALLOWED_TOOLS = [
  'Bash(node backend/bin/converge.js:*)',
  'Read',
  'Edit(./data/converge/**)', // file-write permissions are matched by Edit(...) rules
  'Write(./data/converge/**)',
]

let run = { state: 'idle' }

/** Absolute path of an executable on PATH, or null. */
function which(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const file = path.join(dir, name)
    try {
      fs.accessSync(file, fs.constants.X_OK)
      return file
    } catch {
      // not in this directory
    }
  }
  return null
}

export function runStatus() {
  const s = { ...run }
  if (s.state === 'running')
    s.elapsed = Math.round(Date.now() / 1000 - s.started)
  return s
}

/**
 * Start the converge run. countProposals(sinceIso) returns the proposals stored since the start;
 * pendingCount() guards against running with nothing to do.
 */
export function startRun({ countProposals, pendingCount }) {
  if (pendingCount && pendingCount() === 0) {
    return {
      state: 'idle',
      message: 'Nothing pending — grab some orders or receipts first.',
    }
  }
  const exe = which('claude')
  if (!exe) {
    return {
      state: 'unavailable',
      message:
        'Claude Code (`claude`) is not on the PATH of the backend. Open a Claude Code session in the ' +
        'grocery folder and run /converge instead.',
    }
  }
  if (run.state === 'running') return { ...run, message: 'already running' }

  fs.mkdirSync(BATCH_DIR, { recursive: true })
  const log = path.join(BATCH_DIR, `run-${batchId()}.log`)
  const startedAt = now()
  run = {
    state: 'running',
    started: Date.now() / 1000,
    started_at: startedAt,
    log: path.relative(ROOT, log),
  }

  const fd = fs.openSync(log, 'w')
  const args = [
    '-p',
    '/converge',
    '--output-format',
    'json',
    '--allowedTools',
    ...ALLOWED_TOOLS,
  ]
  const child = spawn(exe, args, { cwd: ROOT, stdio: ['ignore', fd, fd] })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
  }, RUN_TIMEOUT * 1000)

  let done = false
  const finish = (result) => {
    if (done) return // 'error' and 'exit' can both fire
    done = true
    clearTimeout(timer)
    fs.closeSync(fd)
    const ok = result.state === 'finished'
    result.proposals = countProposals(startedAt)
    if (!ok) {
      result.log_tail = fs.existsSync(log)
        ? fs.readFileSync(log, 'utf8').slice(-1500)
        : ''
    }
    run = { ...run, ...result, finished_at: now() }
  }
  child.on('error', (e) => finish({ state: 'failed', error: e.message }))
  child.on('exit', (code) => {
    if (timedOut)
      finish({
        state: 'failed',
        error: `timed out after ${RUN_TIMEOUT / 60} minutes`,
      })
    else finish({ state: code === 0 ? 'finished' : 'failed', returncode: code })
  })
  return runStatus()
}
