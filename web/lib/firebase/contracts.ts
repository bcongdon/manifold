import dayjs from 'dayjs'
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  where,
  collection,
  query,
  getDocs,
  orderBy,
  getDoc,
  updateDoc,
  limit,
  startAfter,
} from 'firebase/firestore'
import { range, sortBy, sum } from 'lodash'

import { app } from './init'
import { getValues, listenForValue, listenForValues } from './utils'
import { BinaryContract, Contract, FreeResponseContract } from 'common/contract'
import { getDpmProbability } from 'common/calculate-dpm'
import { createRNG, shuffle } from 'common/util/random'
import { getCpmmProbability } from 'common/calculate-cpmm'
import { formatMoney, formatPercent } from 'common/util/format'
import { DAY_MS } from 'common/util/time'
import { MAX_FEED_CONTRACTS } from 'common/recommended-contracts'
import { Bet } from 'common/bet'
import { Comment } from 'common/comment'
import { ENV_CONFIG } from 'common/envs/constants'
export type { Contract }

export function contractPath(contract: Contract) {
  return `/${contract.creatorUsername}/${contract.slug}`
}

export function homeContractPath(contract: Contract) {
  return `/home?c=${contract.slug}`
}

export function contractUrl(contract: Contract) {
  return `https://${ENV_CONFIG.domain}${contractPath(contract)}`
}

export function contractMetrics(contract: Contract) {
  const { createdTime, resolutionTime, isResolved } = contract

  const createdDate = dayjs(createdTime).format('MMM D')

  const resolvedDate = isResolved
    ? dayjs(resolutionTime).format('MMM D')
    : undefined

  const volumeLabel = `${formatMoney(contract.volume)} bet`

  return { volumeLabel, createdDate, resolvedDate }
}

export function contractPool(contract: Contract) {
  return contract.mechanism === 'cpmm-1'
    ? formatMoney(contract.totalLiquidity)
    : contract.mechanism === 'dpm-2'
    ? formatMoney(sum(Object.values(contract.pool)))
    : 'Empty pool'
}

export function getBinaryProb(contract: BinaryContract) {
  const { pool, resolutionProbability, mechanism } = contract

  return (
    resolutionProbability ??
    (mechanism === 'cpmm-1'
      ? getCpmmProbability(pool, contract.p)
      : getDpmProbability(contract.totalShares))
  )
}

export function getBinaryProbPercent(contract: BinaryContract) {
  return formatPercent(getBinaryProb(contract))
}

export function tradingAllowed(contract: Contract) {
  return (
    !contract.isResolved &&
    (!contract.closeTime || contract.closeTime > Date.now())
  )
}

const db = getFirestore(app)
export const contractCollection = collection(db, 'contracts')
export const contractDocRef = (contractId: string) =>
  doc(db, 'contracts', contractId)

// Push contract to Firestore
export async function setContract(contract: Contract) {
  const docRef = doc(db, 'contracts', contract.id)
  await setDoc(docRef, contract)
}

export async function updateContract(
  contractId: string,
  update: Partial<Contract>
) {
  const docRef = doc(db, 'contracts', contractId)
  await updateDoc(docRef, update)
}

export async function getContractFromId(contractId: string) {
  const docRef = doc(db, 'contracts', contractId)
  const result = await getDoc(docRef)

  return result.exists() ? (result.data() as Contract) : undefined
}

export async function getContractFromSlug(slug: string) {
  const q = query(contractCollection, where('slug', '==', slug))
  const snapshot = await getDocs(q)

  return snapshot.empty ? undefined : (snapshot.docs[0].data() as Contract)
}

export async function deleteContract(contractId: string) {
  const docRef = doc(db, 'contracts', contractId)
  await deleteDoc(docRef)
}

export async function listContracts(creatorId: string): Promise<Contract[]> {
  const q = query(
    contractCollection,
    where('creatorId', '==', creatorId),
    orderBy('createdTime', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => doc.data() as Contract)
}

export async function listTaggedContractsCaseInsensitive(
  tag: string
): Promise<Contract[]> {
  const q = query(
    contractCollection,
    where('lowercaseTags', 'array-contains', tag.toLowerCase()),
    orderBy('createdTime', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => doc.data() as Contract)
}

export async function listAllContracts(
  n: number,
  before?: string
): Promise<Contract[]> {
  let q = query(contractCollection, orderBy('createdTime', 'desc'), limit(n))
  if (before != null) {
    const snap = await getDoc(doc(db, 'contracts', before))
    q = query(q, startAfter(snap))
  }
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => doc.data() as Contract)
}

export function listenForContracts(
  setContracts: (contracts: Contract[]) => void
) {
  const q = query(contractCollection, orderBy('createdTime', 'desc'))
  return listenForValues<Contract>(q, setContracts)
}

const activeContractsQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  where('visibility', '==', 'public'),
  where('volume7Days', '>', 0)
)

export function getActiveContracts() {
  return getValues<Contract>(activeContractsQuery)
}

export function listenForActiveContracts(
  setContracts: (contracts: Contract[]) => void
) {
  return listenForValues<Contract>(activeContractsQuery, setContracts)
}

const inactiveContractsQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  where('closeTime', '>', Date.now()),
  where('visibility', '==', 'public'),
  where('volume24Hours', '==', 0)
)

export function getInactiveContracts() {
  return getValues<Contract>(inactiveContractsQuery)
}

export function listenForInactiveContracts(
  setContracts: (contracts: Contract[]) => void
) {
  return listenForValues<Contract>(inactiveContractsQuery, setContracts)
}

const newContractsQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  where('volume7Days', '==', 0),
  where('createdTime', '>', Date.now() - 7 * DAY_MS)
)

export function listenForNewContracts(
  setContracts: (contracts: Contract[]) => void
) {
  return listenForValues<Contract>(newContractsQuery, setContracts)
}

export function listenForContract(
  contractId: string,
  setContract: (contract: Contract | null) => void
) {
  const contractRef = doc(contractCollection, contractId)
  return listenForValue<Contract>(contractRef, setContract)
}

function chooseRandomSubset(contracts: Contract[], count: number) {
  const fiveMinutes = 5 * 60 * 1000
  const seed = Math.round(Date.now() / fiveMinutes).toString()
  shuffle(contracts, createRNG(seed))
  return contracts.slice(0, count)
}

const hotContractsQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  where('visibility', '==', 'public'),
  orderBy('volume24Hours', 'desc'),
  limit(16)
)

export function listenForHotContracts(
  setHotContracts: (contracts: Contract[]) => void
) {
  return listenForValues<Contract>(hotContractsQuery, (contracts) => {
    const hotContracts = sortBy(
      chooseRandomSubset(contracts, 4),
      (contract) => contract.volume24Hours
    )
    setHotContracts(hotContracts)
  })
}

export async function getHotContracts() {
  const contracts = await getValues<Contract>(hotContractsQuery)
  return sortBy(
    chooseRandomSubset(contracts, 10),
    (contract) => -1 * contract.volume24Hours
  )
}

export async function getContractsBySlugs(slugs: string[]) {
  const q = query(contractCollection, where('slug', 'in', slugs))
  const snapshot = await getDocs(q)
  const contracts = snapshot.docs.map((doc) => doc.data() as Contract)
  return sortBy(contracts, (contract) => -1 * contract.volume24Hours)
}

const topWeeklyQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  orderBy('volume7Days', 'desc'),
  limit(MAX_FEED_CONTRACTS)
)
export async function getTopWeeklyContracts() {
  return await getValues<Contract>(topWeeklyQuery)
}

const closingSoonQuery = query(
  contractCollection,
  where('isResolved', '==', false),
  where('visibility', '==', 'public'),
  where('closeTime', '>', Date.now()),
  orderBy('closeTime', 'asc'),
  limit(6)
)

export async function getClosingSoonContracts() {
  const contracts = await getValues<Contract>(closingSoonQuery)
  return sortBy(
    chooseRandomSubset(contracts, 2),
    (contract) => contract.closeTime
  )
}

const getContractsQuery = (startTime: number, endTime: number) =>
  query(
    collection(db, 'contracts'),
    where('createdTime', '>=', startTime),
    where('createdTime', '<', endTime),
    orderBy('createdTime', 'asc')
  )

const DAY_IN_MS = 24 * 60 * 60 * 1000

export async function getDailyContracts(
  startTime: number,
  numberOfDays: number
) {
  const query = getContractsQuery(
    startTime,
    startTime + DAY_IN_MS * numberOfDays
  )
  const contracts = await getValues<Contract>(query)

  const contractsByDay = range(0, numberOfDays).map(() => [] as Contract[])
  for (const contract of contracts) {
    const dayIndex = Math.floor((contract.createdTime - startTime) / DAY_IN_MS)
    contractsByDay[dayIndex].push(contract)
  }

  return contractsByDay
}

export async function getRecentBetsAndComments(contract: Contract) {
  const contractDoc = doc(db, 'contracts', contract.id)

  const [recentBets, recentComments] = await Promise.all([
    getValues<Bet>(
      query(
        collection(contractDoc, 'bets'),
        where('createdTime', '>', Date.now() - DAY_MS),
        orderBy('createdTime', 'desc'),
        limit(1)
      )
    ),

    getValues<Comment>(
      query(
        collection(contractDoc, 'comments'),
        where('createdTime', '>', Date.now() - 3 * DAY_MS),
        orderBy('createdTime', 'desc'),
        limit(3)
      )
    ),
  ])

  return {
    contract,
    recentBets,
    recentComments,
  }
}
