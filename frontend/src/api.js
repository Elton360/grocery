import { createApi } from '../../shared/api.js'

/** Same-origin API: served by the backend in production, proxied by Vite in dev. */
export const api = createApi('')
