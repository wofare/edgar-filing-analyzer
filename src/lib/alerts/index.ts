import nodemailer from 'nodemailer'
import { Twilio } from 'twilio'
import { env } from '@/lib/env'
import { AlertMethod, AlertStatus, AlertType } from '@prisma/client'

export interface AlertDispatchConfig {
  email?: {
    from: string
    replyTo?: string
    smtpConfig?: nodemailer.TransportOptions
  }
  sms?: {
    from: string
    accountSid: string
    authToken: string
  }
  push?: {
    // Future implementation for push notifications
    vapidKeys?: {
      publicKey: string
      privateKey: string
    }
  }
  retryPolicy?: {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
  }
}

export interface AlertMessage {
  id: string
  userId: string
  method: AlertMethod
  recipient: string
  subject?: string
  title: string
  message: string
  priority: 'low' | 'normal' | 'high'
  template?: string
  variables?: Record<string, any>
  metadata?: Record<string, any>
}

export interface AlertDeliveryResult {
  alertId: string
  method: AlertMethod
  status: AlertStatus
  deliveredAt?: Date
  errorMessage?: string
  retryCount: number
  providerResponse?: any
  metadata?: Record<string, any>
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface SMSTemplate {
  message: string
  maxLength: number
}

class EmailProvider {
  private transporter: nodemailer.Transporter

  constructor(config: AlertDispatchConfig['email']) {
    if (!config) throw new Error('Email configuration required')

    // Use SendGrid SMTP by default, fallback to custom SMTP
    const smtpConfig = config.smtpConfig || {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: env.SENDGRID_API_KEY
      }
    }

    this.transporter = nodemailer.createTransporter(smtpConfig)
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
    from: string,
    replyTo?: string,
    attachments?: Array<{ filename: string; content: string; contentType: string }>
  ): Promise<{ messageId: string; response: string }> {
    try {
      const result = await this.transporter.sendMail({
        from,
        to,
        replyTo,
        subject,
        text,
        html,
        attachments,
        headers: {
          'X-Service': 'WhatChanged-Alerts',
          'X-Priority': 'Normal'
        }
      })

      return {
        messageId: result.messageId,
        response: result.response
      }
    } catch (error) {
      throw new AlertDeliveryError(`Email delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'EMAIL', true, { error })
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      return false
    }
  }
}

class SMSProvider {
  private client: Twilio

  constructor(config: AlertDispatchConfig['sms']) {
    if (!config) throw new Error('SMS configuration required')

    this.client = new Twilio(config.accountSid, config.authToken)
  }

  async sendSMS(
    to: string,
    message: string,
    from: string
  ): Promise<{ sid: string; status: string }> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: from,
        to: to
      })

      return {
        sid: result.sid,
        status: result.status
      }
    } catch (error: any) {
      const retryable = this.isRetryableError(error)
      throw new AlertDeliveryError(`SMS delivery failed: ${error.message}`, 'SMS', retryable, { 
        error,
        code: error.code,
        moreInfo: error.moreInfo 
      })
    }
  }

  private isRetryableError(error: any): boolean {
    // Twilio error codes that indicate retryable errors
    const retryableCodes = [
      20003, // Authentication failed (maybe temporary)
      20429, // Too many requests
      21610, // Message was not sent due to unknown error
      30001, // Queue overflow
      30002, // Account suspended
      30003, // Unreachable destination handset
      30004, // Message blocked
      30005, // Unknown destination handset
      30006, // Landline or unreachable carrier
    ]

    return retryableCodes.includes(error.code)
  }
}

export class AlertDispatcher {
  private emailProvider?: EmailProvider
  private smsProvider?: SMSProvider
  private config: AlertDispatchConfig
  private templates: Map<string, { email?: EmailTemplate; sms?: SMSTemplate }> = new Map()

  constructor(config: AlertDispatchConfig) {
    this.config = config

    if (config.email) {
      this.emailProvider = new EmailProvider(config.email)
    }

    if (config.sms) {
      this.smsProvider = new SMSProvider(config.sms)
    }

    this.initializeDefaultTemplates()
  }

  async dispatchAlert(alert: AlertMessage): Promise<AlertDeliveryResult> {
    const startTime = Date.now()
    
    try {
      let result: AlertDeliveryResult

      switch (alert.method) {
        case AlertMethod.EMAIL:
          result = await this.sendEmailAlert(alert)
          break
        case AlertMethod.SMS:
          result = await this.sendSMSAlert(alert)
          break
        case AlertMethod.PUSH:
          result = await this.sendPushAlert(alert)
          break
        default:
          throw new AlertDeliveryError(`Unsupported alert method: ${alert.method}`, alert.method)
      }

      result.metadata = {
        ...result.metadata,
        processingTimeMs: Date.now() - startTime
      }

      return result
    } catch (error) {
      if (error instanceof AlertDeliveryError) {
        return {
          alertId: alert.id,
          method: alert.method,
          status: AlertStatus.FAILED,
          errorMessage: error.message,
          retryCount: 0,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            error: error.metadata
          }
        }
      }
      throw error
    }
  }

  async sendEmailAlert(alert: AlertMessage): Promise<AlertDeliveryResult> {
    if (!this.emailProvider) {
      throw new AlertDeliveryError('Email provider not configured', 'EMAIL', false)
    }

    try {
      const { subject, html, text } = this.prepareEmailContent(alert)
      const from = this.config.email!.from
      const replyTo = this.config.email!.replyTo

      const result = await this.emailProvider.sendEmail(
        alert.recipient,
        subject,
        html,
        text,
        from,
        replyTo
      )

      return {
        alertId: alert.id,
        method: AlertMethod.EMAIL,
        status: AlertStatus.SENT,
        deliveredAt: new Date(),
        retryCount: 0,
        providerResponse: result,
        metadata: {
          messageId: result.messageId,
          from,
          to: alert.recipient,
          subject
        }
      }
    } catch (error) {
      throw error // Re-throw AlertDeliveryError from EmailProvider
    }
  }

  async sendSMSAlert(alert: AlertMessage): Promise<AlertDeliveryResult> {
    if (!this.smsProvider) {
      throw new AlertDeliveryError('SMS provider not configured', 'SMS', false)
    }

    try {
      const message = this.prepareSMSContent(alert)
      const from = this.config.sms!.from

      const result = await this.smsProvider.sendSMS(alert.recipient, message, from)

      return {
        alertId: alert.id,
        method: AlertMethod.SMS,
        status: AlertStatus.SENT,
        deliveredAt: new Date(),
        retryCount: 0,
        providerResponse: result,
        metadata: {
          sid: result.sid,
          from,
          to: alert.recipient,
          messageLength: message.length
        }
      }
    } catch (error) {
      throw error // Re-throw AlertDeliveryError from SMSProvider
    }
  }

  async sendPushAlert(alert: AlertMessage): Promise<AlertDeliveryResult> {
    // Push notification implementation would go here
    // For now, return not implemented
    throw new AlertDeliveryError('Push notifications not implemented yet', 'PUSH', false)
  }

  private prepareEmailContent(alert: AlertMessage): { subject: string; html: string; text: string } {
    const template = this.getTemplate(alert.template || 'default', 'email')
    
    if (!template) {
      // Fallback to basic email format
      return {
        subject: alert.subject || alert.title,
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${alert.title}</h2>
              <div style="line-height: 1.6; color: #666;">
                ${alert.message.replace(/\n/g, '<br>')}
              </div>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999;">
                This alert was generated by WhatChanged. 
                <a href="{unsubscribe_url}">Unsubscribe</a>
              </p>
            </body>
          </html>
        `,
        text: `${alert.title}\n\n${alert.message}\n\nThis alert was generated by WhatChanged.`
      }
    }

    return {
      subject: this.interpolateTemplate(template.subject, alert.variables || {}),
      html: this.interpolateTemplate(template.html, alert.variables || {}),
      text: this.interpolateTemplate(template.text, alert.variables || {})
    }
  }

  private prepareSMSContent(alert: AlertMessage): string {
    const template = this.getTemplate(alert.template || 'default', 'sms')
    const maxLength = template?.maxLength || 160

    let message = alert.message
    if (template) {
      message = this.interpolateTemplate(template.message, alert.variables || {})
    }

    // Truncate if too long
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...'
    }

    return message
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key]?.toString() || match
    })
  }

  private getTemplate(templateName: string, type: 'email' | 'sms'): EmailTemplate | SMSTemplate | undefined {
    const template = this.templates.get(templateName)
    return type === 'email' ? template?.email : template?.sms
  }

  addTemplate(name: string, email?: EmailTemplate, sms?: SMSTemplate): void {
    this.templates.set(name, { email, sms })
  }

  private initializeDefaultTemplates(): void {
    // Material change alert template
    this.addTemplate('material_change', 
      {
        subject: '🚨 Material Change Alert: {ticker}',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #dc3545; margin: 0;">🚨 Material Change Detected</h2>
                <p style="margin: 5px 0 0; color: #666;">{ticker} • {formType} • {filedDate}</p>
              </div>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <h3 style="margin: 0 0 10px; color: #856404;">Quick Summary</h3>
                <p style="margin: 0; color: #856404;">{summary}</p>
              </div>

              <div style="line-height: 1.6; color: #333;">
                <h3>Key Changes:</h3>
                <ul>
                  {changes}
                </ul>
              </div>

              <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px; color: #0066cc;">Why This Matters</h3>
                <p style="margin: 0; color: #0066cc;">{impact}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="{viewUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Full Analysis</a>
              </div>

              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                WhatChanged Alert Service • <a href="{unsubscribe_url}">Unsubscribe</a>
              </p>
            </body>
          </html>
        `,
        text: `🚨 Material Change Alert: {ticker}\n\n{summary}\n\nKey Changes:\n{changesText}\n\nWhy This Matters:\n{impact}\n\nView full analysis: {viewUrl}\n\nThis alert was generated by WhatChanged.`
      },
      {
        message: '🚨 {ticker} Material Change: {summary} View: {shortUrl}',
        maxLength: 160
      }
    )

    // New filing alert template
    this.addTemplate('new_filing',
      {
        subject: '📄 New Filing: {ticker} {formType}',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #28a745; margin: 0;">📄 New Filing Alert</h2>
                <p style="margin: 5px 0 0; color: #666;">{ticker} • {formType} • {filedDate}</p>
              </div>

              <div style="line-height: 1.6; color: #333;">
                <p>A new {formType} filing has been submitted for {companyName}.</p>
                {summary}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="{viewUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Filing</a>
              </div>

              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; text-align: center;">
                WhatChanged Alert Service • <a href="{unsubscribe_url}">Unsubscribe</a>
              </p>
            </body>
          </html>
        `,
        text: `📄 New Filing: {ticker} {formType}\n\nFiled: {filedDate}\n{summary}\n\nView filing: {viewUrl}`
      },
      {
        message: '📄 {ticker} filed new {formType}. View: {shortUrl}',
        maxLength: 160
      }
    )
  }

  async dispatchBatch(alerts: AlertMessage[]): Promise<AlertDeliveryResult[]> {
    const results: AlertDeliveryResult[] = []
    const maxConcurrent = 5 // Limit concurrent dispatches

    for (let i = 0; i < alerts.length; i += maxConcurrent) {
      const batch = alerts.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map(alert => this.dispatchAlert(alert))
      )
      results.push(...batchResults)
    }

    return results
  }

  async retryFailedAlert(
    alert: AlertMessage, 
    previousResult: AlertDeliveryResult, 
    attempt: number
  ): Promise<AlertDeliveryResult> {
    const retryPolicy = this.config.retryPolicy || {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000
    }

    if (attempt >= retryPolicy.maxAttempts) {
      throw new AlertDeliveryError(`Max retry attempts reached for alert ${alert.id}`, alert.method, false)
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      retryPolicy.baseDelay * Math.pow(2, attempt),
      retryPolicy.maxDelay
    )

    await new Promise(resolve => setTimeout(resolve, delay))

    const result = await this.dispatchAlert(alert)
    result.retryCount = attempt + 1

    return result
  }

  async healthCheck(): Promise<{
    email: { available: boolean; error?: string }
    sms: { available: boolean; error?: string }
    push: { available: boolean; error?: string }
  }> {
    const results = {
      email: { available: false, error: undefined as string | undefined },
      sms: { available: false, error: undefined as string | undefined },
      push: { available: false, error: undefined as string | undefined }
    }

    // Check email
    if (this.emailProvider) {
      try {
        results.email.available = await this.emailProvider.verifyConnection()
      } catch (error) {
        results.email.error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      results.email.error = 'Email provider not configured'
    }

    // Check SMS
    if (this.smsProvider) {
      try {
        // For Twilio, we can't easily test without sending a message
        // In production, you might send a test message to a verified number
        results.sms.available = true
      } catch (error) {
        results.sms.error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      results.sms.error = 'SMS provider not configured'
    }

    // Push notifications not implemented yet
    results.push.error = 'Push notifications not implemented'

    return results
  }
}

// Error classes
export class AlertDeliveryError extends Error {
  constructor(
    message: string,
    public method: AlertMethod | string,
    public retryable: boolean = true,
    public metadata?: Record<string, any>
  ) {
    super(message)
    this.name = 'AlertDeliveryError'
  }
}

export class AlertConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlertConfigurationError'
  }
}

export class AlertTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlertTemplateError'
  }
}

// Helper functions
export function createAlertDispatcher(): AlertDispatcher {
  const config: AlertDispatchConfig = {
    email: {
      from: env.EMAIL_FROM,
    },
    retryPolicy: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000
    }
  }

  // Add SMS config if available
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
    config.sms = {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      from: env.TWILIO_PHONE_NUMBER
    }
  }

  return new AlertDispatcher(config)
}

export default AlertDispatcher