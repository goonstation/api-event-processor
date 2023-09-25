import pluralize from 'pluralize'
import { connect as connectPg, escapeIdentifier } from './postgres.js'
import { connect as connectRedis, getWorker as getRedisWorker } from './redis.js'
import { expand, columns } from './utilities.js'

// The name that the redis queue that contains our events has
const eventQueue = 'events'
// Interval time between insert batches
const eventLoopSeconds = 1

const pgPool = connectPg()
const redisClient = await connectRedis()

const worker = async (fn) => {
  const redisWorker = await getRedisWorker()

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

const processElement = (element) => {
  let message
  if (typeof element === 'string') {
    try {
      message = JSON.parse(JSON.parse(element))
    } catch (e) {
      console.error(`Unable to parse JSON from:`, element)
      return
    }
  } else {
    message = element
  }

  // Handle batched events (an element containing an array of events)
  if (Array.isArray(message)) {
    for (const nestedMessageElement of message) {
      processElement(nestedMessageElement)
    }
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
}

const queueWorker = worker(processElement)

setInterval(() => {
  const length = eventsToInsert.length
  if (!length) return
  const items = eventsToInsert.splice(0, length)

  const queryPromises = []
  console.log(`[${new Date().toLocaleString()}] Inserting ${items.length} events`)
  for (const item of items) {
    const table = escapeIdentifier(`events_${pluralize(item.type)}`)
    const dataKeys = Object.keys(item.data)
    const queryPromise = pgPool
      .query(
        `INSERT INTO ${table} ${columns(dataKeys)} VALUES ${expand(1, dataKeys.length)}`,
        Object.values(item.data)
      )
      .catch((err) => {
        console.error('Postgresql query error', err.message)
        // TODO: do something with events that failed to insert due to reasons unrelated to data structure (e.g. connection issues)
      })
    queryPromises.push(queryPromise)
  }

  Promise.all(queryPromises).then(() => {
    console.log(`[${new Date().toLocaleString()}] Done`)
  })
}, eventLoopSeconds * 1000)

process.on('exit', (code) => {
  pgPool.end()
  queueWorker.close()
  redisClient.quit()
})
