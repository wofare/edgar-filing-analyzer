import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { AlertMethod, AlertType } from '@prisma/client'

const AlertSettingSchema = z.object({
  alertType: z.enum(['MATERIAL_CHANGE', 'NEW_FILING', 'PRICE_CHANGE', 'EARNINGS_RELEASE']),
  method: z.enum(['EMAIL', 'SMS', 'PUSH']),
  isEnabled: z.boolean(),
  threshold: z.number().min(0).max(1).optional(),
  frequency: z.enum(['IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY']).optional().default('IMMEDIATE'),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  }).optional(),
  metadata: z.record(z.any()).optional()
})

const AlertSettingsUpdateSchema = z.object({
  settings: z.array(AlertSettingSchema),
  globalSettings: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    timezone: z.string().optional().default('UTC'),
    defaultFrequency: z.enum(['IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY']).optional().default('IMMEDIATE')
  }).optional()
})

const WatchlistItemSchema = z.object({
  ticker: z.string().min(1).max(10),
  alertTypes: z.array(z.enum(['MATERIAL_CHANGE', 'NEW_FILING', 'PRICE_CHANGE', 'EARNINGS_RELEASE'])).optional().default(['MATERIAL_CHANGE']),
  priceChangeThreshold: z.number().min(0).max(100).optional().default(5), // percentage
  isActive: z.boolean().optional().default(true)
})

interface AlertSettingsResponse {
  settings: Array<{
    id: string
    alertType: string
    method: string
    isEnabled: boolean
    threshold: number | null
    frequency: string
    quietHours: {
      enabled: boolean
      startTime: string
      endTime: string
    } | null
    metadata: any
    createdAt: string
    updatedAt: string
  }>
  watchlist: Array<{
    id: string
    ticker: string
    companyName: string
    alertTypes: string[]
    priceChangeThreshold: number
    isActive: boolean
    addedAt: string
  }>
  globalSettings: {
    email: string | null
    phone: string | null
    timezone: string
    defaultFrequency: string
  }
}

export async function GET(request: NextRequest) {
  try {
    // In a real app, extract userId from JWT token or session
    const userId = request.headers.get('x-user-id') || 'default-user'

    // Get user's alert settings
    const alertSettings = await prisma.alertSetting.findMany({
      where: { userId },
      orderBy: [
        { alertType: 'asc' },
        { method: 'asc' }
      ]
    })

    // Get user's watchlist
    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            name: true,
            symbol: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get user profile for global settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        timezone: true,
        preferences: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      )
    }

    const response: AlertSettingsResponse = {
      settings: alertSettings.map(setting => ({
        id: setting.id,
        alertType: setting.alertType,
        method: setting.method,
        isEnabled: setting.isEnabled,
        threshold: setting.threshold,
        frequency: setting.frequency,
        quietHours: setting.quietHours as any,
        metadata: setting.metadata as any,
        createdAt: setting.createdAt.toISOString(),
        updatedAt: setting.updatedAt.toISOString()
      })),
      watchlist: watchlist.map(item => ({
        id: item.id,
        ticker: item.company.symbol,
        companyName: item.company.name,
        alertTypes: item.alertTypes as string[],
        priceChangeThreshold: item.priceChangeThreshold || 5,
        isActive: item.isActive,
        addedAt: item.createdAt.toISOString()
      })),
      globalSettings: {
        email: user.email,
        phone: user.phone,
        timezone: user.timezone || 'UTC',
        defaultFrequency: (user.preferences as any)?.defaultFrequency || 'IMMEDIATE'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error getting alert settings:', error)

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user'
    const body = await request.json()
    
    const { settings, globalSettings } = AlertSettingsUpdateSchema.parse(body)

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update global settings if provided
      if (globalSettings) {
        await tx.user.upsert({
          where: { id: userId },
          create: {
            id: userId,
            email: globalSettings.email || `${userId}@example.com`,
            phone: globalSettings.phone,
            timezone: globalSettings.timezone || 'UTC',
            preferences: {
              defaultFrequency: globalSettings.defaultFrequency || 'IMMEDIATE'
            }
          },
          update: {
            ...(globalSettings.email && { email: globalSettings.email }),
            ...(globalSettings.phone && { phone: globalSettings.phone }),
            ...(globalSettings.timezone && { timezone: globalSettings.timezone }),
            preferences: {
              defaultFrequency: globalSettings.defaultFrequency || 'IMMEDIATE'
            }
          }
        })
      }

      // Delete existing alert settings
      await tx.alertSetting.deleteMany({
        where: { userId }
      })

      // Create new alert settings
      const createdSettings = []
      for (const setting of settings) {
        const created = await tx.alertSetting.create({
          data: {
            userId,
            alertType: setting.alertType as AlertType,
            method: setting.method as AlertMethod,
            isEnabled: setting.isEnabled,
            threshold: setting.threshold,
            frequency: setting.frequency || 'IMMEDIATE',
            quietHours: setting.quietHours,
            metadata: setting.metadata || {}
          }
        })
        createdSettings.push(created)
      }

      return { settings: createdSettings }
    })

    return NextResponse.json({
      message: 'Alert settings updated successfully',
      settings: result.settings.map(setting => ({
        id: setting.id,
        alertType: setting.alertType,
        method: setting.method,
        isEnabled: setting.isEnabled,
        threshold: setting.threshold,
        frequency: setting.frequency,
        quietHours: setting.quietHours,
        metadata: setting.metadata
      }))
    })

  } catch (error) {
    console.error('Error updating alert settings:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format', 
          code: 'VALIDATION_ERROR',
          details: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user'
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'watchlist') {
      // Add to watchlist
      const { ticker, alertTypes, priceChangeThreshold, isActive } = WatchlistItemSchema.parse(body)

      // Find or create company
      const company = await prisma.company.findUnique({
        where: { symbol: ticker.toUpperCase() }
      })

      if (!company) {
        return NextResponse.json(
          { error: 'Company not found', code: 'COMPANY_NOT_FOUND' },
          { status: 404 }
        )
      }

      // Add to watchlist (upsert)
      const watchlistItem = await prisma.watchlist.upsert({
        where: {
          userId_companyId: {
            userId,
            companyId: company.id
          }
        },
        create: {
          userId,
          companyId: company.id,
          alertTypes: alertTypes as any[],
          priceChangeThreshold,
          isActive
        },
        update: {
          alertTypes: alertTypes as any[],
          priceChangeThreshold,
          isActive,
          updatedAt: new Date()
        },
        include: {
          company: {
            select: {
              name: true,
              symbol: true
            }
          }
        }
      })

      return NextResponse.json({
        message: 'Added to watchlist',
        item: {
          id: watchlistItem.id,
          ticker: watchlistItem.company.symbol,
          companyName: watchlistItem.company.name,
          alertTypes: watchlistItem.alertTypes,
          priceChangeThreshold: watchlistItem.priceChangeThreshold,
          isActive: watchlistItem.isActive,
          addedAt: watchlistItem.createdAt.toISOString()
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid action', code: 'INVALID_ACTION' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in alert settings PUT:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format', 
          code: 'VALIDATION_ERROR',
          details: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'default-user'
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const itemId = searchParams.get('id')

    if (action === 'watchlist' && itemId) {
      // Remove from watchlist
      const deleted = await prisma.watchlist.deleteMany({
        where: {
          id: itemId,
          userId
        }
      })

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: 'Watchlist item not found', code: 'ITEM_NOT_FOUND' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        message: 'Removed from watchlist'
      })
    }

    if (action === 'setting' && itemId) {
      // Delete specific alert setting
      const deleted = await prisma.alertSetting.deleteMany({
        where: {
          id: itemId,
          userId
        }
      })

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: 'Alert setting not found', code: 'SETTING_NOT_FOUND' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        message: 'Alert setting deleted'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action or missing ID', code: 'INVALID_REQUEST' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in alert settings DELETE:', error)

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    },
  })
}