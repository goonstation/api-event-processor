import pg from 'pg'
import { _log } from './utilities.js'
const { Pool, Client } = pg

function connect() {
  const pgPool = new Pool()

  pgPool.on('error', (err, client) => {
    _log('Postgresql pool error', err.message)
  })

  return pgPool
}

function escapeIdentifier(val) {
  return Client.prototype.escapeIdentifier(val)
}

export { connect, escapeIdentifier }
