import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  template?: string
  variables?: Record<string, any>
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export class EmailService {
  private transporter: nodemailer.Transporter
  private templates: Map<string, EmailTemplate> = new Map()

  constructor() {
    // Configure transporter based on environment
    if (process.env.EMAIL_PROVIDER === 'sendgrid') {
      this.transporter = nodemailer.createTransporter({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      })
    } else if (process.env.EMAIL_PROVIDER === 'ses') {
      this.transporter = nodemailer.createTransporter({
        service: 'SES',
        auth: {
          user: process.env.AWS_ACCESS_KEY_ID,
          pass: process.env.AWS_SECRET_ACCESS_KEY
        },
        region: process.env.AWS_REGION || 'us-east-1'
      })
    } else {
      // SMTP configuration for other providers
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      })
    }

    this.loadTemplates()
  }

  // Load email templates
  private loadTemplates() {
    // Material Change Alert Template
    this.templates.set('material_change', {
      subject: '🚨 Material Change Alert: {{ticker}}',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Material Change Alert</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e1e5e9; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
              .alert-badge { background: #dc3545; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
              .company-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .changes-list { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
              .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              .unsubscribe { color: #6c757d; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚨 Material Change Alert</h1>
                <p>A significant change has been detected in {{companyName}}'s SEC filing</p>
              </div>
              
              <div class="content">
                <div class="company-info">
                  <h2>{{ticker}} - {{companyName}}</h2>
                  <p><strong>Form Type:</strong> {{formType}}</p>
                  <p><strong>Filed Date:</strong> {{filedDate}}</p>
                  <span class="alert-badge">MATERIAL CHANGE</span>
                </div>

                <h3>Summary</h3>
                <p>{{summary}}</p>

                <div class="changes-list">
                  <h3>Key Changes</h3>
                  <ul>
                    {{changes}}
                  </ul>
                </div>

                <h3>Impact Assessment</h3>
                <p>{{impact}}</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="{{viewUrl}}" class="btn">View Full Analysis</a>
                </div>
              </div>

              <div class="footer">
                <p>This alert was sent because you're monitoring {{ticker}} with WhatChanged.</p>
                <p class="unsubscribe">
                  <a href="{{unsubscribe_url}}">Unsubscribe</a> | 
                  <a href="{{viewUrl}}">Manage Alert Settings</a>
                </p>
                <p>© 2024 WhatChanged. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
🚨 MATERIAL CHANGE ALERT: {{ticker}}

{{companyName}} has filed a {{formType}} with material changes on {{filedDate}}.

SUMMARY:
{{summary}}

KEY CHANGES:
{{changesText}}

IMPACT:
{{impact}}

View full analysis: {{shortUrl}}

This alert was sent because you're monitoring {{ticker}} with WhatChanged.
To unsubscribe: {{unsubscribe_url}}
      `
    })

    // New Filing Alert Template
    this.templates.set('new_filing', {
      subject: '📄 New Filing: {{ticker}} filed {{formType}}',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>New Filing Alert</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e1e5e9; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
              .filing-info { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .btn { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📄 New Filing Alert</h1>
                <p>{{companyName}} has filed a new {{formType}}</p>
              </div>
              
              <div class="content">
                <div class="filing-info">
                  <h2>{{ticker}} - {{companyName}}</h2>
                  <p><strong>Form Type:</strong> {{formType}}</p>
                  <p><strong>Filed Date:</strong> {{filedDate}}</p>
                </div>

                <h3>Summary</h3>
                <p>{{summary}}</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="{{viewUrl}}" class="btn">View Filing Analysis</a>
                </div>
              </div>

              <div class="footer">
                <p>This alert was sent because you're monitoring {{ticker}} with WhatChanged.</p>
                <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{viewUrl}}">Manage Alert Settings</a></p>
                <p>© 2024 WhatChanged. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
📄 NEW FILING ALERT: {{ticker}}

{{companyName}} has filed a {{formType}} on {{filedDate}}.

SUMMARY:
{{summary}}

View filing analysis: {{shortUrl}}

This alert was sent because you're monitoring {{ticker}} with WhatChanged.
To unsubscribe: {{unsubscribe_url}}
      `
    })

    // Welcome Email Template
    this.templates.set('welcome', {
      subject: 'Welcome to WhatChanged - Start monitoring SEC filings',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Welcome to WhatChanged</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #007bff 0%, #6610f2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e1e5e9; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
              .feature { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to WhatChanged! 🎉</h1>
                <p>Never miss a material change in SEC filings again</p>
              </div>
              
              <div class="content">
                <h2>Hi {{name}},</h2>
                <p>Thank you for signing up for WhatChanged! You now have access to our AI-powered SEC filing analysis platform.</p>

                <div class="feature">
                  <h3>🚨 Real-time Alerts</h3>
                  <p>Get notified instantly when companies you follow make material changes to their filings.</p>
                </div>

                <div class="feature">
                  <h3>🤖 AI Analysis</h3>
                  <p>Our advanced AI analyzes every filing to identify what really matters to investors.</p>
                </div>

                <div class="feature">
                  <h3>📊 Price Integration</h3>
                  <p>See real-time stock prices and charts alongside filing data for complete context.</p>
                </div>

                <h3>Get Started:</h3>
                <ol>
                  <li>Add companies to your watchlist</li>
                  <li>Configure your alert preferences</li>
                  <li>Start receiving intelligent alerts</li>
                </ol>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
                </div>
              </div>

              <div class="footer">
                <p>Need help? Reply to this email or check out our <a href="{{helpUrl}}">help center</a>.</p>
                <p>© 2024 WhatChanged. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to WhatChanged! 🎉

Hi {{name}},

Thank you for signing up! You now have access to our AI-powered SEC filing analysis platform.

FEATURES:
🚨 Real-time Alerts - Get notified of material changes
🤖 AI Analysis - Intelligent filing analysis  
📊 Price Integration - Real-time stock data

GET STARTED:
1. Add companies to your watchlist
2. Configure your alert preferences  
3. Start receiving intelligent alerts

Go to Dashboard: {{dashboardUrl}}

Need help? Reply to this email.

© 2024 WhatChanged. All rights reserved.
      `
    })
  }

  // Send email with template
  async sendEmail(options: EmailOptions): Promise<{
    success: boolean
    messageId?: string
    error?: string
  }> {
    try {
      let { subject, html, text } = options

      // Use template if specified
      if (options.template) {
        const template = this.templates.get(options.template)
        if (!template) {
          throw new Error(`Template not found: ${options.template}`)
        }

        subject = this.renderTemplate(template.subject, options.variables || {})
        html = this.renderTemplate(template.html, options.variables || {})
        text = this.renderTemplate(template.text, options.variables || {})
      }

      // Prepare email options
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@whatchanged.com',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject,
        html,
        text,
        attachments: options.attachments
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions)

      console.log(`Email sent successfully: ${info.messageId}`)

      // Log email to database for tracking
      await this.logEmail({
        to: Array.isArray(options.to) ? options.to[0] : options.to,
        subject,
        template: options.template,
        messageId: info.messageId,
        status: 'sent'
      })

      return {
        success: true,
        messageId: info.messageId
      }

    } catch (error) {
      console.error('Email send failed:', error)

      // Log failed email
      await this.logEmail({
        to: Array.isArray(options.to) ? options.to[0] : options.to,
        subject: options.subject,
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

  // Send welcome email to new user
  async sendWelcomeEmail(user: {
    email: string
    name?: string | null
  }): Promise<{ success: boolean; error?: string }> {
    return await this.sendEmail({
      to: user.email,
      template: 'welcome',
      variables: {
        name: user.name || 'there',
        dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
        helpUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/help`
      }
    })
  }

  // Send material change alert
  async sendMaterialChangeAlert(alert: {
    email: string
    ticker: string
    companyName: string
    formType: string
    filedDate: string
    summary: string
    changes: string[]
    impact: string
  }): Promise<{ success: boolean; error?: string }> {
    const changesHtml = alert.changes.map(change => `<li>${change}</li>`).join('')
    const changesText = alert.changes.map(change => `• ${change}`).join('\n')

    return await this.sendEmail({
      to: alert.email,
      template: 'material_change',
      variables: {
        ticker: alert.ticker,
        companyName: alert.companyName,
        formType: alert.formType,
        filedDate: alert.filedDate,
        summary: alert.summary,
        changes: changesHtml,
        changesText,
        impact: alert.impact,
        viewUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/stocks/${alert.ticker}`,
        shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/s/${alert.ticker}`,
        unsubscribe_url: `${process.env.NEXT_PUBLIC_BASE_URL}/unsubscribe`
      }
    })
  }

  // Send new filing alert
  async sendNewFilingAlert(alert: {
    email: string
    ticker: string
    companyName: string
    formType: string
    filedDate: string
    summary: string
  }): Promise<{ success: boolean; error?: string }> {
    return await this.sendEmail({
      to: alert.email,
      template: 'new_filing',
      variables: {
        ticker: alert.ticker,
        companyName: alert.companyName,
        formType: alert.formType,
        filedDate: alert.filedDate,
        summary: alert.summary,
        viewUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/stocks/${alert.ticker}`,
        shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/s/${alert.ticker}`,
        unsubscribe_url: `${process.env.NEXT_PUBLIC_BASE_URL}/unsubscribe`
      }
    })
  }

  // Test email configuration
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify()
      return { success: true }
    } catch (error) {
      console.error('Email connection test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  // Render template with variables
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      rendered = rendered.replace(regex, String(value || ''))
    }
    return rendered
  }

  // Log email to database
  private async logEmail(log: {
    to: string
    subject: string
    template?: string
    messageId?: string
    status: 'sent' | 'failed'
    error?: string
  }) {
    try {
      await prisma.emailLog.create({
        data: {
          to: log.to,
          subject: log.subject,
          template: log.template,
          messageId: log.messageId,
          status: log.status,
          error: log.error,
          sentAt: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log email:', error)
    }
  }
}

// Global email service instance
export const emailService = new EmailService()

export default emailService