import Twit from 'twit'

import { APP_CONSUMER_KEY, APP_CONSUMER_SECRET, APP_ACCESS_TOKEN, APP_ACCESS_TOKEN_SECRET } from '../config'
import monitoredAccounts from '../monitoredAccounts'

import monitorHandler from './monitorHandler'
import deleteHandler from './deleteHandler'

// Create the bot instance
export const bot = new Twit({
  consumer_key: APP_CONSUMER_KEY,
  consumer_secret: APP_CONSUMER_SECRET,
  access_token: APP_ACCESS_TOKEN,
  access_token_secret: APP_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true
})

/** Start the bot */
export const start = async () => {
  console.log(`The bot is monitoring ${monitoredAccounts.length} Twitter accounts\n`)

  const stream = bot.stream('statuses/filter', { follow: monitoredAccounts })

  // Save tweets if on monitored accounts list
  stream.on('tweet', monitorHandler)

  // Mark a tweet as delete if found in database
  stream.on('delete', deleteHandler)
}
