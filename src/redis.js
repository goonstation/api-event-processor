import Redis from 'redis'

let redisClient

const connect = async () => {
  const redisConnectionDetails = {
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    }
  }
  if (process.env.REDIS_PASSWORD) {
    redisConnectionDetails.password = process.env.REDIS_PASSWORD
  }

  const newClient = Redis.createClient(redisConnectionDetails)
  newClient.on('ready', () => {
    console.log('Redis client connected')
  })
  newClient.on('error', (err) => {
    console.log('Redis client error', err.message)
  })
  newClient.on('reconnecting', () => {
    console.log('Redis client reconnecting')
  })

  await newClient.connect()
  redisClient = newClient
  return redisClient
}

const getWorker = async () => {
  const newWorker = redisClient.duplicate()
  newWorker.on('ready', () => {
    console.log('Redis worker connected')
  })
  newWorker.on('error', (err) => {
    console.log('Redis worker error', err.message)
  })
  newWorker.on('reconnecting', () => {
    console.log('Redis worker reconnecting')
  })

  await newWorker.connect()
  return newWorker
}

export { connect, getWorker }
