import Twit from 'twit'
import path from 'path'
import puppeteer from 'puppeteer'
import fetch from 'node-fetch'
import { CronJob } from 'cron'
import fs from 'fs'
import ms from 'ms'

import { TWEETING_SERVICE_CRON_TIME, APP_CONSUMER_KEY, APP_CONSUMER_SECRET, USER_ACCESS_TOKEN, USER_ACCESS_TOKEN_SECRET, MANUAL_LOGIN_TWITTER_USERNAME, MANUAL_LOGIN_TWITTER_PASSWORD } from './config'
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
 * Get a random face emoji
 * @returns An emoji
 */
const randomEmoji = () => '😀 😁 😂 🤣 😃 😄 😅 😆 😉 😊 😋 😎 😍 😘 🥰 😗 😙 😚 ☺️ 🙂 🤗 🤩 🤔 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 🤐 😯 😪 😫 😴 😌 😛 😜 😝 🤤 😒 😓 😔 😕 🙃 🤑 😲 ☹️ 🙁 😖 😞 😟 😤 😢 😭 😦 😧 😨 😩 🤯 😬 😰 😱 🥵 🥶 😳 🤪 😵 😡 😠 🤬 😷 🤒 🤕 🤢 🤮 🤧 😇 🤠 🤡 🥳 🥴 🥺 🤥 🤫 🤭 🧐 🤓 😈 👿 👹 👺 💀 👻 👽 🤖 💩 😺 😸 😹 😻 😼 😽 🙀 😿 😾'
  .split(' ')
  .find((_, i, ar) => Math.random() <= 1 / (ar.length - i))

const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

const connectChromeTwitter = async (username: string, password: string) => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      isMobile: true,
      isLandscape: false,
      width: 375,
      height: 667,
      deviceScaleFactor: 2
    },
    args: ['--no-sandbox']
  })

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1')

  await page.goto('https://twitter.com/login')

  await delay(2000)
  await page.click('input[name="session[username_or_email]"]')
  await page.keyboard.type(username)
  await page.click('input[name="session[password]"]')
  await page.keyboard.type(password)
  await page.keyboard.press('Enter')

  await delay(2000)
  return page
}

/**
 * Tweet with an image
 * @param imagePath Path to the image
 * @param message Message to post with the image
 * @returns Added tweet API response
 */
const tweetMedia = async (page: puppeteer.Page, imagePath: string, message: string): Promise<void> => {
  // Go to tweet page
  await page.goto('https://mobile.twitter.com/compose/tweet')
  await delay(2000)
  // Write the tweet
  await page.click('textarea')
  await page.keyboard.type(message)
  await delay(200)
  await page.mouse.click(100, 120)
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click('div[aria-label="Add photos or video"]')
  ])
  await fileChooser.accept([imagePath])
  await page.click('div[data-testid="tweetButton"]')
  await delay(7500)
}

/**
 * Starts the tweeting service every 5 minutes
 */
export default async () => {
  console.info('The tweeting service was started')
  const page = await connectChromeTwitter(MANUAL_LOGIN_TWITTER_USERNAME, MANUAL_LOGIN_TWITTER_PASSWORD)
  console.log('Chrome logged in twitter, idling waiting for tweets to publish')

  new CronJob(TWEETING_SERVICE_CRON_TIME, async () => {
    try {
      const notTweetedYet = await TweetModel.findOne({
        'status.deletedDate': { $ne: null },
        'status.deletionPublishedDate': null
      })
      if (!notTweetedYet || !notTweetedYet.status || !notTweetedYet.status.deletedDate)
        return console.info('No deleted tweet to post')

      console.info(`${new Date().toJSON()} - Starting to publish the deleted tweet id=${notTweetedYet.tweetId} by @${notTweetedYet.author.handle}`)
      // Generate the tweet
      const generatedMediaPath = await generateTweetAndSave(notTweetedYet)

      // Tweet
      const deletedAfter = ms(notTweetedYet.status.deletedDate.getTime() - notTweetedYet.timestamp.getTime())
      await tweetMedia(page, generatedMediaPath, `Supprimé par @${notTweetedYet.author.handle} après ${deletedAfter} ${randomEmoji()} #deletedFrenchTweets`)

      // Set the tweet as published in database
      await TweetModel.findByIdAndUpdate(notTweetedYet._id, {
        'status.deletionPublishedDate': new Date()
      })
      console.info(`${new Date().toJSON()} - Finishing to publish the deleted tweet id=${notTweetedYet.tweetId} by @${notTweetedYet.author.handle}`)
    }
    catch (error) {
      console.error(error)
    }
  }, undefined, true, 'Europe/Paris', undefined, false)
}
