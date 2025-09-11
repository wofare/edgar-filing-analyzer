import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/ingest - Contract Tests', () => {
  it('should return 200 and job ID for valid filing ingestion request', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/ingest',
      body: {
        cik: '0000320193',
        accessionNo: '0000320193-23-000064',
        formType: '10-K'
      },
    })

    // This test will fail until the API route is implemented
    const handler = await import('@/app/api/ingest/route')
    await handler.POST(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      jobId: expect.any(String),
      status: 'queued',
      cik: '0000320193',
      accessionNo: '0000320193-23-000064',
      formType: '10-K',
      estimatedCompletion: expect.any(String)
    })
  })

  it('should return 202 for bulk filing ingestion', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/ingest',
      body: {
        filings: [
          { cik: '0000320193', accessionNo: '0000320193-23-000064', formType: '10-K' },
          { cik: '0000789019', accessionNo: '0000789019-23-000031', formType: '10-Q' }
        ]
      },
    })

    const handler = await import('@/app/api/ingest/route')
    await handler.POST(req as any)

    expect(res._getStatusCode()).toBe(202)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      batchId: expect.any(String),
      jobIds: expect.arrayContaining([expect.any(String)]),
      status: 'queued',
      totalFilings: 2
    })
  })

  it('should return 400 for missing required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/ingest',
      body: {
        cik: '0000320193'
        // Missing accessionNo and formType
      },
    })

    const handler = await import('@/app/api/ingest/route')
    await handler.POST(req as any)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Missing required fields',
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        'accessionNo is required',
        'formType is required'
      ])
    })
  })

  it('should return 409 for already processed filing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/ingest',
      body: {
        cik: '0000320193',
        accessionNo: '0000320193-23-000064',
        formType: '10-K'
      },
    })

    const handler = await import('@/app/api/ingest/route')
    await handler.POST(req as any)

    expect(res._getStatusCode()).toBe(409)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Filing already processed',
      code: 'DUPLICATE_FILING',
      existingJobId: expect.any(String)
    })
  })

  it('should return 429 when rate limited', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/ingest',
      body: {
        cik: '0000320193',
        accessionNo: '0000320193-23-000064',
        formType: '10-K'
      },
      headers: {
        'x-rate-limit-test': 'exceeded'
      }
    })

    const handler = await import('@/app/api/ingest/route')
    await handler.POST(req as any)

    expect(res._getStatusCode()).toBe(429)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: expect.any(Number)
    })
  })
})