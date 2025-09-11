#!/usr/bin/env node

import { Command } from 'commander'
import { PriceAdapter, createPriceAdapter } from './index'
import { writeFileSync } from 'fs'

const program = new Command()

program
  .name('price-adapter')
  .description('CLI for multi-provider price data')
  .version('1.0.0')

program
  .command('quote')
  .description('Get current stock price')
  .argument('<symbol>', 'Stock symbol (e.g., AAPL)')
  .option('-p, --provider <provider>', 'Force specific provider (alpha|finnhub|yahoo)')
  .option('-o, --output <file>', 'Output file (JSON)')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .option('--skip-cache', 'Skip cache and fetch fresh data')
  .action(async (symbol: string, options) => {
    try {
      const adapter = createPriceAdapter()
      
      const priceData = await adapter.getPriceData(symbol.toUpperCase(), {
        forceProvider: options.provider,
        skipCache: options.skipCache
      })
      
      const output = options.format === 'table'
        ? formatPriceTable(priceData)
        : JSON.stringify(priceData, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Price data written to ${options.output}`)
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
  .description('Search for stock symbols')
  .argument('<query>', 'Search query (company name or partial symbol)')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (query: string, options) => {
    try {
      const adapter = createPriceAdapter()
      const results = await adapter.searchSymbol(query)
      
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
  .command('batch')
  .description('Get quotes for multiple symbols')
  .argument('<symbols...>', 'Stock symbols separated by spaces')
  .option('-o, --output <file>', 'Output file (JSON)')
  .option('--format <format>', 'Output format (json|csv|table)', 'table')
  .option('--provider <provider>', 'Force specific provider')
  .action(async (symbols: string[], options) => {
    try {
      const adapter = createPriceAdapter()
      const results: any[] = []
      
      console.log(`Fetching quotes for ${symbols.length} symbols...`)
      
      for (const symbol of symbols) {
        try {
          const priceData = await adapter.getPriceData(symbol.toUpperCase(), {
            forceProvider: options.provider
          })
          results.push(priceData)
          console.log(`✓ ${symbol}: $${priceData.current.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)`)
        } catch (error) {
          console.error(`✗ ${symbol}: ${error instanceof Error ? error.message : 'Failed'}`)
          results.push({
            symbol: symbol.toUpperCase(),
            error: error instanceof Error ? error.message : 'Failed to fetch'
          })
        }
        
        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      let output: string
      if (options.format === 'csv') {
        output = formatCSV(results)
      } else if (options.format === 'table') {
        output = formatBatchTable(results)
      } else {
        output = JSON.stringify(results, null, 2)
      }
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Batch results written to ${options.output}`)
      } else if (options.format !== 'table') {
        console.log('\nBatch Results:')
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('health')
  .description('Check provider health status')
  .action(async () => {
    try {
      const adapter = createPriceAdapter()
      const health = adapter.getHealthStatus()
      
      console.log('Price Provider Health Status:')
      console.log('=============================')
      
      Object.entries(health).forEach(([provider, status]) => {
        const indicator = status.isHealthy ? '✓' : '✗'
        console.log(`${indicator} ${provider.toUpperCase()}:`)
        console.log(`    Healthy: ${status.isHealthy}`)
        console.log(`    Error Count: ${status.errorCount}`)
        console.log(`    Last Check: ${status.lastCheck.toISOString()}`)
        console.log('')
      })
      
      const healthyCount = Object.values(health).filter(s => s.isHealthy).length
      const totalCount = Object.keys(health).length
      
      console.log(`Overall: ${healthyCount}/${totalCount} providers healthy`)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('cache')
  .description('Cache management')
  .option('--stats', 'Show cache statistics')
  .option('--clear', 'Clear all cached data')
  .action(async (options) => {
    try {
      const adapter = createPriceAdapter()
      
      if (options.clear) {
        adapter.clearCache()
        console.log('✓ Cache cleared')
      }
      
      if (options.stats || !options.clear) {
        const stats = adapter.getCacheStats()
        console.log('Cache Statistics:')
        console.log(`  Entries: ${stats.size}`)
        console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('test')
  .description('Test provider failover')
  .argument('<symbol>', 'Stock symbol to test')
  .option('--simulate-failure <provider>', 'Simulate failure for specific provider')
  .action(async (symbol: string, options) => {
    try {
      const adapter = createPriceAdapter()
      
      console.log(`Testing failover for ${symbol.toUpperCase()}...`)
      console.log('')
      
      // Test each provider individually
      const providers = ['alpha', 'finnhub', 'yahoo']
      
      for (const provider of providers) {
        try {
          console.log(`Testing ${provider}...`)
          const start = Date.now()
          
          const priceData = await adapter.getPriceData(symbol.toUpperCase(), {
            forceProvider: provider,
            skipCache: true
          })
          
          const time = Date.now() - start
          console.log(`✓ ${provider}: $${priceData.current.toFixed(2)} (${time}ms)`)
        } catch (error) {
          console.log(`✗ ${provider}: ${error instanceof Error ? error.message : 'Failed'}`)
        }
        console.log('')
      }
      
      // Test automatic failover
      console.log('Testing automatic failover...')
      try {
        const priceData = await adapter.getPriceData(symbol.toUpperCase(), {
          skipCache: true
        })
        
        console.log(`✓ Failover successful: $${priceData.current.toFixed(2)} (provider: ${priceData.provider})`)
        if (priceData.fallbackUsed) {
          console.log(`  Fallback used: ${priceData.primaryError}`)
        }
      } catch (error) {
        console.log(`✗ Failover failed: ${error instanceof Error ? error.message : 'All providers failed'}`)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('monitor')
  .description('Monitor stock price in real-time')
  .argument('<symbol>', 'Stock symbol to monitor')
  .option('-i, --interval <seconds>', 'Update interval in seconds', '30')
  .option('--threshold <percent>', 'Alert threshold for price changes', '2.0')
  .action(async (symbol: string, options) => {
    try {
      const adapter = createPriceAdapter()
      const interval = parseInt(options.interval) * 1000
      const threshold = parseFloat(options.threshold)
      
      let previousPrice: number | null = null
      
      console.log(`Monitoring ${symbol.toUpperCase()} (${options.interval}s intervals, ${threshold}% threshold)`)
      console.log('Press Ctrl+C to stop')
      console.log('')
      
      const monitor = async () => {
        try {
          const priceData = await adapter.getPriceData(symbol.toUpperCase(), {
            skipCache: true
          })
          
          const timestamp = new Date().toLocaleTimeString()
          let alertFlag = ''
          
          if (previousPrice !== null) {
            const changePercent = ((priceData.current - previousPrice) / previousPrice) * 100
            if (Math.abs(changePercent) >= threshold) {
              alertFlag = ' 🚨'
            }
          }
          
          console.log(`[${timestamp}] ${symbol}: $${priceData.current.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)${alertFlag}`)
          
          previousPrice = priceData.current
        } catch (error) {
          console.log(`[${new Date().toLocaleTimeString()}] Error: ${error instanceof Error ? error.message : 'Failed'}`)
        }
      }
      
      // Initial fetch
      await monitor()
      
      // Set up interval
      const intervalId = setInterval(monitor, interval)
      
      // Handle Ctrl+C
      process.on('SIGINT', () => {
        clearInterval(intervalId)
        console.log('\nMonitoring stopped.')
        process.exit(0)
      })
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

function formatPriceTable(data: any): string {
  return `
${data.symbol} Stock Quote (${data.provider})
${'='.repeat(40)}
Current Price:    $${data.current.toFixed(2)}
Change:           ${data.change >= 0 ? '+' : ''}$${data.change.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)
Open:             $${data.open.toFixed(2)}
High:             $${data.high.toFixed(2)}
Low:              $${data.low.toFixed(2)}
Previous Close:   $${data.previousClose.toFixed(2)}
Volume:           ${data.volume.toLocaleString()}
${data.marketCap ? `Market Cap:       $${(data.marketCap / 1e9).toFixed(1)}B` : ''}
Last Updated:     ${data.lastUpdated.toLocaleString()}
${data.fallbackUsed ? `⚠️  Fallback Used: ${data.primaryError}` : ''}
  `.trim()
}

function formatSearchTable(results: any[]): string {
  if (results.length === 0) {
    return 'No results found.'
  }
  
  const header = 'Symbol'.padEnd(10) + 'Provider'.padEnd(10) + 'Company Name'
  const separator = '-'.repeat(80)
  
  const rows = results.slice(0, 20).map(r =>
    r.symbol.padEnd(10) +
    r.provider.padEnd(10) +
    r.name.substring(0, 60)
  )
  
  return [header, separator, ...rows].join('\n')
}

function formatBatchTable(results: any[]): string {
  const header = 'Symbol'.padEnd(8) + 'Price'.padEnd(12) + 'Change'.padEnd(12) + 'Change %'.padEnd(12) + 'Status'
  const separator = '-'.repeat(80)
  
  const rows = results.map(r => {
    if (r.error) {
      return r.symbol.padEnd(8) + 'ERROR'.padEnd(12) + ''.padEnd(12) + ''.padEnd(12) + r.error.substring(0, 20)
    }
    
    return r.symbol.padEnd(8) +
      `$${r.current.toFixed(2)}`.padEnd(12) +
      `${r.change >= 0 ? '+' : ''}$${r.change.toFixed(2)}`.padEnd(12) +
      `${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(2)}%`.padEnd(12) +
      'OK'
  })
  
  return [header, separator, ...rows].join('\n')
}

function formatCSV(results: any[]): string {
  const header = 'Symbol,Current,Change,ChangePercent,Open,High,Low,Volume,Provider,LastUpdated,Error'
  
  const rows = results.map(r => {
    if (r.error) {
      return `${r.symbol},,,,,,,,,"${r.error}"`
    }
    
    return `${r.symbol},${r.current},${r.change},${r.changePercent},${r.open},${r.high},${r.low},${r.volume},${r.provider},${r.lastUpdated},`
  })
  
  return [header, ...rows].join('\n')
}

if (require.main === module) {
  program.parse()
}

export default program