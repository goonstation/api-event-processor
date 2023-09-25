import pg from 'pg'
const { Pool, Client } = pg

function connect() {
  const pgPool = new Pool()

  pgPool.on('error', (err, client) => {
    console.error('Postgresql pool error', err.message)
  })

  return pgPool
}

function escapeIdentifier(val) {
  return Client.prototype.escapeIdentifier(val)
}

export { connect, escapeIdentifier }
