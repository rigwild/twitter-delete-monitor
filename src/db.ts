import mongoose, { Schema } from 'mongoose'

import { MONGO_URI } from './config'

export interface Tweet {
  tweetId: string
  content: string
  timestamp: Date
  author: {
    accountId: string
    handle: string
    pseudo: string
    avatarUrl: string
    verified: boolean
    followers: number
  }
  status?: {
    deletedDate: Date | null
    deletionPublishedDate: Date | null
  }
  quoted?: Omit<Tweet, 'status'>
}

export type TweetDocument = Tweet & mongoose.Document

export const TweetModel = mongoose.model<TweetDocument>('Tweet', new Schema({
  tweetId: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, required: true },
  author: {
    accountId: { type: String, required: true },
    handle: { type: String, required: true },
    pseudo: { type: String, required: true },
    avatarUrl: { type: String, required: true },
    verified: { type: Boolean, required: true },
    followers: { type: Number, required: true }
  },
  status: {
    deletedDate: { type: Date, required: false, default: null },
    deletionPublishedDate: { type: Date, required: false, default: null }
  },
  quoted: {
    required: false,
    tweetId: String,
    content: String,
    timestamp: Date,
    author: {
      accountId: String,
      handle: String,
      pseudo: String,
      avatarUrl: String,
      verified: Boolean,
      followers: Number
    }
  }
}))

export const connectDb = async () => {
  // Connect to the database
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useFindAndModify: false })
  mongoose.connection.on('error', err => console.error(err.message))
  console.info('The database connection was established')
}
