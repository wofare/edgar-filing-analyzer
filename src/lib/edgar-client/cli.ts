#!/usr/bin/env node

import { Command } from 'commander'
import EdgarClient from './index'
import { writeFileSync } from 'fs'

const program = new Command()
const client = new EdgarClient()

program
  .name('edgar-client')
  .description('CLI for SEC EDGAR data retrieval')
  .version('1.0.0')

program
  .command('company')
  .description('Get company information')
  .argument('<cik>', 'Company CIK (10 digits)')
  .option('-o, --output <file>', 'Output file (JSON)')
  .option('--format <format>', 'Output format (json|table)', 'json')
  .action(async (cik: string, options) => {
    try {
      const company = await client.getCompanyInfo(cik)
      
      const output = options.format === 'table' 
        ? formatCompanyTable(company)
        : JSON.stringify(company, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Company data written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('filings')
  .description('Get company filings')
  .argument('<cik>', 'Company CIK (10 digits)')
  .option('-f, --form <form>', 'Filter by form type (e.g., 10-K, 10-Q)')
  .option('-c, --count <count>', 'Number of filings to retrieve', '10')
  .option('--after <date>', 'Filings after date (YYYY-MM-DD)')
  .option('--before <date>', 'Filings before date (YYYY-MM-DD)')
  .option('-o, --output <file>', 'Output file (JSON)')
  .option('--format <format>', 'Output format (json|table)', 'json')
  .action(async (cik: string, options) => {
    try {
      const filings = await client.getCompanyFilings(cik, {
        form: options.form,
        count: parseInt(options.count),
        after: options.after,
        before: options.before
      })
      
      const output = options.format === 'table'
        ? formatFilingsTable(filings)
        : JSON.stringify(filings, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Filings data written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('search')
  .description('Search for companies')
  .argument '<query>', 'Search query (company name or ticker)'
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (query: string, options) => {
    try {
      const results = await client.searchCompanies(query)
      
      const output = options.format === 'table'
        ? formatSearchTable(results)
        : JSON.stringify(results, null, 2)
      
      console.log(output)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('filing')
  .description('Get specific filing content')
  .argument('<cik>', 'Company CIK (10 digits)')
  .argument('<accession>', 'Accession number')
  .option('-o, --output <file>', 'Output file')
  .option('--content-only', 'Output only filing content')
  .action(async (cik: string, accession: string, options) => {
    try {
      const filing = await client.getFilingContent(cik, accession)
      
      const output = options.contentOnly 
        ? filing.content
        : JSON.stringify(filing, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Filing content written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('rate-limit')
  .description('Check current rate limit status')
  .action(() => {
    const status = client.getRateLimitStatus()
    console.log('Rate Limit Status:')
    console.log(`  Requests per second: ${status.requestsPerSecond}`)
    console.log(`  Requests in last second: ${status.requestsInLastSecond}`)
    console.log(`  Next allowed request: ${new Date(status.nextAllowedRequest).toISOString()}`)
  })

function formatCompanyTable(company: any): string {
  return `
Company Information:
  Name: ${company.name}
  CIK: ${company.cik}
  Tickers: ${company.tickers.join(', ')}
  SIC: ${company.sic} (${company.sicDescription})
  Industry: ${company.category}
  Website: ${company.website}
  Recent Filings: ${company.filings.recent.form.slice(0, 5).join(', ')}
  `.trim()
}

function formatFilingsTable(filings: any[]): string {
  const header = 'Form Type'.padEnd(10) + 'Filed Date'.padEnd(12) + 'Accession Number'.padEnd(22) + 'Description'
  const separator = '-'.repeat(80)
  
  const rows = filings.map(f => 
    f.form.padEnd(10) + 
    f.filingDate.padEnd(12) + 
    f.accessionNumber.padEnd(22) + 
    (f.primaryDocDescription || 'N/A').substring(0, 30)
  )
  
  return [header, separator, ...rows].join('\n')
}

function formatSearchTable(results: any[]): string {
  const header = 'Ticker'.padEnd(8) + 'CIK'.padEnd(12) + 'Company Name'
  const separator = '-'.repeat(60)
  
  const rows = results.map(r => 
    (r.ticker || 'N/A').padEnd(8) + 
    r.cik.padEnd(12) + 
    r.name
  )
  
  return [header, separator, ...rows].join('\n')
}

if (require.main === module) {
  program.parse()
}

export default program