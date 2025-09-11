import { promises as fs } from 'fs'
import path from 'path'
import { OpenAPIV3 } from 'openapi-types'

export interface APIEndpoint {
  method: string
  path: string
  summary: string
  description: string
  parameters?: APIParameter[]
  requestBody?: APIRequestBody
  responses: APIResponse[]
  tags: string[]
  security?: string[]
  examples?: APIExample[]
}

export interface APIParameter {
  name: string
  in: 'query' | 'path' | 'header'
  required: boolean
  type: string
  description: string
  example?: any
}

export interface APIRequestBody {
  contentType: string
  schema: any
  example?: any
  required: boolean
}

export interface APIResponse {
  statusCode: number
  description: string
  schema?: any
  example?: any
}

export interface APIExample {
  name: string
  description: string
  request?: any
  response?: any
}

export class APIDocumentationGenerator {
  private spec: OpenAPIV3.Document
  private endpoints: APIEndpoint[] = []

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
        title: 'WhatChanged API',
        description: 'SEC filing monitoring and alert system API',
        version: '1.0.0',
        contact: {
          name: 'WhatChanged Support',
          email: 'support@whatchanged.app',
          url: 'https://whatchanged.app'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'https://whatchanged.app/api',
          description: 'Production server'
        },
        {
          url: 'http://localhost:3000/api',
          description: 'Development server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      },
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization'
        },
        {
          name: 'Users',
          description: 'User profile and preferences management'
        },
        {
          name: 'Companies',
          description: 'Company information and search'
        },
        {
          name: 'Filings',
          description: 'SEC filing data and analysis'
        },
        {
          name: 'Watchlists',
          description: 'Company watchlist management'
        },
        {
          name: 'Alerts',
          description: 'Alert configuration and history'
        },
        {
          name: 'Billing',
          description: 'Subscription and payment management'
        },
        {
          name: 'Admin',
          description: 'Administrative operations (admin only)'
        }
      ]
    }

    this.initializeEndpoints()
    this.initializeSchemas()
  }

  private initializeEndpoints() {
    // Authentication endpoints
    this.addEndpoint({
      method: 'POST',
      path: '/auth/register',
      summary: 'Register new user',
      description: 'Create a new user account with email verification',
      tags: ['Authentication'],
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { $ref: '#/components/schemas/UserRegistration' },
        example: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
          name: 'John Doe',
          acceptTerms: true
        }
      },
      responses: [
        {
          statusCode: 201,
          description: 'User registered successfully',
          schema: { $ref: '#/components/schemas/AuthResponse' },
          example: {
            success: true,
            message: 'Registration successful. Please check your email for verification.',
            userId: 'user_123'
          }
        },
        {
          statusCode: 400,
          description: 'Invalid registration data',
          schema: { $ref: '#/components/schemas/Error' }
        }
      ]
    })

    this.addEndpoint({
      method: 'POST',
      path: '/auth/login',
      summary: 'User login',
      description: 'Authenticate user and return JWT token',
      tags: ['Authentication'],
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { $ref: '#/components/schemas/LoginRequest' }
      },
      responses: [
        {
          statusCode: 200,
          description: 'Login successful',
          schema: { $ref: '#/components/schemas/AuthResponse' }
        },
        {
          statusCode: 401,
          description: 'Invalid credentials',
          schema: { $ref: '#/components/schemas/Error' }
        }
      ]
    })

    // User endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/users/profile',
      summary: 'Get user profile',
      description: 'Retrieve current user profile information',
      tags: ['Users'],
      security: ['bearerAuth'],
      responses: [
        {
          statusCode: 200,
          description: 'User profile retrieved successfully',
          schema: { $ref: '#/components/schemas/UserProfile' }
        }
      ]
    })

    this.addEndpoint({
      method: 'PUT',
      path: '/users/profile',
      summary: 'Update user profile',
      description: 'Update user profile information',
      tags: ['Users'],
      security: ['bearerAuth'],
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { $ref: '#/components/schemas/UserProfileUpdate' }
      },
      responses: [
        {
          statusCode: 200,
          description: 'Profile updated successfully',
          schema: { $ref: '#/components/schemas/UserProfile' }
        }
      ]
    })

    // Company endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/companies/search',
      summary: 'Search companies',
      description: 'Search for companies by symbol, name, or industry',
      tags: ['Companies'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          type: 'string',
          description: 'Search query (symbol, name, or industry)',
          example: 'AAPL'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Maximum number of results',
          example: 10
        }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Companies found',
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Company' }
          }
        }
      ]
    })

    this.addEndpoint({
      method: 'GET',
      path: '/companies/{companyId}',
      summary: 'Get company details',
      description: 'Retrieve detailed information about a specific company',
      tags: ['Companies'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'companyId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Company ID',
          example: 'comp_123'
        }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Company details retrieved',
          schema: { $ref: '#/components/schemas/CompanyDetail' }
        },
        {
          statusCode: 404,
          description: 'Company not found',
          schema: { $ref: '#/components/schemas/Error' }
        }
      ]
    })

    // Filing endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/filings',
      summary: 'Get recent filings',
      description: 'Retrieve recent SEC filings with optional filtering',
      tags: ['Filings'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'companyId',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by company ID'
        },
        {
          name: 'formType',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by form type (10-K, 10-Q, 8-K, etc.)'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Maximum number of results'
        },
        {
          name: 'offset',
          in: 'query',
          required: false,
          type: 'integer',
          description: 'Results offset for pagination'
        }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Filings retrieved successfully',
          schema: {
            type: 'object',
            properties: {
              filings: {
                type: 'array',
                items: { $ref: '#/components/schemas/Filing' }
              },
              hasMore: { type: 'boolean' },
              total: { type: 'integer' }
            }
          }
        }
      ]
    })

    this.addEndpoint({
      method: 'GET',
      path: '/filings/{filingId}',
      summary: 'Get filing details',
      description: 'Retrieve detailed information about a specific filing',
      tags: ['Filings'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'filingId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Filing ID'
        }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Filing details retrieved',
          schema: { $ref: '#/components/schemas/FilingDetail' }
        }
      ]
    })

    // Watchlist endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/watchlist',
      summary: 'Get user watchlist',
      description: 'Retrieve user\'s company watchlist',
      tags: ['Watchlists'],
      security: ['bearerAuth'],
      responses: [
        {
          statusCode: 200,
          description: 'Watchlist retrieved successfully',
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/WatchlistItem' }
          }
        }
      ]
    })

    this.addEndpoint({
      method: 'POST',
      path: '/watchlist',
      summary: 'Add company to watchlist',
      description: 'Add a company to user\'s watchlist',
      tags: ['Watchlists'],
      security: ['bearerAuth'],
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { $ref: '#/components/schemas/AddToWatchlist' }
      },
      responses: [
        {
          statusCode: 201,
          description: 'Company added to watchlist',
          schema: { $ref: '#/components/schemas/WatchlistItem' }
        }
      ]
    })

    this.addEndpoint({
      method: 'DELETE',
      path: '/watchlist/{companyId}',
      summary: 'Remove company from watchlist',
      description: 'Remove a company from user\'s watchlist',
      tags: ['Watchlists'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'companyId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Company ID to remove'
        }
      ],
      responses: [
        {
          statusCode: 204,
          description: 'Company removed from watchlist'
        }
      ]
    })

    // Alert endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/alerts',
      summary: 'Get user alerts',
      description: 'Retrieve user\'s alerts with optional filtering',
      tags: ['Alerts'],
      security: ['bearerAuth'],
      parameters: [
        {
          name: 'status',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by alert status'
        },
        {
          name: 'type',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by alert type'
        }
      ],
      responses: [
        {
          statusCode: 200,
          description: 'Alerts retrieved successfully',
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Alert' }
          }
        }
      ]
    })

    // Billing endpoints
    this.addEndpoint({
      method: 'GET',
      path: '/billing/subscription',
      summary: 'Get current subscription',
      description: 'Retrieve user\'s current subscription details',
      tags: ['Billing'],
      security: ['bearerAuth'],
      responses: [
        {
          statusCode: 200,
          description: 'Subscription details retrieved',
          schema: { $ref: '#/components/schemas/Subscription' }
        }
      ]
    })

    this.addEndpoint({
      method: 'POST',
      path: '/billing/checkout',
      summary: 'Create checkout session',
      description: 'Create a Stripe checkout session for subscription upgrade',
      tags: ['Billing'],
      security: ['bearerAuth'],
      requestBody: {
        contentType: 'application/json',
        required: true,
        schema: { $ref: '#/components/schemas/CheckoutRequest' }
      },
      responses: [
        {
          statusCode: 200,
          description: 'Checkout session created',
          schema: { $ref: '#/components/schemas/CheckoutResponse' }
        }
      ]
    })
  }

  private initializeSchemas() {
    this.spec.components!.schemas = {
      // User schemas
      UserRegistration: {
        type: 'object',
        required: ['email', 'password', 'name', 'acceptTerms'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string' },
          phone: { type: 'string' },
          acceptTerms: { type: 'boolean' },
          acceptMarketing: { type: 'boolean' }
        }
      },

      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      },

      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          phone: { type: 'string' },
          emailVerified: { type: 'string', format: 'date-time' },
          phoneVerified: { type: 'string', format: 'date-time' },
          subscription: { $ref: '#/components/schemas/Subscription' },
          preferences: { $ref: '#/components/schemas/UserPreferences' }
        }
      },

      UserPreferences: {
        type: 'object',
        properties: {
          emailAlerts: { type: 'boolean' },
          smsAlerts: { type: 'boolean' },
          dailySummary: { type: 'boolean' },
          marketingEmails: { type: 'boolean' },
          timezone: { type: 'string' },
          alertThreshold: { type: 'number', minimum: 0, maximum: 1 }
        }
      },

      // Company schemas
      Company: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          cik: { type: 'string' },
          industry: { type: 'string' },
          currentPrice: { type: 'number' },
          priceChange: { type: 'number' },
          priceChangePercent: { type: 'number' },
          lastPriceUpdate: { type: 'string', format: 'date-time' }
        }
      },

      CompanyDetail: {
        allOf: [
          { $ref: '#/components/schemas/Company' },
          {
            type: 'object',
            properties: {
              sic: { type: 'string' },
              description: { type: 'string' },
              recentFilings: {
                type: 'array',
                items: { $ref: '#/components/schemas/Filing' }
              }
            }
          }
        ]
      },

      // Filing schemas
      Filing: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          accessionNo: { type: 'string' },
          cik: { type: 'string' },
          ticker: { type: 'string' },
          companyName: { type: 'string' },
          formType: { type: 'string' },
          filedDate: { type: 'string', format: 'date-time' },
          reportDate: { type: 'string', format: 'date-time' },
          summary: { type: 'string' },
          keyHighlights: {
            type: 'array',
            items: { type: 'string' }
          },
          investorImplications: {
            type: 'array',
            items: { type: 'string' }
          },
          url: { type: 'string', format: 'uri' }
        }
      },

      FilingDetail: {
        allOf: [
          { $ref: '#/components/schemas/Filing' },
          {
            type: 'object',
            properties: {
              content: { type: 'string' },
              diffs: {
                type: 'array',
                items: { $ref: '#/components/schemas/FilingDiff' }
              }
            }
          }
        ]
      },

      FilingDiff: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          section: { type: 'string' },
          changeType: { type: 'string', enum: ['added', 'removed', 'modified'] },
          materialityScore: { type: 'number', minimum: 0, maximum: 1 },
          summary: { type: 'string' },
          oldContent: { type: 'string' },
          newContent: { type: 'string' }
        }
      },

      // Watchlist schemas
      WatchlistItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          company: { $ref: '#/components/schemas/Company' },
          alertsEnabled: { type: 'boolean' },
          materialityThreshold: { type: 'number', minimum: 0, maximum: 1 },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },

      AddToWatchlist: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
          alertsEnabled: { type: 'boolean', default: true },
          materialityThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 }
        }
      },

      // Alert schemas
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          message: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
          createdAt: { type: 'string', format: 'date-time' },
          scheduledFor: { type: 'string', format: 'date-time' },
          filing: { $ref: '#/components/schemas/Filing' }
        }
      },

      // Billing schemas
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          planId: { type: 'string' },
          status: { type: 'string' },
          currentPeriodStart: { type: 'string', format: 'date-time' },
          currentPeriodEnd: { type: 'string', format: 'date-time' },
          cancelAtPeriodEnd: { type: 'boolean' }
        }
      },

      CheckoutRequest: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' },
          successUrl: { type: 'string', format: 'uri' },
          cancelUrl: { type: 'string', format: 'uri' }
        }
      },

      CheckoutResponse: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          checkoutUrl: { type: 'string', format: 'uri' }
        }
      },

      // Common schemas
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/UserProfile' }
        }
      },

      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' }
        }
      },

      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              hasMore: { type: 'boolean' }
            }
          }
        }
      }
    }
  }

  addEndpoint(endpoint: APIEndpoint) {
    this.endpoints.push(endpoint)
    
    // Convert to OpenAPI format
    if (!this.spec.paths[endpoint.path]) {
      this.spec.paths[endpoint.path] = {}
    }

    const method = endpoint.method.toLowerCase() as keyof OpenAPIV3.PathItemObject
    this.spec.paths[endpoint.path][method] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      security: endpoint.security ? [{ bearerAuth: [] }] : undefined,
      parameters: endpoint.parameters?.map(param => ({
        name: param.name,
        in: param.in,
        required: param.required,
        schema: { type: param.type },
        description: param.description,
        example: param.example
      })),
      requestBody: endpoint.requestBody ? {
        required: endpoint.requestBody.required,
        content: {
          [endpoint.requestBody.contentType]: {
            schema: endpoint.requestBody.schema,
            example: endpoint.requestBody.example
          }
        }
      } : undefined,
      responses: endpoint.responses.reduce((acc, response) => {
        acc[response.statusCode.toString()] = {
          description: response.description,
          content: response.schema ? {
            'application/json': {
              schema: response.schema,
              example: response.example
            }
          } : undefined
        }
        return acc
      }, {} as OpenAPIV3.ResponsesObject)
    }
  }

  // Generate documentation files
  async generateOpenAPISpec(): Promise<string> {
    return JSON.stringify(this.spec, null, 2)
  }

  async generateMarkdownDocs(): Promise<string> {
    let markdown = `# WhatChanged API Documentation\n\n`
    markdown += `${this.spec.info.description}\n\n`
    markdown += `**Version:** ${this.spec.info.version}\n\n`

    // Authentication section
    markdown += `## Authentication\n\n`
    markdown += `The API uses Bearer token authentication. Include your token in the Authorization header:\n\n`
    markdown += '```\nAuthorization: Bearer YOUR_TOKEN_HERE\n```\n\n'

    // Base URLs
    markdown += `## Base URLs\n\n`
    this.spec.servers?.forEach(server => {
      markdown += `- ${server.description}: \`${server.url}\`\n`
    })
    markdown += '\n'

    // Endpoints by tag
    const endpointsByTag = this.endpoints.reduce((acc, endpoint) => {
      endpoint.tags.forEach(tag => {
        if (!acc[tag]) acc[tag] = []
        acc[tag].push(endpoint)
      })
      return acc
    }, {} as Record<string, APIEndpoint[]>)

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      markdown += `## ${tag}\n\n`
      
      endpoints.forEach(endpoint => {
        markdown += `### ${endpoint.method.toUpperCase()} ${endpoint.path}\n\n`
        markdown += `${endpoint.description}\n\n`

        // Parameters
        if (endpoint.parameters && endpoint.parameters.length > 0) {
          markdown += `**Parameters:**\n\n`
          endpoint.parameters.forEach(param => {
            markdown += `- \`${param.name}\` (${param.in}${param.required ? ', required' : ''}) - ${param.description}\n`
          })
          markdown += '\n'
        }

        // Request body
        if (endpoint.requestBody) {
          markdown += `**Request Body:**\n\n`
          markdown += '```json\n'
          markdown += JSON.stringify(endpoint.requestBody.example || {}, null, 2)
          markdown += '\n```\n\n'
        }

        // Responses
        markdown += `**Responses:**\n\n`
        endpoint.responses.forEach(response => {
          markdown += `- \`${response.statusCode}\` - ${response.description}\n`
          if (response.example) {
            markdown += '  ```json\n  '
            markdown += JSON.stringify(response.example, null, 2).replace(/\n/g, '\n  ')
            markdown += '\n  ```\n'
          }
        })
        markdown += '\n'
      })
    }

    // Error handling section
    markdown += `## Error Handling\n\n`
    markdown += `The API uses conventional HTTP response codes to indicate success or failure.\n\n`
    markdown += `- \`2xx\` - Success\n`
    markdown += `- \`4xx\` - Client error (invalid request, authentication, etc.)\n`
    markdown += `- \`5xx\` - Server error\n\n`

    markdown += `Error responses include details about what went wrong:\n\n`
    markdown += '```json\n'
    markdown += JSON.stringify({
      error: 'validation_error',
      message: 'The request data is invalid',
      details: {
        field: 'email',
        code: 'invalid_format'
      }
    }, null, 2)
    markdown += '\n```\n\n'

    // Rate limiting section
    markdown += `## Rate Limiting\n\n`
    markdown += `API requests are limited to prevent abuse:\n\n`
    markdown += `- **Authenticated requests:** 1000 requests per hour\n`
    markdown += `- **Unauthenticated requests:** 100 requests per hour\n\n`
    markdown += `Rate limit information is included in response headers:\n\n`
    markdown += '```\n'
    markdown += 'X-RateLimit-Limit: 1000\n'
    markdown += 'X-RateLimit-Remaining: 999\n'
    markdown += 'X-RateLimit-Reset: 1640995200\n'
    markdown += '```\n\n'

    return markdown
  }

  async generatePostmanCollection(): Promise<string> {
    const collection = {
      info: {
        name: 'WhatChanged API',
        description: this.spec.info.description,
        version: this.spec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{ACCESS_TOKEN}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'http://localhost:3000/api',
          type: 'string'
        },
        {
          key: 'ACCESS_TOKEN',
          value: '',
          type: 'string'
        }
      ],
      item: [] as any[]
    }

    const endpointsByTag = this.endpoints.reduce((acc, endpoint) => {
      endpoint.tags.forEach(tag => {
        if (!acc[tag]) acc[tag] = []
        acc[tag].push(endpoint)
      })
      return acc
    }, {} as Record<string, APIEndpoint[]>)

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      const folder = {
        name: tag,
        item: [] as any[]
      }

      endpoints.forEach(endpoint => {
        const item = {
          name: endpoint.summary,
          request: {
            method: endpoint.method.toUpperCase(),
            header: [] as any[],
            url: {
              raw: `{{baseUrl}}${endpoint.path}`,
              host: ['{{baseUrl}}'],
              path: endpoint.path.split('/').filter(p => p)
            },
            description: endpoint.description
          }
        }

        // Add request body if present
        if (endpoint.requestBody) {
          ;(item.request as any).body = {
            mode: 'raw',
            raw: JSON.stringify(endpoint.requestBody.example || {}, null, 2),
            options: {
              raw: {
                language: 'json'
              }
            }
          }
          item.request.header.push({
            key: 'Content-Type',
            value: endpoint.requestBody.contentType
          })
        }

        folder.item.push(item)
      })

      collection.item.push(folder)
    }

    return JSON.stringify(collection, null, 2)
  }

  async saveDocumentation(outputDir: string = './docs/api') {
    try {
      await fs.mkdir(outputDir, { recursive: true })

      // Save OpenAPI spec
      const openApiSpec = await this.generateOpenAPISpec()
      await fs.writeFile(path.join(outputDir, 'openapi.json'), openApiSpec)

      // Save Markdown documentation
      const markdownDocs = await this.generateMarkdownDocs()
      await fs.writeFile(path.join(outputDir, 'README.md'), markdownDocs)

      // Save Postman collection
      const postmanCollection = await this.generatePostmanCollection()
      await fs.writeFile(path.join(outputDir, 'postman-collection.json'), postmanCollection)

      console.log(`API documentation generated successfully in ${outputDir}`)

      return {
        openApiPath: path.join(outputDir, 'openapi.json'),
        markdownPath: path.join(outputDir, 'README.md'),
        postmanPath: path.join(outputDir, 'postman-collection.json')
      }
    } catch (error) {
      console.error('Failed to save API documentation:', error)
      throw error
    }
  }
}

// CLI usage
if (require.main === module) {
  const generator = new APIDocumentationGenerator()
  generator.saveDocumentation().catch(console.error)
}

export const apiDocGenerator = new APIDocumentationGenerator()
export default apiDocGenerator