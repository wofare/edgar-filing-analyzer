#!/usr/bin/env node

import { Command } from 'commander'
import { DiffEngine, FilingDocument } from './index'
import { readFileSync, writeFileSync } from 'fs'

const program = new Command()
const diffEngine = new DiffEngine()

program
  .name('diff-engine')
  .description('CLI for SEC filing diff analysis')
  .version('1.0.0')

program
  .command('compare')
  .description('Compare two filings')
  .requiredOption('-c, --current <file>', 'Current filing JSON file')
  .option('-p, --previous <file>', 'Previous filing JSON file')
  .option('-o, --output <file>', 'Output comparison file (JSON)')
  .option('--format <format>', 'Output format (json|summary)', 'json')
  .action(async (options) => {
    try {
      const currentFiling: FilingDocument = JSON.parse(readFileSync(options.current, 'utf8'))
      const previousFiling: FilingDocument | null = options.previous 
        ? JSON.parse(readFileSync(options.previous, 'utf8'))
        : null

      const comparison = await diffEngine.compareFilings(previousFiling, currentFiling)
      
      const output = options.format === 'summary'
        ? formatComparisonSummary(comparison)
        : JSON.stringify(comparison, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Comparison written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('extract-sections')
  .description('Extract sections from a filing')
  .argument('<file>', 'Filing content file')
  .option('-t, --type <type>', 'Form type (10-K, 10-Q, 8-K)', '10-K')
  .option('-o, --output <file>', 'Output sections file (JSON)')
  .option('--format <format>', 'Output format (json|list)', 'json')
  .action((file: string, options) => {
    try {
      const content = readFileSync(file, 'utf8')
      const sections = DiffEngine.extractSections(content, options.type)
      
      const output = options.format === 'list'
        ? formatSectionsList(sections)
        : JSON.stringify(sections, null, 2)
      
      if (options.output) {
        writeFileSync(options.output, output)
        console.log(`Sections written to ${options.output}`)
      } else {
        console.log(output)
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('analyze-section')
  .description('Analyze changes in a specific section')
  .requiredOption('-s, --section <type>', 'Section type (BUSINESS, MD_A, etc.)')
  .requiredOption('-c, --current <file>', 'Current filing JSON file')
  .option('-p, --previous <file>', 'Previous filing JSON file')
  .action(async (options) => {
    try {
      const currentFiling: FilingDocument = JSON.parse(readFileSync(options.current, 'utf8'))
      const previousFiling: FilingDocument | null = options.previous 
        ? JSON.parse(readFileSync(options.previous, 'utf8'))
        : null

      const comparison = await diffEngine.compareFilings(previousFiling, currentFiling)
      const section = comparison.sections.find(s => s.sectionType === options.section)
      
      if (!section) {
        console.error(`Section ${options.section} not found`)
        process.exit(1)
      }
      
      console.log(formatSectionAnalysis(section))
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

program
  .command('summary')
  .description('Generate quick summary of filing changes')
  .requiredOption('-c, --current <file>', 'Current filing JSON file')
  .option('-p, --previous <file>', 'Previous filing JSON file')
  .option('--threshold <score>', 'Materiality threshold (0-1)', '0.5')
  .action(async (options) => {
    try {
      const currentFiling: FilingDocument = JSON.parse(readFileSync(options.current, 'utf8'))
      const previousFiling: FilingDocument | null = options.previous 
        ? JSON.parse(readFileSync(options.previous, 'utf8'))
        : null
      const threshold = parseFloat(options.threshold)

      const comparison = await diffEngine.compareFilings(previousFiling, currentFiling)
      const materialSections = comparison.sections.filter(s => s.materialityScore >= threshold)
      
      console.log('Filing Change Summary')
      console.log('===================')
      console.log(`Company: ${currentFiling.cik}`)
      console.log(`Form: ${currentFiling.formType}`)
      console.log(`Filed: ${currentFiling.filedDate}`)
      console.log(`Total Sections: ${comparison.summary.totalSections}`)
      console.log(`Changed Sections: ${comparison.summary.changedSections}`)
      console.log(`Material Changes: ${comparison.summary.materialChanges}`)
      console.log(`Overall Impact: ${comparison.summary.impactAssessment}`)
      console.log(`Materiality Score: ${comparison.summary.overallMaterialityScore}`)
      console.log('')
      
      if (materialSections.length > 0) {
        console.log('Material Changes:')
        materialSections.forEach(section => {
          console.log(`  • ${section.sectionName} (${section.materialityScore.toFixed(2)}): ${section.summary}`)
        })
      } else {
        console.log('No material changes detected above threshold')
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

function formatComparisonSummary(comparison: any): string {
  const summary = comparison.summary
  return `
Filing Comparison Summary
========================
Total Sections: ${summary.totalSections}
Changed Sections: ${summary.changedSections}
Added Sections: ${summary.addedSections}
Removed Sections: ${summary.removedSections}
Material Changes: ${summary.materialChanges}
Overall Materiality: ${summary.overallMaterialityScore}
Impact Assessment: ${summary.impactAssessment}

Key Changes:
${summary.keyChanges.map((change: string, i: number) => `${i + 1}. ${change}`).join('\n')}

Processing Time: ${comparison.metadata.processingTimeMs}ms
Engine Version: ${comparison.metadata.engineVersion}
  `.trim()
}

function formatSectionsList(sections: any[]): string {
  return sections.map(section => 
    `${section.type.padEnd(20)} ${section.name} (Lines ${section.lineStart}-${section.lineEnd})`
  ).join('\n')
}

function formatSectionAnalysis(section: any): string {
  return `
Section Analysis: ${section.sectionName}
=====================================
Type: ${section.sectionType}
Materiality Score: ${section.materialityScore}
Summary: ${section.summary}
Impact: ${section.impact || 'No specific impact noted'}

Changes Detected: ${section.changes.length}
${section.changes.map((change: any, i: number) => `
  ${i + 1}. ${change.changeType.toUpperCase()}
     Significance: ${change.significance}
     Keywords: ${change.keywords.join(', ') || 'None'}
     Context: ${change.context.substring(0, 100)}...
`).join('')}
  `.trim()
}

if (require.main === module) {
  program.parse()
}

export default program