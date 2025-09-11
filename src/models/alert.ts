import { z } from 'zod'
import { AlertType, AlertMethod, AlertStatus } from '@prisma/client'

// Alert validation schemas
export const createAlertSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
  filingId: z.string().cuid('Invalid filing ID format'),
  type: z.nativeEnum(AlertType),
  method: z.nativeEnum(AlertMethod),
  title: z.string().min(1, 'Alert title is required').max(200, 'Title too long'),
  message: z.string().min(1, 'Alert message is required').max(2000, 'Message too long'),
})

export const alertDispatchSchema = z.object({
  alertId: z.string().cuid('Invalid alert ID format'),
  method: z.nativeEnum(AlertMethod),
  recipient: z.string().min(1, 'Recipient is required'),
  template: z.string().optional(),
  variables: z.record(z.any()).optional(),
})

export const alertBatchSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
  filingId: z.string().cuid('Invalid filing ID format'),
  alerts: z.array(z.object({
    type: z.nativeEnum(AlertType),
    title: z.string().min(1, 'Title required').max(200, 'Title too long'),
    message: z.string().min(1, 'Message required').max(2000, 'Message too long'),
  })).min(1, 'At least one alert required').max(10, 'Maximum 10 alerts per batch'),
  batchingEnabled: z.boolean().default(true),
})

export const alertPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  types: z.array(z.nativeEnum(AlertType)),
  materialityThreshold: z.number().min(0).max(1),
  formTypes: z.array(z.string()),
  tickers: z.array(z.string().regex(/^[A-Z]{1,5}$/, 'Invalid ticker format')),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
    timezone: z.string(),
  }).optional(),
  frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
})

export const unsubscribeSchema = z.object({
  userId: z.string().cuid('Invalid user ID format'),
  token: z.string().min(1, 'Unsubscribe token required'),
  types: z.array(z.nativeEnum(AlertType)).optional(), // Specific types to unsubscribe from
})

// Alert response schemas
export const alertResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  filingId: z.string(),
  type: z.nativeEnum(AlertType),
  method: z.nativeEnum(AlertMethod),
  title: z.string(),
  message: z.string(),
  status: z.nativeEnum(AlertStatus),
  sentAt: z.date().nullable(),
  createdAt: z.date(),
  filing: z.object({
    accessionNo: z.string(),
    companyName: z.string(),
    ticker: z.string(),
    formType: z.string(),
    filedDate: z.date(),
  }).optional(),
})

export const alertStatsSchema = z.object({
  total: z.number(),
  sent: z.number(),
  failed: z.number(),
  pending: z.number(),
  byType: z.record(z.nativeEnum(AlertType), z.number()),
  byMethod: z.record(z.nativeEnum(AlertMethod), z.number()),
  recentActivity: z.array(z.object({
    date: z.date(),
    sent: z.number(),
    failed: z.number(),
  })),
})

export const alertDeliveryReportSchema = z.object({
  alertId: z.string(),
  method: z.nativeEnum(AlertMethod),
  status: z.nativeEnum(AlertStatus),
  deliveredAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
})

// Type definitions
export type CreateAlertInput = z.infer<typeof createAlertSchema>
export type AlertDispatchInput = z.infer<typeof alertDispatchSchema>
export type AlertBatchInput = z.infer<typeof alertBatchSchema>
export type AlertPreferencesInput = z.infer<typeof alertPreferencesSchema>
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>
export type AlertResponse = z.infer<typeof alertResponseSchema>
export type AlertStats = z.infer<typeof alertStatsSchema>
export type AlertDeliveryReport = z.infer<typeof alertDeliveryReportSchema>

// Alert utility functions
export class AlertModel {
  static generateAlertTitle(type: AlertType, companyName: string, formType: string): string {
    const templates: Record<AlertType, string> = {
      [AlertType.MATERIAL_CHANGE]: `Material Change Alert: ${companyName}`,
      [AlertType.NEW_FILING]: `New ${formType} Filing: ${companyName}`,
      [AlertType.EARNINGS_UPDATE]: `Earnings Update: ${companyName}`,
      [AlertType.GUIDANCE_CHANGE]: `Guidance Change: ${companyName}`,
    }
    
    return templates[type] || `Alert: ${companyName}`
  }

  static generateEmailSubject(type: AlertType, ticker: string, formType: string): string {
    const templates: Record<AlertType, string> = {
      [AlertType.MATERIAL_CHANGE]: `🚨 Material Changes in ${ticker} ${formType}`,
      [AlertType.NEW_FILING]: `📄 New ${ticker} ${formType} Filed`,
      [AlertType.EARNINGS_UPDATE]: `📊 ${ticker} Earnings Update`,
      [AlertType.GUIDANCE_CHANGE]: `📈 ${ticker} Guidance Revised`,
    }
    
    return templates[type] || `${ticker} Filing Alert`
  }

  static generateSmsMessage(
    type: AlertType,
    ticker: string,
    formType: string,
    summary: string,
    maxLength: number = 160
  ): string {
    const prefix = this.getSmsPrefix(type)
    const baseMessage = `${prefix} ${ticker} ${formType}: ${summary}`
    
    if (baseMessage.length <= maxLength) {
      return baseMessage
    }
    
    // Truncate summary to fit
    const overhead = `${prefix} ${ticker} ${formType}: ...`.length
    const availableLength = maxLength - overhead
    const truncatedSummary = summary.substring(0, availableLength)
    
    return `${prefix} ${ticker} ${formType}: ${truncatedSummary}...`
  }

  private static getSmsPrefix(type: AlertType): string {
    const prefixes: Record<AlertType, string> = {
      [AlertType.MATERIAL_CHANGE]: '🚨',
      [AlertType.NEW_FILING]: '📄',
      [AlertType.EARNINGS_UPDATE]: '📊',
      [AlertType.GUIDANCE_CHANGE]: '📈',
    }
    
    return prefixes[type] || '📋'
  }

  static shouldBatchAlerts(alerts: CreateAlertInput[], timeWindowMinutes: number = 15): boolean {
    if (alerts.length < 2) return false
    
    // Group by user and filing
    const groups = new Map<string, CreateAlertInput[]>()
    
    for (const alert of alerts) {
      const key = `${alert.userId}-${alert.filingId}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(alert)
    }
    
    // Check if any group has multiple alerts within time window
    return Array.from(groups.values()).some(group => group.length > 1)
  }

  static createBatchedAlert(alerts: CreateAlertInput[], filing: { ticker: string; formType: string; companyName: string }): CreateAlertInput {
    if (alerts.length === 0) throw new Error('No alerts to batch')
    
    const firstAlert = alerts[0]
    const changeCount = alerts.length
    const types = [...new Set(alerts.map(a => a.type))]
    
    const title = `Multiple Changes Detected: ${filing.companyName}`
    
    const typeDescriptions = types.map(type => {
      const count = alerts.filter(a => a.type === type).length
      return `${count} ${type.toLowerCase().replace('_', ' ')}`
    }).join(', ')
    
    const message = `${filing.ticker} has ${changeCount} material changes in their latest ${filing.formType} filing:\n\n${typeDescriptions}\n\nView detailed changes in your dashboard.`
    
    return {
      userId: firstAlert.userId,
      filingId: firstAlert.filingId,
      type: AlertType.MATERIAL_CHANGE,
      method: firstAlert.method,
      title,
      message,
    }
  }

  static isWithinQuietHours(quietHours: { startTime: string; endTime: string; timezone: string }): boolean {
    try {
      const now = new Date()
      const currentTime = now.toLocaleTimeString('en-US', {
        timeZone: quietHours.timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      })
      
      const [currentHour, currentMinute] = currentTime.split(':').map(Number)
      const currentMinutes = currentHour * 60 + currentMinute
      
      const [startHour, startMinute] = quietHours.startTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      
      const [endHour, endMinute] = quietHours.endTime.split(':').map(Number)
      const endMinutes = endHour * 60 + endMinute
      
      // Handle overnight quiet hours (e.g., 22:00 - 08:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes
      } else {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes
      }
    } catch (error) {
      // If timezone parsing fails, assume not in quiet hours
      return false
    }
  }

  static calculateRetryDelay(attempt: number, method: AlertMethod): number {
    // Return delay in minutes using exponential backoff
    const baseDelays: Record<AlertMethod, number> = {
      [AlertMethod.EMAIL]: 5,   // 5 minutes base delay
      [AlertMethod.SMS]: 2,     // 2 minutes base delay (more urgent)
      [AlertMethod.PUSH]: 1,    // 1 minute base delay (most urgent)
    }
    
    const baseDelay = baseDelays[method]
    const backoffMultiplier = Math.pow(2, attempt - 1) // 1, 2, 4, 8, 16...
    const jitter = Math.random() * 0.1 // Add 0-10% jitter
    
    return Math.ceil(baseDelay * backoffMultiplier * (1 + jitter))
  }

  static getMaxRetryAttempts(method: AlertMethod): number {
    const maxAttempts: Record<AlertMethod, number> = {
      [AlertMethod.EMAIL]: 5,  // Email is reliable, retry more
      [AlertMethod.SMS]: 3,    // SMS can be expensive, retry less  
      [AlertMethod.PUSH]: 2,   // Push notifications are immediate or fail
    }
    
    return maxAttempts[method]
  }

  static generateUnsubscribeToken(userId: string, alertType?: AlertType): string {
    const data = alertType ? `${userId}-${alertType}` : userId
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    
    // In production, this would use crypto.createHash with a secret
    return Buffer.from(`${data}-${timestamp}-${random}`).toString('base64url')
  }

  static validateAlertFrequency(frequency: string, lastSent?: Date): boolean {
    if (!lastSent) return true // First alert
    
    const now = Date.now()
    const lastSentTime = lastSent.getTime()
    const timeSinceLastMs = now - lastSentTime
    
    const minimumIntervals = {
      immediate: 0,
      hourly: 60 * 60 * 1000,      // 1 hour
      daily: 24 * 60 * 60 * 1000,  // 24 hours
      weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
    }
    
    const minimumInterval = minimumIntervals[frequency as keyof typeof minimumIntervals] || 0
    return timeSinceLastMs >= minimumInterval
  }

  static prioritizeAlertMethods(preferences: { emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean }, urgency: 'low' | 'medium' | 'high'): AlertMethod[] {
    const methods: AlertMethod[] = []
    
    // For high urgency, prefer faster methods first
    if (urgency === 'high') {
      if (preferences.pushEnabled) methods.push(AlertMethod.PUSH)
      if (preferences.smsEnabled) methods.push(AlertMethod.SMS)
      if (preferences.emailEnabled) methods.push(AlertMethod.EMAIL)
    } else {
      // For lower urgency, prefer cheaper/reliable methods first
      if (preferences.emailEnabled) methods.push(AlertMethod.EMAIL)
      if (preferences.pushEnabled) methods.push(AlertMethod.PUSH)
      if (preferences.smsEnabled) methods.push(AlertMethod.SMS)
    }
    
    return methods
  }
}

// Error classes
export class AlertValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'AlertValidationError'
  }
}

export class AlertDeliveryError extends Error {
  constructor(
    message: string,
    public method: AlertMethod,
    public retryable: boolean = true,
    public metadata?: Record<string, any>
  ) {
    super(message)
    this.name = 'AlertDeliveryError'
  }
}

export class AlertRateLimitError extends Error {
  constructor(method: AlertMethod, public retryAfter: number) {
    super(`Alert rate limit exceeded for ${method}`)
    this.name = 'AlertRateLimitError'
  }
}

export class InvalidUnsubscribeTokenError extends Error {
  constructor(token: string) {
    super(`Invalid unsubscribe token: ${token}`)
    this.name = 'InvalidUnsubscribeTokenError'
  }
}