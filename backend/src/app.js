/** Express app: the JSON API, plus the built frontend (frontend/dist) when present. */
import fs from 'node:fs'
import path from 'node:path'

import express from 'express'

import * as compare from './lib/compare.js'
import * as converge from './lib/converge.js'
import * as grabs from './lib/grabs.js'
import * as runner from './lib/runner.js'
import * as stock from './lib/stock.js'
import { ValueError } from './lib/util.js'
import { ROOT } from './paths.js'

// Custom header forces a CORS preflight for cross-site requests (which we never approve),
// so random web pages can't post into the local DB. The extension and our own pages send it.
export const CLIENT_HEADER = 'X-Grocery-Client'
const FRONTEND = path.join(ROOT, 'frontend', 'dist')

export function createApp(db) {
  const app = express()
  app.disable('x-powered-by')

  /** Run a handler in one transaction; a ValueError becomes a 400. */
  const tx = (fn) => (req, res) =>
    res.json(db.transaction(() => fn(req, res))())

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.get('/api/pending', (req, res) =>
    res.json({ items: grabs.listItems(db, req.query.status || 'pending') }),
  )
  app.get('/api/compare', (req, res) => res.json(compare.build(db)))
  app.get('/api/proposals', (req, res) =>
    res.json(converge.listProposals(db, req.query.status || 'proposed')),
  )
  app.get('/api/stock', (req, res) => res.json(stock.stockMap(db)))
  app.get('/api/converge/status', (req, res) => res.json(runner.runStatus()))

  const api = express.Router()
  api.use((req, res, next) =>
    req.method !== 'POST' || req.get(CLIENT_HEADER) === '1'
      ? next()
      : res.status(403).json({ error: 'missing client header' }),
  )
  api.use(express.json({ type: () => true, limit: '5mb' }))
  api.use((req, res, next) => {
    req.body ??= {}
    next()
  })

  api.post(
    '/grabs',
    tx((req) => grabs.saveGrab(db, req.body)),
  )
  api.post(
    '/check',
    tx((req) => ({
      status: grabs.statusOf(
        db,
        req.body.store,
        (req.body.ids || []).map(String),
      ),
    })),
  )
  api.post(
    '/ignore',
    tx((req) => ({
      removed: grabs.ignoreItems(db, req.body.store, req.body.items || []),
    })),
  )
  api.post('/converge/run', (req, res) =>
    res.json(
      runner.startRun({
        countProposals: (since) => converge.countNewProposals(db, since),
        pendingCount: () =>
          db
            .prepare("SELECT COUNT(*) n FROM items WHERE status='pending'")
            .get().n,
      }),
    ),
  )
  api.post(
    '/proposals/approve-bulk',
    tx((req) =>
      converge.approveBulk(db, Number(req.body.min_confidence ?? 0.9)),
    ),
  )
  api.post(
    '/proposals/:id/approve',
    tx((req) => converge.approve(db, Number(req.params.id), req.body.edits)),
  )
  api.post(
    '/proposals/:id/reject',
    tx((req) => converge.reject(db, Number(req.params.id))),
  )
  api.post(
    '/products/:id/stock',
    tx((req) => stock.setStock(db, Number(req.params.id), req.body.status)),
  )
  api.post(
    /^\/items\/([^/]+)\/(.+)\/preferred$/,
    tx((req) =>
      stock.setPreferred(
        db,
        req.params[0],
        req.params[1],
        Boolean(req.body.preferred),
      ),
    ),
  )
  // ids may contain slashes (name-derived keys), so match the tail by hand
  api.post(/^\/pending\/([^/]+)\/(.+)\/(remove|restore)$/, (req, res) => {
    const n = db.transaction(() =>
      grabs.setStatus(db, req.params[0], req.params[1], req.params[2]),
    )()
    res.status(n ? 200 : 404).json({ updated: n })
  })
  app.use('/api', api)
  app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }))

  if (fs.existsSync(FRONTEND)) {
    app.use(express.static(FRONTEND))
    // client-side routes (and the old *.html page names) get the app; missing assets stay 404s
    app.get('/{*path}', (req, res, next) =>
      /\.(?!html$)\w+$/.test(req.path)
        ? next()
        : res.sendFile(path.join(FRONTEND, 'index.html')),
    )
  }
  app.use((req, res) => res.status(404).json({ error: 'not found' }))

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValueError || err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: err.message })
    }
    console.error(err)
    return res.status(500).json({ error: 'internal error' })
  })
  return app
}
