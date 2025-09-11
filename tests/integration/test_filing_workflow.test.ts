import { describe, expect, it, beforeAll, afterAll } from '@jest/globals'
import { prisma } from '@/lib/db'

describe('Filing Ingestion Workflow - Integration Tests', () => {
  beforeAll(async () => {
    // Set up test database connection
    // In a real scenario, this would use a test database
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.$disconnect()
  })

  it('should complete full filing ingestion workflow', async () => {
    // This test will fail until the complete workflow is implemented
    const testFiling = {
      cik: '0000320193',
      accessionNo: '0000320193-23-000064',
      formType: '10-K'
    }

    // Step 1: Initiate ingestion
    const ingestResponse = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testFiling)
    })

    expect(ingestResponse.status).toBe(200)
    
    const ingestData = await ingestResponse.json()
    expect(ingestData).toMatchObject({
      jobId: expect.any(String),
      status: 'queued'
    })

    // Step 2: Wait for processing (or mock completion)
    // In real implementation, this would involve background job processing
    
    // Step 3: Verify filing was saved to database
    const savedFiling = await prisma.filing.findUnique({
      where: { accessionNo: testFiling.accessionNo }
    })

    expect(savedFiling).toMatchObject({
      accessionNo: testFiling.accessionNo,
      companyId: expect.any(String),
      formType: testFiling.formType,
      processed: true
    })

    // Step 4: Verify diffs were generated
    const diffs = await prisma.diff.findMany({
      where: { filingId: savedFiling!.id }
    })

    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs[0]).toMatchObject({
      sectionType: expect.any(String),
      changeType: expect.any(String),
      summary: expect.any(String),
      materialityScore: expect.any(Number)
    })

    // Step 5: Verify API returns processed data
    const overviewResponse = await fetch(`/api/stocks/AAPL/overview`)
    expect(overviewResponse.status).toBe(200)

    const overviewData = await overviewResponse.json()
    expect(overviewData.latestFiling.accessionNo).toBe(testFiling.accessionNo)
  })

  it('should handle SEC rate limiting gracefully', async () => {
    // Simulate multiple rapid requests to test rate limiting
    const requests = Array.from({ length: 15 }, (_, i) => ({
      cik: '0000320193',
      accessionNo: `0000320193-23-00006${i}`,
      formType: '10-K'
    }))

    const responses = await Promise.allSettled(
      requests.map(filing =>
        fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filing)
        })
      )
    )

    // Should have some rate-limited responses (429) and some queued (200/202)
    const statusCodes = responses.map(r => 
      r.status === 'fulfilled' ? r.value.status : 500
    )

    expect(statusCodes).toContain(429) // Rate limited
    expect(statusCodes).toContain(200) // Some succeeded
  })

  it('should retry failed ingestion jobs', async () => {
    const testFiling = {
      cik: '0000320193',
      accessionNo: '0000320193-23-000064',
      formType: '10-K',
      forceFailure: true // Test parameter to simulate failure
    }

    const ingestResponse = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testFiling)
    })

    expect(ingestResponse.status).toBe(200)
    
    const ingestData = await ingestResponse.json()
    expect(ingestData.jobId).toBeDefined()

    // Simulate job retry mechanism
    // In real implementation, this would be handled by background job processor
    
    // Verify job was retried and eventually succeeded or marked as failed
    const jobStatus = await fetch(`/api/jobs/${ingestData.jobId}/status`)
    const statusData = await jobStatus.json()

    expect(statusData).toMatchObject({
      status: expect.stringMatching(/^(completed|failed)$/),
      attempts: expect.any(Number),
      lastAttempt: expect.any(String)
    })

    if (statusData.status === 'failed') {
      expect(statusData.attempts).toBeGreaterThanOrEqual(3) // Retry policy
    }
  })

  it('should process multiple form types correctly', async () => {
    const filings = [
      { cik: '0000320193', accessionNo: '0000320193-23-000064', formType: '10-K' },
      { cik: '0000320193', accessionNo: '0000320193-23-000032', formType: '10-Q' },
      { cik: '0000320193', accessionNo: '0000320193-23-000012', formType: '8-K' }
    ]

    for (const filing of filings) {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filing)
      })

      expect(response.status).toBe(200)
    }

    // Wait for processing and verify different handling per form type
    const savedFilings = await prisma.filing.findMany({
      where: {
        accessionNo: { in: filings.map(f => f.accessionNo) }
      },
      include: { diffs: true }
    })

    expect(savedFilings).toHaveLength(3)
    
    // Verify form-type specific processing
    const tenK = savedFilings.find(f => f.formType === '10-K')
    const tenQ = savedFilings.find(f => f.formType === '10-Q')
    const eightK = savedFilings.find(f => f.formType === '8-K')

    expect(tenK?.diffs.length).toBeGreaterThan(tenQ?.diffs.length || 0) // 10-K should have more diffs
    expect(eightK?.diffs.some(d => d.changeType === 'MATERIAL_EVENT')).toBe(true) // 8-K should have material events
  })

  it('should handle malformed EDGAR filings gracefully', async () => {
    const malformedFiling = {
      cik: '0000999999',
      accessionNo: '0000999999-23-999999', // Non-existent filing
      formType: '10-K'
    }

    const response = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(malformedFiling)
    })

    expect(response.status).toBe(200) // Job should be queued
    
    const data = await response.json()
    expect(data.jobId).toBeDefined()

    // Verify job fails gracefully with proper error handling
    // In real implementation, background job would handle this
    
    const jobStatus = await fetch(`/api/jobs/${data.jobId}/status`)
    const statusData = await jobStatus.json()

    if (statusData.status === 'failed') {
      expect(statusData.error).toMatchObject({
        code: expect.stringMatching(/^(FILING_NOT_FOUND|PARSING_ERROR|SEC_ERROR)$/),
        message: expect.any(String),
        retryable: expect.any(Boolean)
      })
    }
  })
})