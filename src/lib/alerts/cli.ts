#!/usr/bin/env node

import { Command } from 'commander'
import { AlertDispatcher, createAlertDispatcher } from './index'
import { AlertMethod, AlertType } from '@prisma/client'
import { readFileSync } from 'fs'

const program = new Command()

program
  .name('alerts')
  .description('CLI for alert dispatch system')
  .version('1.0.0')

program
  .command('send')
  .description('Send a single alert')
  .requiredOption('-r, --recipient <email/phone>', 'Alert recipient')
  .requiredOption('-m, --method <method>', 'Alert method (EMAIL|SMS|PUSH)')
  .requiredOption('-t, --title <title>', 'Alert title')
  .requiredOption('--message <message>', 'Alert message')
  .option('--type <type>', 'Alert type (MATERIAL_CHANGE|NEW_FILING|etc.)', 'MATERIAL_CHANGE')
  .option('--priority <priority>', 'Priority (low|normal|high)', 'normal')
  .option('--template <template>', 'Template name')
  .action(async (options) => {
    try {
      const dispatcher = createAlertDispatcher()
      
      const alert = {
        id: `cli-${Date.now()}`,
        userId: 'cli-user',
        method: options.method.toUpperCase() as AlertMethod,
        recipient: options.recipient,
        title: options.title,
        message: options.message,
        priority: options.priority as 'low' | 'normal' | 'high',
        template: options.template,
        variables: {}
      }
      
      console.log(`Sending ${options.method} alert to ${options.recipient}...`)
      const result = await dispatcher.dispatchAlert(alert)
      
      console.log('Alert Result:')
      console.log(`  Status: ${result.status}`)
      console.log(`  Method: ${result.method}`)
      if (result.deliveredAt) {
        console.log(`  Delivered: ${result.deliveredAt.toISOString()}`)
      }
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`)
      }
      if (result.metadata?.messageId) {
        console.log(`  Message ID: ${result.metadata.messageId}`)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('test-email')
  .description('Send test email alert')
  .requiredOption('-t, --to <email>', 'Recipient email address')
  .option('--ticker <ticker>', 'Stock ticker for test', 'AAPL')
  .action(async (options) => {
    try {
      const dispatcher = createAlertDispatcher()
      
      const alert = {
        id: `test-email-${Date.now()}`,
        userId: 'test-user',
        method: AlertMethod.EMAIL,
        recipient: options.to,
        subject: `🚨 Test Alert: ${options.ticker} Material Change`,
        title: `Material Change Alert: ${options.ticker}`,
        message: `This is a test alert for ${options.ticker}. A material change has been detected in their latest filing.`,
        priority: 'normal' as const,
        template: 'material_change',
        variables: {
          ticker: options.ticker,
          formType: '10-K',
          filedDate: new Date().toISOString().split('T')[0],
          summary: 'Test material change detected',
          changes: '<li>Test change 1</li><li>Test change 2</li>',
          changesText: '• Test change 1\n• Test change 2',
          impact: 'This is a test impact assessment',
          viewUrl: 'https://whatchanged.com/test',
          shortUrl: 'https://wc.co/test',
          unsubscribe_url: 'https://whatchanged.com/unsubscribe/test'
        }
      }
      
      console.log(`Sending test email to ${options.to}...`)
      const result = await dispatcher.sendEmailAlert(alert)
      
      console.log('Test Email Result:')
      console.log(`  Status: ${result.status}`)
      console.log(`  Message ID: ${result.metadata?.messageId}`)
      console.log(`  Delivered: ${result.deliveredAt?.toISOString()}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('test-sms')
  .description('Send test SMS alert')
  .requiredOption('-t, --to <phone>', 'Recipient phone number')
  .option('--ticker <ticker>', 'Stock ticker for test', 'AAPL')
  .action(async (options) => {
    try {
      const dispatcher = createAlertDispatcher()
      
      const alert = {
        id: `test-sms-${Date.now()}`,
        userId: 'test-user',
        method: AlertMethod.SMS,
        recipient: options.to,
        title: `${options.ticker} Alert`,
        message: `🚨 ${options.ticker} Material Change: Test alert message. View: https://wc.co/test`,
        priority: 'normal' as const,
        template: 'material_change',
        variables: {
          ticker: options.ticker,
          summary: 'Test material change',
          shortUrl: 'https://wc.co/test'
        }
      }
      
      console.log(`Sending test SMS to ${options.to}...`)
      const result = await dispatcher.sendSMSAlert(alert)
      
      console.log('Test SMS Result:')
      console.log(`  Status: ${result.status}`)
      console.log(`  SID: ${result.providerResponse?.sid}`)
      console.log(`  Delivered: ${result.deliveredAt?.toISOString()}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('batch')
  .description('Send batch alerts from JSON file')
  .requiredOption('-f, --file <file>', 'JSON file with alert definitions')
  .option('--dry-run', 'Validate alerts without sending')
  .action(async (options) => {
    try {
      const alertsData = JSON.parse(readFileSync(options.file, 'utf8'))
      const alerts = Array.isArray(alertsData) ? alertsData : [alertsData]
      
      if (options.dryRun) {
        console.log(`Validating ${alerts.length} alerts...`)
        
        for (const [i, alert] of alerts.entries()) {
          console.log(`Alert ${i + 1}:`)
          console.log(`  Method: ${alert.method}`)
          console.log(`  Recipient: ${alert.recipient}`)
          console.log(`  Title: ${alert.title}`)
          console.log(`  Message Length: ${alert.message.length} chars`)
          console.log('')
        }
        
        console.log('Dry run complete - no alerts sent')
        return
      }
      
      const dispatcher = createAlertDispatcher()
      console.log(`Sending ${alerts.length} alerts...`)
      
      const results = await dispatcher.dispatchBatch(alerts)
      
      const successful = results.filter(r => r.status === 'SENT').length
      const failed = results.filter(r => r.status === 'FAILED').length
      
      console.log('\nBatch Results:')
      console.log(`  Successful: ${successful}`)
      console.log(`  Failed: ${failed}`)
      console.log(`  Total: ${results.length}`)
      
      // Show failed alerts
      const failedResults = results.filter(r => r.status === 'FAILED')
      if (failedResults.length > 0) {
        console.log('\nFailed Alerts:')
        failedResults.forEach(result => {
          console.log(`  ${result.alertId}: ${result.errorMessage}`)
        })
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('health')
  .description('Check alert system health')
  .action(async () => {
    try {
      const dispatcher = createAlertDispatcher()
      const health = await dispatcher.healthCheck()
      
      console.log('Alert System Health Check:')
      console.log('===========================')
      
      Object.entries(health).forEach(([service, status]) => {
        const indicator = status.available ? '✓' : '✗'
        console.log(`${indicator} ${service.toUpperCase()}: ${status.available ? 'Available' : 'Unavailable'}`)
        
        if (status.error) {
          console.log(`    Error: ${status.error}`)
        }
      })
      
      const overallHealthy = Object.values(health).some(status => status.available)
      console.log(`\nOverall Status: ${overallHealthy ? '✓ Healthy' : '✗ Degraded'}`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('templates')
  .description('List available alert templates')
  .action(() => {
    const templates = [
      {
        name: 'material_change',
        description: 'Material change in SEC filing',
        methods: ['EMAIL', 'SMS'],
        variables: ['ticker', 'formType', 'summary', 'changes', 'impact', 'viewUrl']
      },
      {
        name: 'new_filing',
        description: 'New SEC filing alert',
        methods: ['EMAIL', 'SMS'],
        variables: ['ticker', 'formType', 'filedDate', 'companyName', 'summary', 'viewUrl']
      },
      {
        name: 'default',
        description: 'Basic alert template',
        methods: ['EMAIL', 'SMS'],
        variables: ['title', 'message']
      }
    ]
    
    console.log('Available Alert Templates:')
    console.log('==========================')
    
    templates.forEach(template => {
      console.log(`📋 ${template.name}`)
      console.log(`   Description: ${template.description}`)
      console.log(`   Methods: ${template.methods.join(', ')}`)
      console.log(`   Variables: ${template.variables.join(', ')}`)
      console.log('')
    })
  })

program
  .command('retry')
  .description('Retry a failed alert')
  .requiredOption('-i, --id <id>', 'Alert ID to retry')
  .requiredOption('-f, --file <file>', 'Original alert JSON file')
  .option('--attempt <attempt>', 'Retry attempt number', '1')
  .action(async (options) => {
    try {
      const alertData = JSON.parse(readFileSync(options.file, 'utf8'))
      const alert = Array.isArray(alertData) 
        ? alertData.find(a => a.id === options.id)
        : alertData.id === options.id ? alertData : null
      
      if (!alert) {
        console.error(`Alert with ID ${options.id} not found`)
        process.exit(1)
      }
      
      const dispatcher = createAlertDispatcher()
      
      const previousResult = {
        alertId: options.id,
        method: alert.method,
        status: 'FAILED' as const,
        retryCount: parseInt(options.attempt) - 1,
        errorMessage: 'Previous attempt failed'
      }
      
      console.log(`Retrying alert ${options.id} (attempt ${options.attempt})...`)
      const result = await dispatcher.retryFailedAlert(alert, previousResult, parseInt(options.attempt))
      
      console.log('Retry Result:')
      console.log(`  Status: ${result.status}`)
      console.log(`  Retry Count: ${result.retryCount}`)
      if (result.deliveredAt) {
        console.log(`  Delivered: ${result.deliveredAt.toISOString()}`)
      }
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

if (require.main === module) {
  program.parse()
}

export default program