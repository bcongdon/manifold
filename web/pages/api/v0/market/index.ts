import { NextApiRequest, NextApiResponse } from 'next'
import {
  CORS_ORIGIN_MANIFOLD,
  CORS_ORIGIN_LOCALHOST,
} from 'common/envs/constants'
import { applyCorsHeaders } from 'web/lib/api/cors'
import { assertHTTPMethod } from 'web/lib/api/validation'
import { fetchBackend, forwardResponse } from 'web/lib/api/proxy'

export const config = { api: { bodyParser: false } }

export default async function route(req: NextApiRequest, res: NextApiResponse) {
  if (!assertHTTPMethod(req, res, 'POST')) {
    return
  }

  await applyCorsHeaders(req, res, {
    origin: [CORS_ORIGIN_MANIFOLD, CORS_ORIGIN_LOCALHOST],
    methods: 'POST',
  })
  try {
    const backendRes = await fetchBackend(req, 'createmarket')
    await forwardResponse(res, backendRes)
  } catch (err) {
    console.error('Error talking to cloud function: ', err)
    res.status(500).json({ message: 'Error communicating with backend.' })
  }
}
