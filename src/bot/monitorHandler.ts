import { TweetModel, Tweet } from '../db'

// let triggerCount = 0

export default async (tweet: any) => {
  // triggerCount++
  // console.log(`${triggerCount.toString().padStart(9, '0')} - Tweet stream event https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`)

  // Ignore retweets and responses
  if (tweet.retweeted_status || tweet.in_reply_to_status_id || tweet.in_reply_to_user_id) return

  const tweetData: Tweet = {
    tweetId: tweet.id_str,
    content: tweet.text,
    quoted: tweet.is_quote_status ? {
      tweetId: tweet.quoted_status.id_str,
      content: tweet.quoted_status.text,
      timestamp: new Date(tweet.quoted_status.created_at),
      author: {
        accountId: tweet.quoted_status.user.id_str,
        handle: tweet.quoted_status.user.screen_name,
        pseudo: tweet.quoted_status.user.name,
        avatarUrl: tweet.quoted_status.user.profile_image_url_https,
        verified: tweet.quoted_status.user.verified,
        followers: tweet.quoted_status.user.followers_count
      }
    } : undefined,
    timestamp: new Date(parseInt(tweet.timestamp_ms, 10)),
    author: {
      accountId: tweet.user.id_str,
      handle: tweet.user.screen_name,
      pseudo: tweet.user.name,
      avatarUrl: tweet.user.profile_image_url_https,
      verified: tweet.user.verified,
      followers: tweet.user.followers_count
    }
  }

  // Do not log medias as it could contain sexual/bannable content
  // console.info(tweet.entities.media)

  await TweetModel.create(tweetData)
  console.info(`${new Date().toJSON()} - A tweet by "${tweetData.author.pseudo}" (@${tweetData.author.handle}) was saved from https://twitter.com/${tweetData.author.handle}/status/${tweetData.tweetId}`)
}
