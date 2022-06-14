import * as admin from 'firebase-admin'

admin.initializeApp()

// v1
// export * from './keep-awake'
export * from './transact'
export * from './resolve-market'
export * from './stripe'
export * from './create-user'
export * from './create-group'
export * from './create-answer'
export * from './on-create-bet'
export * from './on-create-comment'
export * from './on-group-follow'
export * from './on-group-delete'
export * from './on-view'
export * from './unsubscribe'
export * from './update-contract-metrics'
export * from './update-user-metrics'
export * from './update-recommendations'
export * from './backup-db'
export * from './change-user-info'
export * from './market-close-notifications'
export * from './add-liquidity'
export * from './on-create-answer'
export * from './on-update-contract'
export * from './on-create-contract'
export * from './on-follow-user'
export * from './on-create-liquidity-provision'

// v2
export * from './health'
export * from './place-bet'
export * from './sell-bet'
export * from './sell-shares'
export * from './create-contract'
export * from './withdraw-liquidity'
