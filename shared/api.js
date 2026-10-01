/** Backend API client shared by the web app and the extension side panel. */

// Custom header the backend requires on POSTs, so random web pages can't post into the local DB.
const CLIENT_HEADER = { 'X-Grocery-Client': '1' }

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/** base: '' for same-origin (web app), 'http://127.0.0.1:8765' for the extension. */
export function createApi(base = '') {
  async function request(path, init) {
    let res
    try {
      res = await fetch(base + path, init)
    } catch {
      throw new ApiError(
        'Backend not reachable — run `npm start` in the grocery folder.',
        0,
      )
    }
    const body = await res.json().catch(() => ({}))
    if (!res.ok)
      throw new ApiError(body.error || `HTTP ${res.status}`, res.status)
    return body
  }
  const get = (path) => request(path)
  const post = (path, body = {}) =>
    request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: JSON.stringify(body),
    })
  const seg = encodeURIComponent

  return {
    health: () => get('/api/health'),
    compare: () => get('/api/compare'),
    stock: () => get('/api/stock'),
    setStock: (productId, status) =>
      post(`/api/products/${productId}/stock`, { status }),
    setPreferred: (store, id, preferred) =>
      post(`/api/items/${seg(store)}/${seg(id)}/preferred`, { preferred }),
    items: (status = 'pending') => get(`/api/pending?status=${seg(status)}`),
    proposals: (status = 'proposed') =>
      get(`/api/proposals?status=${seg(status)}`),
    convergeStatus: () => get('/api/converge/status'),
    startConverge: () => post('/api/converge/run'),
    check: (store, ids) => post('/api/check', { store, ids }),
    saveGrab: (grab) => post('/api/grabs', grab),
    ignore: (store, items) => post('/api/ignore', { store, items }),
    setItemStatus: (store, id, action) =>
      post(`/api/pending/${seg(store)}/${seg(id)}/${action}`),
    approve: (id, edits) => post(`/api/proposals/${id}/approve`, { edits }),
    reject: (id) => post(`/api/proposals/${id}/reject`),
    approveBulk: (minConfidence = 0.9) =>
      post('/api/proposals/approve-bulk', { min_confidence: minConfidence }),
  }
}
