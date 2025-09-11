import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/filings/[cik]/[accession] - Contract Tests', () => {
  it('should return 200 with filing diff data', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/0000320193/0000320193-23-000064',
      query: { cik: '0000320193', accession: '0000320193-23-000064' },
    })

    // This test will fail until the API route is implemented
    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      filing: expect.objectContaining({
        accessionNo: '0000320193-23-000064',
        cik: '0000320193',
        companyName: expect.any(String),
        ticker: expect.any(String),
        formType: expect.any(String),
        filedDate: expect.any(String),
        reportDate: expect.any(String),
        description: expect.any(String)
      }),
      summary: expect.objectContaining({
        totalChanges: expect.any(Number),
        materialChanges: expect.any(Number),
        overallImpact: expect.any(String),
        keyHighlights: expect.arrayContaining([expect.any(String)])
      }),
      diffs: expect.arrayContaining([
        expect.objectContaining({
          sectionType: expect.any(String),
          changeType: expect.any(String),
          summary: expect.any(String),
          materialityScore: expect.any(Number),
          oldContent: expect.any(String),
          newContent: expect.any(String),
          impact: expect.any(String)
        })
      ]),
      materialityTags: expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          label: expect.any(String),
          severity: expect.any(String)
        })
      ])
    })
  })

  it('should return diff with section filtering', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/0000320193/0000320193-23-000064?section=business',
      query: { 
        cik: '0000320193', 
        accession: '0000320193-23-000064',
        section: 'business'
      },
    })

    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    data.diffs.forEach((diff: any) => {
      expect(diff.sectionType.toLowerCase()).toContain('business')
    })
  })

  it('should return diff with materiality threshold filtering', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/0000320193/0000320193-23-000064?minMaterialityScore=0.7',
      query: { 
        cik: '0000320193', 
        accession: '0000320193-23-000064',
        minMaterialityScore: '0.7'
      },
    })

    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    data.diffs.forEach((diff: any) => {
      expect(diff.materialityScore).toBeGreaterThanOrEqual(0.7)
    })
  })

  it('should return 404 for non-existent filing', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/0000000000/0000000000-00-000000',
      query: { cik: '0000000000', accession: '0000000000-00-000000' },
    })

    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(404)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Filing not found',
      code: 'FILING_NOT_FOUND'
    })
  })

  it('should return 400 for invalid CIK format', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/invalid/0000320193-23-000064',
      query: { cik: 'invalid', accession: '0000320193-23-000064' },
    })

    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Invalid CIK format',
      code: 'INVALID_CIK_FORMAT'
    })
  })

  it('should return 202 when filing is still being processed', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings/0000320193/0000320193-23-000064?processing=true',
      query: { 
        cik: '0000320193', 
        accession: '0000320193-23-000064',
        processing: 'true'
      },
    })

    const handler = await import('@/app/api/filings/[cik]/[accession]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(202)
    expect(JSON.parse(res._getData())).toMatchObject({
      status: 'processing',
      message: 'Filing diff is being generated',
      estimatedCompletion: expect.any(String),
      jobId: expect.any(String)
    })
  })
})