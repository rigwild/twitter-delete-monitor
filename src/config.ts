import path from 'path'
import dotenvSafe from 'dotenv-safe'

// Load environment configuration
dotenvSafe.config({
  path: path.resolve(__dirname, '..', '.env'),
  example: path.resolve(__dirname, '..', '.env.example')
})

export const {
  APP_CONSUMER_KEY,
  APP_CONSUMER_SECRET,
  APP_ACCESS_TOKEN,
  APP_ACCESS_TOKEN_SECRET,
  USER_ACCESS_TOKEN,
  USER_ACCESS_TOKEN_SECRET,
  MONGO_URI,
  TWEETING_SERVICE_CRON_TIME
} = <{ [key: string]: string }>process.env
