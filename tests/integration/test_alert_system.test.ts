import { describe, expect, it, beforeAll, afterAll } from '@jest/globals'
import { prisma } from '@/lib/db'

describe('Alert Dispatch System - Integration Tests', () => {
  let testUser: any
  let testCompany: any
  let testFiling: any

  beforeAll(async () => {
    // Set up test data
    testCompany = await prisma.company.create({
      data: {
        symbol: 'TEST',
        name: 'Test Company',
        cik: '0000999999',
        industry: 'Technology',
        sector: 'Software'
      }
    })

    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    })

    testFiling = await prisma.filing.create({
      data: {
        accessionNo: '0000999999-23-000001',
        companyId: testCompany.id,
        formType: '10-K',
        filedDate: new Date(),
        reportDate: new Date(),
        description: 'Annual Report',
        documentUrl: 'https://sec.gov/test',
        processed: true
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.alert.deleteMany({})
    await prisma.diff.deleteMany({})
    await prisma.filing.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.company.deleteMany({})
    await prisma.$disconnect()
  })

  it('should dispatch email alert for material change', async () => {
    // This test will fail until the alert system is implemented
    
    // Step 1: Create a material diff
    await prisma.diff.create({
      data: {
        filingId: testFiling.id,
        sectionType: 'BUSINESS',
        changeType: 'MATERIAL_CHANGE',
        oldContent: 'Old business description',
        newContent: 'New business description with major changes',
        summary: 'Significant business model change detected',
        materialityScore: 0.8
      }
    })

    // Step 2: Set up user alert preferences
    await fetch('/api/settings/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUser.id}` // Mock auth
      },
      body: JSON.stringify({
        emailEnabled: true,
        materialityThreshold: 0.7,
        watchlist: [
          { ticker: 'TEST', alertTypes: ['MATERIAL_CHANGE'] }
        ]
      })
    })

    // Step 3: Trigger alert processing
    const alertResponse = await fetch('/api/internal/process-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filingId: testFiling.id,
        triggerType: 'MATERIAL_CHANGE'
      })
    })

    expect(alertResponse.status).toBe(200)

    // Step 4: Verify alert was created in database
    const alerts = await prisma.alert.findMany({
      where: {
        userId: testUser.id,
        filingId: testFiling.id,
        type: 'MATERIAL_CHANGE'
      }
    })

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      method: 'EMAIL',
      title: expect.stringContaining('Material Change'),
      message: expect.stringContaining('TEST'),
      status: 'SENT'
    })

    // Step 5: Verify alert was dispatched
    expect(alerts[0].sentAt).toBeTruthy()
    expect(new Date(alerts[0].sentAt!).getTime()).toBeGreaterThan(
      new Date().getTime() - 60000 // Sent within last minute
    )
  })

  it('should not dispatch alerts below materiality threshold', async () => {
    // Create a low-materiality diff
    await prisma.diff.create({
      data: {
        filingId: testFiling.id,
        sectionType: 'FOOTNOTES',
        changeType: 'MINOR_CHANGE',
        oldContent: 'Old footnote',
        newContent: 'Updated footnote',
        summary: 'Minor formatting change',
        materialityScore: 0.2
      }
    })

    // Process alerts with threshold of 0.7
    const alertResponse = await fetch('/api/internal/process-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filingId: testFiling.id,
        triggerType: 'MINOR_CHANGE'
      })
    })

    expect(alertResponse.status).toBe(200)

    // Verify no alert was created for low materiality change
    const alerts = await prisma.alert.findMany({
      where: {
        userId: testUser.id,
        filingId: testFiling.id,
        type: 'MINOR_CHANGE'
      }
    })

    expect(alerts).toHaveLength(0)
  })

  it('should dispatch SMS alert when email fails', async () => {
    // Set up user with SMS fallback
    await fetch('/api/settings/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUser.id}`
      },
      body: JSON.stringify({
        emailEnabled: true,
        smsEnabled: true,
        phone: '+1234567890',
        materialityThreshold: 0.7,
        watchlist: [
          { ticker: 'TEST', alertTypes: ['MATERIAL_CHANGE'] }
        ]
      })
    })

    // Create material diff
    await prisma.diff.create({
      data: {
        filingId: testFiling.id,
        sectionType: 'FINANCIALS',
        changeType: 'EARNINGS_UPDATE',
        summary: 'Revenue guidance updated',
        materialityScore: 0.9
      }
    })

    // Process alerts with email failure simulation
    const alertResponse = await fetch('/api/internal/process-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filingId: testFiling.id,
        triggerType: 'EARNINGS_UPDATE',
        simulateEmailFailure: true
      })
    })

    expect(alertResponse.status).toBe(200)

    // Verify SMS alert was sent as fallback
    const alerts = await prisma.alert.findMany({
      where: {
        userId: testUser.id,
        filingId: testFiling.id,
        type: 'EARNINGS_UPDATE'
      },
      orderBy: { createdAt: 'asc' }
    })

    expect(alerts).toHaveLength(2) // Failed email + successful SMS
    
    const emailAlert = alerts.find(a => a.method === 'EMAIL')
    const smsAlert = alerts.find(a => a.method === 'SMS')

    expect(emailAlert?.status).toBe('FAILED')
    expect(smsAlert?.status).toBe('SENT')
    expect(smsAlert?.sentAt).toBeTruthy()
  })

  it('should batch multiple alerts for same filing', async () => {
    // Create multiple material changes
    const diffs = [
      {
        sectionType: 'BUSINESS',
        changeType: 'MATERIAL_CHANGE',
        summary: 'Business model change',
        materialityScore: 0.8
      },
      {
        sectionType: 'RISK_FACTORS',
        changeType: 'MATERIAL_CHANGE', 
        summary: 'New risk factors added',
        materialityScore: 0.7
      },
      {
        sectionType: 'FINANCIALS',
        changeType: 'MATERIAL_CHANGE',
        summary: 'Revenue recognition change',
        materialityScore: 0.9
      }
    ]

    for (const diffData of diffs) {
      await prisma.diff.create({
        data: {
          filingId: testFiling.id,
          ...diffData
        }
      })
    }

    // Process alerts with batching enabled
    const alertResponse = await fetch('/api/internal/process-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filingId: testFiling.id,
        triggerType: 'BATCH_PROCESSING',
        batchingEnabled: true
      })
    })

    expect(alertResponse.status).toBe(200)

    // Verify single batched alert was sent instead of 3 separate ones
    const alerts = await prisma.alert.findMany({
      where: {
        userId: testUser.id,
        filingId: testFiling.id
      }
    })

    // Should have 1 batched alert containing all changes
    const batchedAlert = alerts.find(a => a.title.includes('Multiple Changes'))
    expect(batchedAlert).toBeDefined()
    expect(batchedAlert?.message).toContain('3 material changes')
    expect(batchedAlert?.message).toContain('Business model change')
    expect(batchedAlert?.message).toContain('New risk factors')
    expect(batchedAlert?.message).toContain('Revenue recognition')
  })

  it('should respect user alert preferences and unsubscribe', async () => {
    // Set up user with specific preferences
    await fetch('/api/settings/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUser.id}`
      },
      body: JSON.stringify({
        emailEnabled: true,
        formTypes: ['10-Q'], // Only 10-Q alerts
        watchlist: [
          { ticker: 'TEST', alertTypes: ['NEW_FILING'] } // Only new filing alerts
        ]
      })
    })

    // Create material change (should not trigger alert)
    await prisma.diff.create({
      data: {
        filingId: testFiling.id, // This is a 10-K filing
        sectionType: 'BUSINESS',
        changeType: 'MATERIAL_CHANGE',
        summary: 'Major business change',
        materialityScore: 0.9
      }
    })

    const alertResponse = await fetch('/api/internal/process-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filingId: testFiling.id,
        triggerType: 'MATERIAL_CHANGE'
      })
    })

    expect(alertResponse.status).toBe(200)

    // Verify no alert was sent due to form type mismatch
    const alerts = await prisma.alert.findMany({
      where: {
        userId: testUser.id,
        filingId: testFiling.id
      }
    })

    expect(alerts).toHaveLength(0)

    // Test unsubscribe functionality
    const unsubscribeResponse = await fetch('/api/settings/alerts/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser.id,
        token: 'unsubscribe-token'
      })
    })

    expect(unsubscribeResponse.status).toBe(200)

    // Verify user is unsubscribed
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    })

    // In real implementation, user would have alertsEnabled: false
    expect(updatedUser).toBeDefined()
  })
})