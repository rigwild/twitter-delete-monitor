import { start as botStart } from './bot'
import { connectDb } from './db'
import tweetService from './tweetService'

const setup = async () => {
  // Connect to the database and init its content
  await connectDb()

  // Start the bot
  await botStart()

  // Start the tweeting service
  tweetService()
}

setup()
