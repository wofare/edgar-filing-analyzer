import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/settings/alerts - Contract Tests', () => {
  describe('GET /api/settings/alerts', () => {
    it('should return 200 with user alert settings', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/settings/alerts',
        headers: {
          authorization: 'Bearer mock-jwt-token',
        },
      })

      // This test will fail until the API route is implemented
      const handler = await import('@/app/api/settings/alerts/route')
      await handler.GET(req as any)

      expect(res._getStatusCode()).toBe(200)
      
      const data = JSON.parse(res._getData())
      expect(data).toMatchObject({
        userId: expect.any(String),
        settings: expect.objectContaining({
          emailEnabled: expect.any(Boolean),
          smsEnabled: expect.any(Boolean),
          pushEnabled: expect.any(Boolean),
          materialityThreshold: expect.any(Number),
          formTypes: expect.arrayContaining([expect.any(String)]),
          watchlist: expect.arrayContaining([
            expect.objectContaining({
              ticker: expect.any(String),
              alertTypes: expect.arrayContaining([expect.any(String)])
            })
          ])
        }),
        contacts: expect.objectContaining({
          email: expect.any(String),
          phone: expect.stringMatching(/^\+?\d+$/),
          verified: expect.objectContaining({
            email: expect.any(Boolean),
            phone: expect.any(Boolean)
          })
        })
      })
    })

    it('should return 401 when not authenticated', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/settings/alerts',
      })

      const handler = await import('@/app/api/settings/alerts/route')
      await handler.GET(req as any)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    })
  })

  describe('POST /api/settings/alerts', () => {
    it('should return 200 when updating alert settings', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/settings/alerts',
        headers: {
          authorization: 'Bearer mock-jwt-token',
        },
        body: {
          emailEnabled: true,
          smsEnabled: false,
          materialityThreshold: 0.7,
          formTypes: ['10-K', '10-Q', '8-K'],
          watchlist: [
            { ticker: 'AAPL', alertTypes: ['MATERIAL_CHANGE', 'NEW_FILING'] },
            { ticker: 'GOOGL', alertTypes: ['EARNINGS_UPDATE'] }
          ]
        },
      })

      const handler = await import('@/app/api/settings/alerts/route')
      await handler.POST(req as any)

      expect(res._getStatusCode()).toBe(200)
      
      const data = JSON.parse(res._getData())
      expect(data).toMatchObject({
        success: true,
        settings: expect.objectContaining({
          emailEnabled: true,
          smsEnabled: false,
          materialityThreshold: 0.7,
          formTypes: ['10-K', '10-Q', '8-K'],
          watchlist: expect.arrayContaining([
            expect.objectContaining({
              ticker: 'AAPL',
              alertTypes: ['MATERIAL_CHANGE', 'NEW_FILING']
            })
          ])
        }),
        updatedAt: expect.any(String)
      })
    })

    it('should return 400 for invalid materiality threshold', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/settings/alerts',
        headers: {
          authorization: 'Bearer mock-jwt-token',
        },
        body: {
          materialityThreshold: 1.5 // Invalid: should be between 0 and 1
        },
      })

      const handler = await import('@/app/api/settings/alerts/route')
      await handler.POST(req as any)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid materiality threshold',
        code: 'VALIDATION_ERROR',
        details: 'Threshold must be between 0 and 1'
      })
    })

    it('should return 400 for invalid ticker format', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/settings/alerts',
        headers: {
          authorization: 'Bearer mock-jwt-token',
        },
        body: {
          watchlist: [
            { ticker: '123', alertTypes: ['MATERIAL_CHANGE'] } // Invalid ticker
          ]
        },
      })

      const handler = await import('@/app/api/settings/alerts/route')
      await handler.POST(req as any)

      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid ticker format',
        code: 'VALIDATION_ERROR',
        details: expect.stringContaining('Invalid ticker: 123')
      })
    })

    it('should return 401 when not authenticated', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        url: '/api/settings/alerts',
        body: {
          emailEnabled: true
        },
      })

      const handler = await import('@/app/api/settings/alerts/route')
      await handler.POST(req as any)

      expect(res._getStatusCode()).toBe(401)
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    })
  })
})