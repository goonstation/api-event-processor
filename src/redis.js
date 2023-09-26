import Redis from 'redis'
import { _log } from './utilities.js'

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
    _log('Redis client connected')
  })
  newClient.on('error', (err) => {
    _log('Redis client error', err.message)
  })
  newClient.on('reconnecting', () => {
    _log('Redis client reconnecting')
  })

  await newClient.connect()
  redisClient = newClient
  return redisClient
}

const getWorker = async () => {
  const newWorker = redisClient.duplicate()
  newWorker.on('ready', () => {
    _log('Redis worker connected')
  })
  newWorker.on('error', (err) => {
    _log('Redis worker error', err.message)
  })
  newWorker.on('reconnecting', () => {
    _log('Redis worker reconnecting')
  })

  await newWorker.connect()
  return newWorker
}

export { connect, getWorker }
