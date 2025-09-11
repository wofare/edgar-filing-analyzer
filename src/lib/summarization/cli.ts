#!/usr/bin/env node

import { Command } from 'commander'
import SummarizationService from './index'
import { readFileSync, writeFileSync } from 'fs'

const program = new Command()

program
  .name('summarization')
  .description('CLI for SEC filing AI summarization')
  .version('1.0.0')

program
  .command('summarize')
  .description('Summarize filing comparison')
  .requiredOption('-f, --filing <file>', 'Filing comparison JSON file')
  .requiredOption('-t, --ticker <ticker>', 'Stock ticker symbol')
  .option('-o, --output <file>', 'Output summary file (JSON)')
  .option('--format <format>', 'Output format (json|text)', 'json')
  .option('--model <model>', 'AI model to use', 'gpt-4')
  .option('--temperature <temp>', 'Model temperature (0-1)', '0.1')
  .action(async (options) => {
    try {
      const comparisonData = JSON.parse(readFileSync(options.filing, 'utf8'))
      
      const service = new SummarizationService({
        model: options.model,
        temperature: parseFloat(options.temperature)
      })
      
      const summary = await service.summarizeFiling(comparisonData, options.ticker.toUpperCase())
      
      const output = options.format === 'text'
        ? formatSummaryText(summary)
        : JSON.stringify(summary, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Summary written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('section')
  .description('Summarize a specific section')
  .requiredOption('-s, --section <file>', 'Section diff JSON file')
  .requiredOption('-t, --ticker <ticker>', 'Stock ticker symbol')
  .requiredOption('--form <form>', 'Form type (10-K, 10-Q, etc.)')
  .option('-o, --output <file>', 'Output file (JSON)')
  .option('--format <format>', 'Output format (json|text)', 'json')
  .action(async (options) => {
    try {
      const sectionData = JSON.parse(readFileSync(options.section, 'utf8'))
      
      const service = new SummarizationService()
      const summary = await service.summarizeSection(sectionData, options.ticker.toUpperCase(), options.form)
      
      const output = options.format === 'text'
        ? formatSectionSummaryText(summary)
        : JSON.stringify(summary, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Section summary written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('takeaways')
  .description('Generate key takeaways from summary')
  .requiredOption('-s, --summary <file>', 'Filing summary JSON file')
  .option('--price <price>', 'Current stock price')
  .option('--change <change>', 'Price change')
  .option('--volume <volume>', 'Trading volume')
  .action(async (options) => {
    try {
      const summaryData = JSON.parse(readFileSync(options.summary, 'utf8'))
      
      const priceContext = (options.price || options.change || options.volume) ? {
        currentPrice: parseFloat(options.price) || 0,
        priceChange: parseFloat(options.change) || 0,
        volume: parseInt(options.volume) || 0
      } : undefined
      
      const service = new SummarizationService()
      const takeaways = await service.generateKeyTakeaways(summaryData, priceContext)
      
      console.log('Key Takeaways:')
      console.log('==============')
      takeaways.forEach((takeaway, i) => {
        console.log(`${i + 1}. ${takeaway}`)
      })
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('twitter')
  .description('Generate Twitter thread from summary')
  .requiredOption('-s, --summary <file>', 'Filing summary JSON file')
  .option('-o, --output <file>', 'Output thread file')
  .action(async (options) => {
    try {
      const summaryData = JSON.parse(readFileSync(options.summary, 'utf8'))
      
      const service = new SummarizationService()
      const tweets = await service.generateTwitterThread(summaryData)
      
      const output = tweets.map((tweet, i) => `Tweet ${i + 1}/${tweets.length}:\n${tweet}`).join('\n\n')
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Twitter thread written to ${options.output}`)
      } else {
        console.log('Twitter Thread:')
        console.log('===============')
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('batch')
  .description('Batch process multiple filing comparisons')
  .requiredOption('-d, --directory <dir>', 'Directory containing comparison JSON files')
  .requiredOption('-m, --mapping <file>', 'JSON file mapping filenames to tickers')
  .option('-o, --output-dir <dir>', 'Output directory for summaries', './summaries')
  .action(async (options) => {
    try {
      const fs = require('fs')
      const path = require('path')
      
      const mapping = JSON.parse(readFileSync(options.mapping, 'utf8'))
      const files = fs.readdirSync(options.directory).filter((f: string) => f.endsWith('.json'))
      
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true })
      }
      
      const service = new SummarizationService()
      
      console.log(`Processing ${files.length} filing comparisons...`)
      
      for (const file of files) {
        const ticker = mapping[file]
        if (!ticker) {
          console.warn(`No ticker mapping found for ${file}, skipping`)
          continue
        }
        
        try {
          const comparisonData = JSON.parse(readFileSync(path.join(options.directory, file), 'utf8'))
          const summary = await service.summarizeFiling(comparisonData, ticker.toUpperCase())
          
          const outputFile = path.join(options.outputDir, file.replace('.json', '_summary.json'))
          writeFileSync(outputFile, JSON.stringify(summary, null, 2))
          
          console.log(`✓ Processed ${ticker}: ${summary.tldr}`)
        } catch (error) {
          console.error(`✗ Failed to process ${file}:`, error instanceof Error ? error.message : error)
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      console.log('Batch processing complete!')
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

function formatSummaryText(summary: any): string {
  return `
${summary.ticker} ${summary.formType} Summary
${'='.repeat(30)}

📋 TL;DR: ${summary.tldr}

🤔 Why It Matters:
${summary.soWhat.map((point: string, i: number) => `${i + 1}. ${point}`).join('\n')}

📊 Key Highlights:
${summary.keyHighlights.map((highlight: string, i: number) => `• ${highlight}`).join('\n')}

🚨 Material Changes:
${summary.materialChanges.map((change: any, i: number) => `
${i + 1}. ${change.section} (${change.type})
   Summary: ${change.summary}
   Impact: ${change.impact}
   Business Implication: ${change.businessImplication}
`).join('')}

💡 Investor Implications:
${summary.investorImplications.map((impl: string, i: number) => `• ${impl}`).join('\n')}

⚠️ Risk Factors:
${summary.riskFactors.map((risk: string, i: number) => `• ${risk}`).join('\n')}

📈 Overall Impact: ${summary.overallImpact}
🎯 Confidence Score: ${(summary.metadata.confidenceScore * 100).toFixed(0)}%
🤖 Model: ${summary.metadata.model}
⏱️ Processing Time: ${summary.metadata.processingTimeMs}ms
📊 Token Usage: ${summary.metadata.tokenUsage.total} tokens
  `.trim()
}

function formatSectionSummaryText(summary: any): string {
  return `
Section Analysis: ${summary.sectionType}
${'='.repeat(40)}

📝 Summary: ${summary.summary}

🔍 Key Points:
${summary.keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`).join('\n')}

📋 Changes:
${summary.changes.map((change: string, i: number) => `• ${change}`).join('\n')}

🎯 Materiality Assessment: ${summary.materialityAssessment}

🏢 Business Context: ${summary.businessContext}
  `.trim()
}

if (require.main === module) {
  program.parse()
}

export default program