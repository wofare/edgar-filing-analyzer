#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// API documentation generator
class APIDocGenerator {
  constructor() {
    this.apiRoutes = []
    this.routesDir = path.join(process.cwd(), 'src/app/api')
    this.outputDir = path.join(process.cwd(), 'docs/api')
  }

  async generate() {
    console.log('🚀 Generating API documentation...')
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true })
      }

      // Find all API route files
      await this.findApiRoutes()
      
      // Parse routes and extract documentation
      await this.parseRoutes()
      
      // Generate documentation files
      await this.generateDocs()
      
      console.log(`✅ API documentation generated at ${this.outputDir}`)
      console.log(`📊 Total endpoints documented: ${this.apiRoutes.length}`)
      
    } catch (error) {
      console.error('❌ Failed to generate API documentation:', error.message)
      process.exit(1)
    }
  }

  async findApiRoutes() {
    const pattern = path.join(this.routesDir, '**/route.{ts,js}')
    const files = glob.sync(pattern)
    
    for (const file of files) {
      const relativePath = path.relative(this.routesDir, file)
      const routePath = this.extractRoutePath(relativePath)
      
      this.apiRoutes.push({
        file,
        path: routePath,
        methods: [],
        documentation: null
      })
    }
  }

  extractRoutePath(relativePath) {
    // Convert file path to API route
    // e.g., "stocks/[ticker]/overview/route.ts" -> "/api/stocks/:ticker/overview"
    const parts = relativePath.split(path.sep)
    parts.pop() // Remove 'route.ts'
    
    const routeParts = parts.map(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        // Convert [param] to :param
        return ':' + part.slice(1, -1)
      }
      return part
    })
    
    return '/api/' + routeParts.join('/')
  }

  async parseRoutes() {
    for (const route of this.apiRoutes) {
      try {
        const content = fs.readFileSync(route.file, 'utf8')
        
        // Extract HTTP methods (GET, POST, PUT, DELETE, etc.)
        const methods = this.extractHttpMethods(content)
        route.methods = methods
        
        // Extract JSDoc comments and inline documentation
        const docs = this.extractDocumentation(content, route.path)
        route.documentation = docs
        
      } catch (error) {
        console.warn(`Warning: Could not parse ${route.file}:`, error.message)
      }
    }
  }

  extractHttpMethods(content) {
    const methods = []
    const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g
    let match
    
    while ((match = methodRegex.exec(content)) !== null) {
      methods.push(match[1])
    }
    
    return methods
  }

  extractDocumentation(content, routePath) {
    const docs = {
      description: '',
      parameters: [],
      responses: [],
      examples: [],
      authentication: false,
      rateLimit: null
    }

    // Extract JSDoc comments
    const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g
    let match
    
    while ((match = jsdocRegex.exec(content)) !== null) {
      const comment = match[1]
      
      // Parse JSDoc tags
      this.parseJSDocComment(comment, docs)
    }

    // Extract inline documentation patterns
    this.extractInlineDocumentation(content, docs, routePath)
    
    return docs
  }

  parseJSDocComment(comment, docs) {
    const lines = comment.split('\n').map(line => line.replace(/^\s*\*\s?/, ''))
    
    let currentTag = null
    let currentContent = []
    
    for (const line of lines) {
      if (line.startsWith('@')) {
        // Process previous tag
        if (currentTag && currentContent.length > 0) {
          this.processJSDocTag(currentTag, currentContent.join('\n'), docs)
        }
        
        // Start new tag
        const tagMatch = line.match(/@(\w+)(.*)/)
        if (tagMatch) {
          currentTag = tagMatch[1]
          currentContent = [tagMatch[2].trim()]
        }
      } else if (currentTag) {
        currentContent.push(line)
      } else {
        // Main description
        if (line.trim()) {
          docs.description += (docs.description ? '\n' : '') + line
        }
      }
    }
    
    // Process final tag
    if (currentTag && currentContent.length > 0) {
      this.processJSDocTag(currentTag, currentContent.join('\n'), docs)
    }
  }

  processJSDocTag(tag, content, docs) {
    switch (tag) {
      case 'param':
        const paramMatch = content.match(/^(\w+)\s+(.*)$/)
        if (paramMatch) {
          docs.parameters.push({
            name: paramMatch[1],
            description: paramMatch[2],
            required: true // Could be enhanced to parse optional syntax
          })
        }
        break
        
      case 'returns':
      case 'return':
        docs.responses.push({
          status: 200,
          description: content,
          example: null
        })
        break
        
      case 'example':
        docs.examples.push({
          title: 'Example',
          code: content
        })
        break
        
      case 'auth':
      case 'authentication':
        docs.authentication = true
        break
        
      case 'rateLimit':
        docs.rateLimit = content
        break
    }
  }

  extractInlineDocumentation(content, docs, routePath) {
    // Extract path parameters from route
    const pathParams = routePath.match(/:(\w+)/g)
    if (pathParams) {
      pathParams.forEach(param => {
        const paramName = param.substring(1)
        if (!docs.parameters.find(p => p.name === paramName)) {
          docs.parameters.push({
            name: paramName,
            description: `Path parameter: ${paramName}`,
            required: true,
            in: 'path'
          })
        }
      })
    }

    // Look for validation schemas
    const schemaMatches = content.match(/(\w+Schema)\.parse/g)
    if (schemaMatches) {
      docs.validation = schemaMatches.map(match => match.replace('.parse', ''))
    }

    // Look for response patterns
    const responseMatches = content.match(/Response\.json\([^)]+\)/g)
    if (responseMatches && docs.responses.length === 0) {
      docs.responses.push({
        status: 200,
        description: 'Success response',
        example: 'See implementation for response structure'
      })
    }

    // Check for authentication middleware
    if (content.includes('auth') || content.includes('token') || content.includes('user')) {
      docs.authentication = true
    }
  }

  async generateDocs() {
    // Generate main API documentation
    await this.generateMainDocs()
    
    // Generate individual endpoint documentation
    await this.generateEndpointDocs()
    
    // Generate OpenAPI/Swagger specification
    await this.generateOpenAPISpec()
    
    // Generate Postman collection
    await this.generatePostmanCollection()
  }

  async generateMainDocs() {
    const markdown = this.generateMainMarkdown()
    const outputPath = path.join(this.outputDir, 'README.md')
    fs.writeFileSync(outputPath, markdown, 'utf8')
  }

  generateMainMarkdown() {
    const grouped = this.groupRoutesByCategory()
    
    let markdown = `# WhatChanged API Documentation

## Overview

This document describes the REST API endpoints for the WhatChanged SEC filing analysis platform.

## Base URL

\`\`\`
Production: https://api.whatchanged.app
Development: http://localhost:3000/api
\`\`\`

## Authentication

Most endpoints require authentication via Bearer token:

\`\`\`
Authorization: Bearer <your_token_here>
\`\`\`

## Rate Limiting

API requests are rate-limited to prevent abuse:
- Free tier: 100 requests per hour
- Pro tier: 1000 requests per hour
- Enterprise: Custom limits

## API Endpoints

`

    // Generate sections for each category
    for (const [category, routes] of Object.entries(grouped)) {
      markdown += `### ${category}\n\n`
      
      for (const route of routes) {
        markdown += `#### ${route.path}\n\n`
        
        if (route.documentation.description) {
          markdown += `${route.documentation.description}\n\n`
        }
        
        markdown += `**Methods:** ${route.methods.join(', ')}\n\n`
        
        if (route.documentation.authentication) {
          markdown += `**Authentication:** Required\n\n`
        }
        
        if (route.documentation.parameters.length > 0) {
          markdown += `**Parameters:**\n`
          for (const param of route.documentation.parameters) {
            markdown += `- \`${param.name}\` - ${param.description}\n`
          }
          markdown += '\n'
        }
        
        markdown += `[View detailed documentation](./endpoints${route.path.replace(/:/g, '_')}.md)\n\n`
        markdown += '---\n\n'
      }
    }

    markdown += `
## Error Responses

All endpoints return errors in the following format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
\`\`\`

Common HTTP status codes:
- \`400\` - Bad Request (validation errors)
- \`401\` - Unauthorized (authentication required)
- \`403\` - Forbidden (insufficient permissions)
- \`404\` - Not Found
- \`429\` - Too Many Requests (rate limit exceeded)
- \`500\` - Internal Server Error

## Support

For API support, please contact: support@whatchanged.app
`

    return markdown
  }

  groupRoutesByCategory() {
    const grouped = {}
    
    for (const route of this.apiRoutes) {
      const category = this.getCategoryFromPath(route.path)
      
      if (!grouped[category]) {
        grouped[category] = []
      }
      
      grouped[category].push(route)
    }
    
    return grouped
  }

  getCategoryFromPath(path) {
    const parts = path.split('/').filter(part => part)
    if (parts.length >= 2) {
      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1) // Capitalize first letter
    }
    return 'General'
  }

  async generateEndpointDocs() {
    const endpointsDir = path.join(this.outputDir, 'endpoints')
    if (!fs.existsSync(endpointsDir)) {
      fs.mkdirSync(endpointsDir, { recursive: true })
    }
    
    for (const route of this.apiRoutes) {
      const markdown = this.generateEndpointMarkdown(route)
      const filename = route.path.replace(/[:/]/g, '_') + '.md'
      const outputPath = path.join(endpointsDir, filename)
      fs.writeFileSync(outputPath, markdown, 'utf8')
    }
  }

  generateEndpointMarkdown(route) {
    const docs = route.documentation
    
    let markdown = `# ${route.path}

${docs.description || 'No description available'}

## HTTP Methods

${route.methods.map(method => `- **${method}**`).join('\n')}

`

    if (docs.authentication) {
      markdown += `## Authentication

This endpoint requires authentication.

`
    }

    if (docs.parameters.length > 0) {
      markdown += `## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
${docs.parameters.map(param => 
  `| ${param.name} | ${param.in || 'query'} | ${param.required ? 'Yes' : 'No'} | ${param.description} |`
).join('\n')}

`
    }

    if (docs.responses.length > 0) {
      markdown += `## Responses

`
      for (const response of docs.responses) {
        markdown += `### ${response.status}

${response.description}

`
        if (response.example) {
          markdown += `\`\`\`json
${response.example}
\`\`\`

`
        }
      }
    }

    if (docs.examples.length > 0) {
      markdown += `## Examples

`
      for (const example of docs.examples) {
        markdown += `### ${example.title}

\`\`\`
${example.code}
\`\`\`

`
      }
    }

    return markdown
  }

  async generateOpenAPISpec() {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'WhatChanged API',
        version: '1.0.0',
        description: 'SEC filing analysis and alerting API',
        contact: {
          email: 'support@whatchanged.app'
        }
      },
      servers: [
        {
          url: 'https://api.whatchanged.app',
          description: 'Production server'
        },
        {
          url: 'http://localhost:3000/api',
          description: 'Development server'
        }
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }

    // Convert routes to OpenAPI paths
    for (const route of this.apiRoutes) {
      const path = route.path.replace(/:/g, '{') + '}'
      spec.paths[path] = {}
      
      for (const method of route.methods) {
        spec.paths[path][method.toLowerCase()] = this.convertToOpenAPIOperation(route, method)
      }
    }

    const outputPath = path.join(this.outputDir, 'openapi.json')
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf8')
  }

  convertToOpenAPIOperation(route, method) {
    const docs = route.documentation
    
    const operation = {
      summary: docs.description || `${method} ${route.path}`,
      parameters: docs.parameters.map(param => ({
        name: param.name,
        in: param.in || 'query',
        required: param.required,
        description: param.description,
        schema: { type: 'string' }
      })),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      }
    }

    if (docs.authentication) {
      operation.security = [{ bearerAuth: [] }]
    }

    return operation
  }

  async generatePostmanCollection() {
    const collection = {
      info: {
        name: 'WhatChanged API',
        description: 'SEC filing analysis and alerting API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:3000/api',
          type: 'string'
        },
        {
          key: 'token',
          value: 'your_token_here',
          type: 'string'
        }
      ],
      item: []
    }

    const grouped = this.groupRoutesByCategory()

    for (const [category, routes] of Object.entries(grouped)) {
      const folder = {
        name: category,
        item: []
      }

      for (const route of routes) {
        for (const method of route.methods) {
          const request = this.createPostmanRequest(route, method)
          folder.item.push({
            name: `${method} ${route.path}`,
            request
          })
        }
      }

      collection.item.push(folder)
    }

    const outputPath = path.join(this.outputDir, 'postman-collection.json')
    fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf8')
  }

  createPostmanRequest(route, method) {
    const request = {
      method,
      header: [],
      url: {
        raw: '{{baseUrl}}' + route.path,
        host: ['{{baseUrl}}'],
        path: route.path.split('/').filter(part => part)
      }
    }

    if (route.documentation.authentication) {
      request.header.push({
        key: 'Authorization',
        value: 'Bearer {{token}}',
        type: 'text'
      })
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      request.header.push({
        key: 'Content-Type',
        value: 'application/json',
        type: 'text'
      })
      
      request.body = {
        mode: 'raw',
        raw: JSON.stringify({
          // Add example request body based on parameters
        }, null, 2)
      }
    }

    return request
  }
}

// Run the generator
if (require.main === module) {
  const generator = new APIDocGenerator()
  generator.generate().catch(console.error)
}

module.exports = APIDocGenerator