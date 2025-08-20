import { scope } from '../internal/scope'
import { QueryTailImpl } from '../internal/QueryTailImpl'
import { StoreExecutor } from '../internal/StoreExecutor'
import { runMain } from '../internal/MainStore'

// Mock external services
const mockNotificationService = {
  push: jest.fn(),
}

// Core Twitter events - just the essentials
const USER_REGISTERED = 'USER_REGISTERED'
const TWEET_POSTED = 'TWEET_POSTED'
const TWEET_LIKED = 'TWEET_LIKED'
const USER_FOLLOWED = 'USER_FOLLOWED'
const HASHTAG_USED = 'HASHTAG_USED'
const USER_MENTIONED = 'USER_MENTIONED'
const NOTIFICATION_SENT = 'NOTIFICATION_SENT'

type TwitterEvent =
  | { type: typeof USER_REGISTERED, userId: string, username: string, email: string, timestamp: number }
  | { type: typeof TWEET_POSTED, id: string, userId: string, text: string, hashtags: string[], mentions: string[], timestamp: number }
  | { type: typeof TWEET_LIKED, tweetId: string, userId: string, timestamp: number }
  | { type: typeof USER_FOLLOWED, followerId: string, followeeId: string, timestamp: number }
  | { type: typeof HASHTAG_USED, hashtag: string, tweetId: string, timestamp: number }
  | { type: typeof USER_MENTIONED, mentionedUserId: string, tweetId: string, mentioningUserId: string, timestamp: number }
  | { type: typeof NOTIFICATION_SENT, userId: string, action: 'like' | 'follow' | 'mention', message: string, timestamp: number }

describe('Twitter Clone', () => {
  const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('demonstrates event-driven architecture patterns', async () => {
    const { query, join, store, action } = scope<TwitterEvent>()

    // Simple monolithic store - everything together
    const twitterStore = store({
      // Actions - trigger events
      registerUser: action((username: string, email: string) => ({
        type: USER_REGISTERED,
        userId: `user-${Date.now()}`,
        username,
        email,
        timestamp: Date.now()
      })).internal(),

      postTweet: action((userId: string, text: string) => {
        // Extract hashtags and mentions from text
        const hashtags = (text || '').match(/#\w+/g) || []
        const mentions = (text || '').match(/@\w+/g) || []
        return {
          type: TWEET_POSTED,
          id: `tweet-${Date.now()}`,
          userId,
          text: text || '',
          hashtags: hashtags.map(h => h.slice(1)),
          mentions: mentions.map(m => m.slice(1)),
          timestamp: Date.now()
        }
      }).internal(),

      likeTweet: action((tweetId: string, userId: string) => ({
        type: TWEET_LIKED,
        tweetId,
        userId,
        timestamp: Date.now()
      })).internal(),

      // Queries - materialize state from events
      userProfiles: query(USER_REGISTERED).by.userId,
      allTweets: query(TWEET_POSTED).by.id,

      // Event generation - tweets create hashtag events automatically
      hashtagExtractor: query(TWEET_POSTED)
        .filter(tweet => tweet.hashtags.length > 0)
        .mapArray(tweet => tweet.hashtags.map(hashtag => ({
          type: HASHTAG_USED,
          hashtag,
          tweetId: tweet.id,
          timestamp: tweet.timestamp
        })))
        .internal(),

      // Join pattern - combine tweet with engagement data
      tweetMetrics: join({
        tweet: query(TWEET_POSTED).by.id,
        likes: query(TWEET_LIKED).by.tweetId.optional(),
      })
        .map(({ tweet, likes }) => ({
          ...tweet,
          likeCount: Object.keys(likes || {}).length,
        })),

      // Multi-source notifications
      notificationSystem: query(
        query(TWEET_LIKED).map(like => ({
          userId: 'tweet-author',
          action: 'like' as const,
          message: 'Someone liked your tweet',
          timestamp: like.timestamp
        })),
        query(USER_FOLLOWED).map(follow => ({
          userId: follow.followeeId,
          action: 'follow' as const,
          message: `${follow.followerId} started following you`,
          timestamp: follow.timestamp
        }))
      )
        .evalTap(async notification => {
          // Side effect - send push notification
          await mockNotificationService.push(notification.userId, notification.message)
        })
        .internal(NOTIFICATION_SENT),
    })

    const main = runMain({ twitterStore })

    // Test the event flow
    const user1 = await main.actions(twitterStore).registerUser('alice', 'alice@example.com')
    const user2 = await main.actions(twitterStore).registerUser('bob', 'bob@example.com')
    await timeout(0)

    // Verify users were created
    const profiles = await main.readQuery(twitterStore.userProfiles)
    expect(profiles[user1.userId]).toBeDefined()
    expect(profiles[user1.userId].username).toBe('alice')

    // Post tweet with hashtag - triggers event cascade
    const tweet = await main.actions(twitterStore).postTweet(user2.userId, 'Hello #world!')
    await timeout(0)

    // Verify tweet was stored
    const tweets = await main.readQuery(twitterStore.allTweets)
    expect(tweets[tweet.id]).toBeDefined()
    expect(tweets[tweet.id].hashtags).toContain('world')

    // Like the tweet - triggers metrics update and notification
    await main.actions(twitterStore).likeTweet(tweet.id, user1.userId)
    await timeout(0)

    // Verify metrics were calculated
    const metrics = await main.readQuery(twitterStore.tweetMetrics)
    expect(metrics[tweet.id]).toBeDefined()
    expect(metrics[tweet.id].likeCount).toBeGreaterThanOrEqual(1)

    // Verify notification was sent
    expect(mockNotificationService.push).toHaveBeenCalled()

    // KEY INSIGHTS DEMONSTRATED:
    // 1. Event Flow: One action (postTweet) triggers multiple derived events
    // 2. Reactive Updates: All queries update automatically when events happen
    // 3. Side Effects: Notifications sent without manual coordination
    // 4. Join Patterns: Combine multiple event streams for metrics
    // 5. Real-time: Everything happens immediately, no batch processing
  })
})
