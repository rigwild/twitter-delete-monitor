import ms from 'ms'

import { TweetModel } from '../db'

export default async ({ delete: deleted }: any) => {
  // Update `status.deletedDate` in database
  const res = await TweetModel.findOneAndUpdate({ tweetId: deleted.status.id_str }, {
    $set: {
      status: {
        deletedDate: new Date(parseInt(deleted.timestamp_ms, 10))
      }
    }
  }, { new: true, runValidators: true })

  if (!res || !res.status || !res.status.deletedDate) return console.info(`${new Date().toJSON()} - Deleted tweet id=${deleted.status.id_str} by userId=${deleted.status.user_id_str} was not found in database`)

  const deletedAfter = ms(res.status.deletedDate.getTime() - res.timestamp.getTime())
  console.info(`${new Date().toJSON()} - Deleted tweet id=${deleted.status.id_str} by "${res.author.pseudo}" (@${res.author.handle}) was found in database. Deleted after ${deletedAfter}: ${res.content}`)
}
