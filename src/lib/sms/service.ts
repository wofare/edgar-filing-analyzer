import { Twilio } from 'twilio'
import { prisma } from '@/lib/db'

export interface SMSOptions {
  to: string
  message: string
  template?: string
  variables?: Record<string, any>
}

export interface SMSTemplate {
  message: string
}

export class SMSService {
  private client: Twilio
  private fromNumber: string
  private templates: Map<string, SMSTemplate> = new Map()

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured')
    }

    this.client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    this.fromNumber = process.env.TWILIO_FROM_NUMBER || ''
    if (!this.fromNumber) {
      console.warn('Twilio from number not configured')
    }

    this.loadTemplates()
  }

  // Load SMS templates
  private loadTemplates() {
    // Material Change Alert Template
    this.templates.set('material_change', {
      message: `🚨 ${String.fromCodePoint(0x1F4C8)} MATERIAL CHANGE: {{ticker}} - {{companyName}} filed {{formType}} with significant changes. View: {{shortUrl}}`
    })

    // New Filing Alert Template
    this.templates.set('new_filing', {
      message: `📄 NEW FILING: {{ticker}} - {{companyName}} filed {{formType}} on {{filedDate}}. View: {{shortUrl}}`
    })

    // Price Change Alert Template
    this.templates.set('price_change', {
      message: `📊 PRICE ALERT: {{ticker}} {{changeDirection}} {{changePercent}}% to ${{currentPrice}}. View: {{shortUrl}}`
    })

    // Daily Summary Template
    this.templates.set('daily_summary', {
      message: `📋 DAILY SUMMARY: {{totalFilings}} new filings, {{materialFilings}} with material changes. Dashboard: {{dashboardUrl}}`
    })

    // Welcome Template
    this.templates.set('welcome', {
      message: `Welcome to WhatChanged! 🎉 Start monitoring SEC filings for material changes. Setup: {{dashboardUrl}}`
    })

    // Verification Template
    this.templates.set('verification', {
      message: `Your WhatChanged verification code: {{code}}. Enter this code to verify your phone number.`
    })
  }

  // Send SMS message
  async sendSMS(options: SMSOptions): Promise<{
    success: boolean
    sid?: string
    error?: string
  }> {
    try {
      // Validate phone number format
      const phoneNumber = this.formatPhoneNumber(options.to)
      if (!phoneNumber) {
        throw new Error('Invalid phone number format')
      }

      let message = options.message

      // Use template if specified
      if (options.template) {
        const template = this.templates.get(options.template)
        if (!template) {
          throw new Error(`SMS template not found: ${options.template}`)
        }

        message = this.renderTemplate(template.message, options.variables || {})
      }

      // Truncate message if too long (SMS limit is 160 characters)
      if (message.length > 160) {
        message = message.substring(0, 157) + '...'
      }

      // Send SMS via Twilio
      const twilioMessage = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`SMS sent successfully: ${twilioMessage.sid}`)

      // Log SMS to database
      await this.logSMS({
        to: phoneNumber,
        message,
        template: options.template,
        sid: twilioMessage.sid,
        status: 'sent'
      })

      return {
        success: true,
        sid: twilioMessage.sid
      }

    } catch (error) {
      console.error('SMS send failed:', error)

      // Log failed SMS
      await this.logSMS({
        to: options.to,
        message: options.message,
        template: options.template,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Send material change SMS alert
  async sendMaterialChangeAlert(alert: {
    phone: string
    ticker: string
    companyName: string
    formType: string
  }): Promise<{ success: boolean; error?: string }> {
    return await this.sendSMS({
      to: alert.phone,
      template: 'material_change',
      variables: {
        ticker: alert.ticker,
        companyName: this.truncateCompanyName(alert.companyName),
        formType: alert.formType,
        shortUrl: this.createShortUrl(alert.ticker)
      }
    })
  }

  // Send new filing SMS alert
  async sendNewFilingAlert(alert: {
    phone: string
    ticker: string
    companyName: string
    formType: string
    filedDate: string
  }): Promise<{ success: boolean; error?: string }> {
    return await this.sendSMS({
      to: alert.phone,
      template: 'new_filing',
      variables: {
        ticker: alert.ticker,
        companyName: this.truncateCompanyName(alert.companyName),
        formType: alert.formType,
        filedDate: this.formatDate(alert.filedDate),
        shortUrl: this.createShortUrl(alert.ticker)
      }
    })
  }

  // Send price change SMS alert
  async sendPriceChangeAlert(alert: {
    phone: string
    ticker: string
    currentPrice: number
    change: number
    changePercent: number
  }): Promise<{ success: boolean; error?: string }> {
    const changeDirection = alert.change >= 0 ? '📈' : '📉'
    
    return await this.sendSMS({
      to: alert.phone,
      template: 'price_change',
      variables: {
        ticker: alert.ticker,
        currentPrice: alert.currentPrice.toFixed(2),
        changePercent: Math.abs(alert.changePercent).toFixed(2),
        changeDirection,
        shortUrl: this.createShortUrl(alert.ticker)
      }
    })
  }

  // Send daily summary SMS
  async sendDailySummary(phone: string, summary: {
    totalFilings: number
    materialFilings: number
  }): Promise<{ success: boolean; error?: string }> {
    return await this.sendSMS({
      to: phone,
      template: 'daily_summary',
      variables: {
        totalFilings: summary.totalFilings,
        materialFilings: summary.materialFilings,
        dashboardUrl: process.env.NEXT_PUBLIC_BASE_URL + '/dashboard'
      }
    })
  }

  // Send welcome SMS
  async sendWelcomeSMS(phone: string): Promise<{ success: boolean; error?: string }> {
    return await this.sendSMS({
      to: phone,
      template: 'welcome',
      variables: {
        dashboardUrl: process.env.NEXT_PUBLIC_BASE_URL + '/dashboard'
      }
    })
  }

  // Send verification code SMS
  async sendVerificationCode(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    return await this.sendSMS({
      to: phone,
      template: 'verification',
      variables: { code }
    })
  }

  // Send batch SMS messages
  async sendBatchSMS(messages: SMSOptions[]): Promise<Array<{
    to: string
    success: boolean
    sid?: string
    error?: string
  }>> {
    const results = []

    for (const message of messages) {
      const result = await this.sendSMS(message)
      results.push({
        to: message.to,
        ...result
      })

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return results
  }

  // Get SMS delivery status
  async getDeliveryStatus(sid: string): Promise<{
    status: string
    errorCode?: number
    errorMessage?: string
  }> {
    try {
      const message = await this.client.messages(sid).fetch()
      
      return {
        status: message.status,
        errorCode: message.errorCode || undefined,
        errorMessage: message.errorMessage || undefined
      }
    } catch (error) {
      console.error('Failed to get SMS delivery status:', error)
      return {
        status: 'unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Validate phone number
  async validatePhoneNumber(phoneNumber: string): Promise<{
    isValid: boolean
    formatted?: string
    country?: string
    carrier?: string
    error?: string
  }> {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber)
      if (!formattedNumber) {
        return { isValid: false, error: 'Invalid phone number format' }
      }

      // Use Twilio Lookup API to validate
      const lookup = await this.client.lookups.v1.phoneNumbers(formattedNumber).fetch()
      
      return {
        isValid: true,
        formatted: lookup.phoneNumber,
        country: lookup.countryCode || undefined
      }
    } catch (error) {
      console.error('Phone number validation failed:', error)
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }

  // Test SMS service
  async testService(): Promise<{ success: boolean; error?: string }> {
    if (!this.fromNumber) {
      return { success: false, error: 'Twilio from number not configured' }
    }

    try {
      // Test by checking account balance
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch()
      
      return {
        success: true
      }
    } catch (error) {
      console.error('SMS service test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service test failed'
      }
    }
  }

  // Get SMS usage statistics
  async getUsageStats(days: number = 30): Promise<{
    sent: number
    failed: number
    totalCost: number
    messages: Array<{
      date: string
      count: number
    }>
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      
      // Get usage from database logs
      const logs = await prisma.smsLog.findMany({
        where: {
          sentAt: { gte: startDate }
        },
        select: {
          status: true,
          sentAt: true
        }
      })

      const sent = logs.filter(log => log.status === 'sent').length
      const failed = logs.filter(log => log.status === 'failed').length

      // Group by date
      const messagesByDate = new Map<string, number>()
      logs.forEach(log => {
        const date = log.sentAt.toISOString().split('T')[0]
        messagesByDate.set(date, (messagesByDate.get(date) || 0) + 1)
      })

      const messages = Array.from(messagesByDate.entries()).map(([date, count]) => ({
        date,
        count
      }))

      return {
        sent,
        failed,
        totalCost: sent * 0.0075, // Approximate SMS cost
        messages
      }
    } catch (error) {
      console.error('Failed to get SMS usage stats:', error)
      return { sent: 0, failed: 0, totalCost: 0, messages: [] }
    }
  }

  // Format phone number to E.164 format
  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')
    
    // Handle US numbers
    if (digits.length === 10) {
      return `+1${digits}`
    }
    
    // Handle international numbers
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    
    // Handle numbers that already have country code
    if (digits.length > 10 && digits.length <= 15) {
      return `+${digits}`
    }
    
    return null
  }

  // Render SMS template with variables
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      rendered = rendered.replace(regex, String(value || ''))
    }
    return rendered
  }

  // Truncate company name for SMS
  private truncateCompanyName(name: string): string {
    if (name.length <= 20) return name
    
    // Remove common suffixes
    const cleaned = name
      .replace(/ Inc\.?$/, '')
      .replace(/ Corp\.?$/, '')
      .replace(/ Corporation$/, '')
      .replace(/ Company$/, '')
      .replace(/ Co\.?$/, '')
      .replace(/ Ltd\.?$/, '')
    
    return cleaned.length <= 20 ? cleaned : cleaned.substring(0, 17) + '...'
  }

  // Create short URL for SMS
  private createShortUrl(ticker: string): string {
    return `${process.env.NEXT_PUBLIC_BASE_URL}/s/${ticker}`
  }

  // Format date for SMS
  private formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Log SMS to database
  private async logSMS(log: {
    to: string
    message: string
    template?: string
    sid?: string
    status: 'sent' | 'failed'
    error?: string
  }) {
    try {
      await prisma.smsLog.create({
        data: {
          to: log.to,
          message: log.message,
          template: log.template,
          sid: log.sid,
          status: log.status,
          error: log.error,
          sentAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log SMS:', error)
    }
  }
}

// Global SMS service instance
export const smsService = new SMSService()

export default smsService