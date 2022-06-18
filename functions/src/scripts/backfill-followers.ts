import * as admin from 'firebase-admin'

import { initAdmin } from './script-init'
initAdmin()

import { getValues } from '../utils'
import { User } from 'common/user'
import { Follow } from 'common/follow'

const firestore = admin.firestore()

async function backfillFollowers() {
  console.log('Backfilling user follower counts')
  const followerCounts: { [userId: string]: number } = {}
  const users = await getValues<User>(firestore.collection('users'))

  console.log(`Loaded ${users.length} users. Calculating follower counts...`)
  for (const [idx, user] of users.entries()) {
    console.log(`Querying user ${user.id} (${idx + 1}/${users.length})`)
    const followsSnaps = await getValues<Follow>(
      firestore.collection('users').doc(user.id).collection('follows')
    )

    for (const followSnap of followsSnaps) {
      followerCounts[followSnap.userId] =
        (followerCounts[followSnap.userId] || 0) + 1
    }
  }

  console.log(
    `Finished calculating follower counts. Persisting cached follower counts...`
  )
  for (const [idx, user] of users.entries()) {
    console.log(`Persisting user ${user.id} (${idx + 1}/${users.length})`)
    const followerCount = followerCounts[user.id] || 0
    await firestore
      .collection('users')
      .doc(user.id)
      .update({ followerCountCached: followerCount })
  }
}

if (require.main === module) {
  backfillFollowers()
    .then(() => process.exit())
    .catch(console.log)
}
