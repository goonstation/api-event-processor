import pluralize from 'pluralize'
import { connect as connectPg, escapeIdentifier } from './postgres.js'
import { connect as connectRedis, getWorker as getRedisWorker } from './redis.js'
import { expand, columns, _log } from './utilities.js'

// The name that the redis queue that contains our events has
const eventQueue = 'events'
// The name of the redis list that we push events to (for metrics)
const eventHistoryList = 'event_history'
// Interval time between insert batches
const eventLoopSeconds = 1

let busyProcessingQueue = false
const pgPool = connectPg()
const redisClient = await connectRedis()
const redisHistoryWorker = await getRedisWorker()

const worker = async (fn) => {
  const redisWorker = await getRedisWorker()
  let closing = false

  const next = async () => {
    if (closing) return
    if (busyProcessingQueue) {
      await new Promise(r => setTimeout(r, 1000)) // a js sleep :v
    } else {
      let message = null
      try {
        message = await redisWorker.brPop(eventQueue, 10)
        if (message) fn(message.element)
      } catch (e) {
        _log(e)
      }
    }
    next()
  }
  next()
  const close = () => {
    closing = true
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
      _log(`Unable to parse JSON from:`, element)
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
    _log(`Got invalid event data:`, message)
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

const queueWorker = await worker(processElement)

const processQueue = () => {
  const length = eventsToInsert.length
  if (busyProcessingQueue || !length) return Promise.resolve()
  busyProcessingQueue = true
  const items = eventsToInsert.splice(0, length)

  const queryPromises = []
  const startTime = new Date().getTime()
  for (const item of items) {
    const table = escapeIdentifier(`events_${pluralize(item.type)}`)
    const dataKeys = Object.keys(item.data)
    const queryPromise = pgPool
      .query(
        `INSERT INTO ${table} ${columns(dataKeys)} VALUES ${expand(1, dataKeys.length)}`,
        Object.values(item.data)
      )
      .then(() => {
        redisHistoryWorker.lPush(eventHistoryList, JSON.stringify(item))
      })
      .catch((err) => {
        _log('Postgresql query error', err.message)
        // TODO: do something with events that failed to insert due to reasons unrelated to data structure (e.g. connection issues)
      })
    queryPromises.push(queryPromise)
  }

  return Promise.all(queryPromises).then(() => {
    busyProcessingQueue = false
    const endTime = new Date().getTime()
    _log(`Inserting ${items.length} events took ${endTime - startTime}ms`)
  })
}

const queueWorkerInterval = setInterval(processQueue, eventLoopSeconds * 1000)

process.on('SIGTERM', () => {
  _log('Shutting down and cleaning up')
  queueWorker.close()
  clearInterval(queueWorkerInterval)
  pgPool.end()
  redisClient.quit()

  // Finish processing any remaining events
  processQueue().then(() => {
    process.exit(0)
  })
})
