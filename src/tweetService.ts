import Twit from 'twit'
import path from 'path'
import fetch from 'node-fetch'
import { CronJob } from 'cron'
import fs from 'fs'
import ms from 'ms'

import { TWEETING_SERVICE_CRON_TIME, APP_CONSUMER_KEY, APP_CONSUMER_SECRET, USER_ACCESS_TOKEN, USER_ACCESS_TOKEN_SECRET } from './config'
import { TweetModel } from './db'

// Create the bot instance
export const bot = new Twit({
  consumer_key: APP_CONSUMER_KEY,
  consumer_secret: APP_CONSUMER_SECRET,
  access_token: USER_ACCESS_TOKEN,
  access_token_secret: USER_ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true
})

/**
 * Generate a tweet image and download it
 * @param dbTweetDataRaw Tweet data from DB
 * @returns Path to the generated image
 */
const generateTweetAndSave = async (dbTweetDataRaw: any): Promise<string> => {
  const dbTweetData = dbTweetDataRaw.toObject()
  const tweet = {
    pseudo: dbTweetData.author.pseudo,
    handle: dbTweetData.author.handle,
    verified: dbTweetData.author.verified,
    avatar: dbTweetData.author.avatarUrl,
    content: dbTweetData.content,
    date: dbTweetData.timestamp,
    quoted: dbTweetData.quoted ? {
      pseudo: dbTweetData.quoted.author.pseudo,
      handle: dbTweetData.quoted.author.handle,
      verified: dbTweetData.quoted.author.verified,
      avatar: dbTweetData.quoted.author.avatarUrl,
      content: dbTweetData.quoted.content,
      date: dbTweetData.quoted.timestamp
    } : undefined
  }

  // Create the uri (encodeURI is important as stringified JSON can contain invalid query characters)
  const uri = encodeURI(`https://tweet-generator.now.sh/screenshot?style=no-stats&tweetData=${JSON.stringify(tweet).replace('#', encodeURIComponent('#'))}`)
  const { body } = await fetch(uri)
    .then(async res => {
      // The endpoint returned errors, throw
      if (!res.ok) throw (await res.json()).errors.join(', ')
      return res
    })

  // Save the response body to an image file
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(path.resolve(__dirname, 'generatedTweet.png'))
    body.pipe(fileStream)
    body.on('error', (err: any) => reject(err))
    fileStream.on('finish', () => resolve(<string>fileStream.path))
  })
}

/**
 * Tweet with an image
 * @param imagePath Path to the image
 * @param message Message to post with the image
 * @returns Added tweet API response
 */
const tweetMedia = async (imagePath: string, message: string): Promise<{ [key: string]: any }> =>
  new Promise((resolve, reject) => {
    const b64content = fs.readFileSync(imagePath, { encoding: 'base64' })

    // Upload the media
    bot.post('media/upload', { media_data: b64content }, (err, reply: any) => {
      if (err) return reject(err)

      // Tweet with the media
      bot.post('statuses/update', { status: message, media_ids: [reply.media_id_string] }, (err, reply) => {
        if (err) return reject(err)
        else return resolve(reply)
      })
    })
  })

/**
 * Get a random face emoji
 * @returns An emoji
 */
const randomEmoji = () => '😀 😁 😂 🤣 😃 😄 😅 😆 😉 😊 😋 😎 😍 😘 🥰 😗 😙 😚 ☺️ 🙂 🤗 🤩 🤔 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 🤐 😯 😪 😫 😴 😌 😛 😜 😝 🤤 😒 😓 😔 😕 🙃 🤑 😲 ☹️ 🙁 😖 😞 😟 😤 😢 😭 😦 😧 😨 😩 🤯 😬 😰 😱 🥵 🥶 😳 🤪 😵 😡 😠 🤬 😷 🤒 🤕 🤢 🤮 🤧 😇 🤠 🤡 🥳 🥴 🥺 🤥 🤫 🤭 🧐 🤓 😈 👿 👹 👺 💀 👻 👽 🤖 💩 😺 😸 😹 😻 😼 😽 🙀 😿 😾'
  .split(' ')
  .find((_, i, ar) => Math.random() <= 1 / (ar.length - i))


let tweetCount = 0
let rateLimit = {
  nextTimeBlock: new Date(Date.now() + 1000 * 60 * 60 * 3),
  usedLimit: 0
}

/**
 * Starts the tweeting service every 5 minutes
 */
export default () => {
  console.info('The tweeting service was started')

  new CronJob(TWEETING_SERVICE_CRON_TIME, async () => {
    try {
      // Check the rate limit status
      if (new Date() > rateLimit.nextTimeBlock) {
        // Time block passed, reset the counter
        rateLimit.nextTimeBlock = new Date(Date.now() + 1000 * 60 * 60 * 3)
        rateLimit.usedLimit = 0
      }
      else if (rateLimit.usedLimit >= 300)
        return console.info(`${new Date().toJSON()} - Tweet service is paused while rate limit resets`)

      // Find the tweet to publish
      const notTweetedYet = await TweetModel.findOne({
        'status.deletedDate': { $ne: null },
        'status.deletionPublishedDate': null
      })
      if (!notTweetedYet || !notTweetedYet.status || !notTweetedYet.status.deletedDate)
        return console.info(`${new Date().toJSON()} - No deleted tweet to post`)

      // Generate the tweet
      const generatedMediaPath = await generateTweetAndSave(notTweetedYet)

      // Tweet
      const deletedAfter = ms(notTweetedYet.status.deletedDate.getTime() - notTweetedYet.timestamp.getTime())
      await tweetMedia(generatedMediaPath, `Supprimé par @${notTweetedYet.author.handle} après ${deletedAfter} ${randomEmoji()} #deletedFrenchTweets`)

      // Set the tweet as published in database
      await TweetModel.findByIdAndUpdate(notTweetedYet._id, {
        'status.deletionPublishedDate': new Date()
      })
      console.info(`${new Date().toJSON()} - Tweet: ${tweetCount} - Rate limit: ${rateLimit.usedLimit} - Published deleted tweet id=${notTweetedYet.tweetId} by ${notTweetedYet.author.pseudo} (@${notTweetedYet.author.handle} - id=${notTweetedYet.author.accountId})`)

      // Mark one API usage
      rateLimit.usedLimit++
      tweetCount++
    }
    catch (error) {
      console.error(error)
    }
  }, undefined, true, 'Europe/Paris', undefined, false)
}
