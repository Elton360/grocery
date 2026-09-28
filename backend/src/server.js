/** Local backend. Run: npm start (listens on 127.0.0.1:8765 only). */
import { createApp } from './app.js'
import { DB_PATH, connect } from './db.js'

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 8765)

const db = connect()
createApp(db).listen(PORT, HOST, () => {
  console.log(`Grocery backend on http://${HOST}:${PORT}/  (db: ${DB_PATH})`)
})
