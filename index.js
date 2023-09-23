import Redis from 'redis'
import pg from 'pg'
import pluralize from 'pluralize'
const { Pool, Client } = pg

// The name that the redis queue that contains our events has
const eventQueue = 'events'
// Interval time between insert batches
const eventLoopSeconds = 1

const pgPool = new Pool()
pgPool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

const redisConnectionDetails = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
}
if (process.env.REDIS_PASSWORD) {
  redisConnectionDetails.password = process.env.REDIS_PASSWORD
}
const redisClient = Redis.createClient({
  socket: redisConnectionDetails,
})
redisClient.on('error', (err) => console.log('Redis Client Error', err))
await redisClient.connect()

const worker = async (fn) => {
  const redisWorker = redisClient.duplicate()
  redisWorker.on('error', (err) => console.error(err))
  await redisWorker.connect()

  const next = async () => {
    let message = null
    try {
      message = await redisWorker.brPop(eventQueue, 10)
      if (message) fn(message.element)
    } catch (e) {
      console.log(e)
    }
    next()
  }
  next()
  const close = () => {
    redisWorker.quit()
  }
  return { close: close }
}

const eventsToInsert = []

const redisWorker = worker((element) => {
  let message
  try {
    message = JSON.parse(JSON.parse(element))
  } catch (e) {
    console.error(`Unable to parse JSON from:`, element)
    return
  }

  // Some validation
  if (!message.type || !message.round_id || !message.created_at || !message.data) {
    console.error(`Got invalid event data:`, message)
    return
  }

  eventsToInsert.push({
    type: message.type,
    data: {
      round_id: message.round_id,
      ...(message.player_id && { player_id: message.player_id }),
      created_at: message.created_at,
      ...message.data,
    },
  })
})

// expand(3, 2) returns "($1, $2), ($3, $4), ($5, $6)"
function expand(rowCount, columnCount, startAt = 1) {
  let index = startAt
  return Array(rowCount)
    .fill(0)
    .map(
      (v) =>
        `(${Array(columnCount)
          .fill(0)
          .map((v) => `$${index++}`)
          .join(', ')})`
    )
    .join(', ')
}

// flatten([[1, 2], [3, 4]]) returns [1, 2, 3, 4]
function flatten(arr) {
  const newArr = []
  arr.forEach((v) => {
    console.log(v)
    v.forEach((p) => newArr.push(p))
  })
  return newArr
}

// ['foo', 'bar'] to ("foo", "bar")
function columns(data) {
  const cols = []
  data.forEach((key) => {
    cols.push(Client.prototype.escapeIdentifier(key))
  })
  return `(${cols.join(', ')})`
}

setInterval(() => {
  const length = eventsToInsert.length
  if (!length) return
  const items = eventsToInsert.splice(0, length)

  console.log(`[${new Date().toLocaleString()}] Inserting ${items.length} events`)
  for (const item of items) {
    const table = Client.prototype.escapeIdentifier(`events_${pluralize(item.type)}`)
    const dataKeys = Object.keys(item.data)
    pgPool
      .query(
        `INSERT INTO ${table} ${columns(dataKeys)} VALUES ${expand(1, dataKeys.length)}`,
        Object.values(item.data)
      )
      .catch((err) => {
        console.error(err.message)
      })
  }
  console.log(`[${new Date().toLocaleString()}] Done`)

  // pgPool
  //   .query(
  //     `INSERT INTO game_events (round_id, player_id, type, data, created_at) VALUES ${expand(
  //       items.length,
  //       5
  //     )}`,
  //     flatten(items)
  //   )
  //   .catch((err) => {
  //     console.error(err.message)
  //   })
}, eventLoopSeconds * 1000)

process.on('exit', (code) => {
  pgPool.end()
  redisWorker.close()
  redisClient.quit()
})
