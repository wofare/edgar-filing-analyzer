#!/usr/bin/env node

const { apiDocGenerator } = require('../src/lib/docs/generator.ts')
const path = require('path')

async function generateDocumentation() {
  try {
    console.log('🚀 Starting API documentation generation...')
    
    const outputDir = process.argv[2] || './docs/api'
    const resolvedOutputDir = path.resolve(outputDir)
    
    console.log(`📁 Output directory: ${resolvedOutputDir}`)
    
    const results = await apiDocGenerator.saveDocumentation(resolvedOutputDir)
    
    console.log('✅ API documentation generated successfully!')
    console.log(`📄 OpenAPI spec: ${results.openApiPath}`)
    console.log(`📖 Markdown docs: ${results.markdownPath}`)
    console.log(`📮 Postman collection: ${results.postmanPath}`)
    
    // Additional validation
    console.log('\n🔍 Validating generated files...')
    
    const fs = require('fs')
    const files = [results.openApiPath, results.markdownPath, results.postmanPath]
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file)
        console.log(`✓ ${path.basename(file)} (${(stats.size / 1024).toFixed(1)} KB)`)
      } else {
        console.error(`✗ ${path.basename(file)} - File not found`)
      }
    }
    
    console.log('\n🎉 Documentation generation completed!')
    console.log('\nNext steps:')
    console.log('1. Review the generated documentation files')
    console.log('2. Host the OpenAPI spec for interactive documentation')
    console.log('3. Import the Postman collection for API testing')
    console.log('4. Update any custom examples or descriptions as needed')
    
  } catch (error) {
    console.error('❌ Failed to generate API documentation:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  generateDocumentation()
}

module.exports = { generateDocumentation }