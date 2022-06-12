import * as admin from 'firebase-admin'

import { chunk } from 'lodash'
import { Contract } from '../../common/contract'
import { PrivateUser, User } from '../../common/user'

export const log = (...args: unknown[]) => {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

export const logMemory = () => {
  const used = process.memoryUsage()
  for (const [k, v] of Object.entries(used)) {
    log(`${k} ${Math.round((v / 1024 / 1024) * 100) / 100} MB`)
  }
}

type UpdateSpec = {
  doc: admin.firestore.DocumentReference
  fields: { [k: string]: unknown }
}

export const writeUpdatesAsync = async (
  db: admin.firestore.Firestore,
  updates: UpdateSpec[]
) => {
  const chunks = chunk(updates, 500) // 500 = Firestore batch limit
  for (const updates of chunks) {
    const batch = db.batch()
    for (const { doc, fields } of updates) {
      batch.update(doc, fields)
    }
    await batch.commit()
  }
}

export const mapAsync = async <T, U>(
  xs: T[],
  fn: (x: T) => Promise<U>,
  concurrency = 100
) => {
  const results = []
  const chunks = chunk(xs, concurrency)
  for (let i = 0; i < chunks.length; i++) {
    log(`${i * concurrency}/${xs.length} processed...`)
    results.push(...(await Promise.all(chunks[i].map(fn))))
  }
  return results
}

export const isProd =
  admin.instanceId().app.options.projectId === 'mantic-markets'

export const getDoc = async <T>(collection: string, doc: string) => {
  const snap = await admin.firestore().collection(collection).doc(doc).get()

  return snap.exists ? (snap.data() as T) : undefined
}

export const getValue = async <T>(ref: admin.firestore.DocumentReference) => {
  const snap = await ref.get()

  return snap.exists ? (snap.data() as T) : undefined
}

export const getValues = async <T>(query: admin.firestore.Query) => {
  const snap = await query.get()
  return snap.docs.map((doc) => doc.data() as T)
}

export const getContract = (contractId: string) => {
  return getDoc<Contract>('contracts', contractId)
}

export const getUser = (userId: string) => {
  return getDoc<User>('users', userId)
}

export const getPrivateUser = (userId: string) => {
  return getDoc<PrivateUser>('private-users', userId)
}

export const getUserByUsername = async (username: string) => {
  const snap = await firestore
    .collection('users')
    .where('username', '==', username)
    .get()

  return snap.empty ? undefined : (snap.docs[0].data() as User)
}

const firestore = admin.firestore()

const updateUserBalance = (
  userId: string,
  delta: number,
  isDeposit = false
) => {
  return firestore.runTransaction(async (transaction) => {
    const userDoc = firestore.doc(`users/${userId}`)
    const userSnap = await transaction.get(userDoc)
    if (!userSnap.exists) return
    const user = userSnap.data() as User

    const newUserBalance = user.balance + delta

    // if (newUserBalance < 0)
    //   throw new Error(
    //     `User (${userId}) balance cannot be negative: ${newUserBalance}`
    //   )

    if (isDeposit) {
      const newTotalDeposits = (user.totalDeposits || 0) + delta
      transaction.update(userDoc, { totalDeposits: newTotalDeposits })
    }

    transaction.update(userDoc, { balance: newUserBalance })
  })
}

export const payUser = (userId: string, payout: number, isDeposit = false) => {
  if (!isFinite(payout)) throw new Error('Payout is not finite: ' + payout)

  return updateUserBalance(userId, payout, isDeposit)
}

export const chargeUser = (
  userId: string,
  charge: number,
  isAnte?: boolean
) => {
  if (!isFinite(charge) || charge <= 0)
    throw new Error('User charge is not positive: ' + charge)

  return updateUserBalance(userId, -charge, isAnte)
}
