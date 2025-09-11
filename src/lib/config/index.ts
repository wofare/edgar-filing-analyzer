import { readFileSync } from 'fs'
import path from 'path'

export interface AppConfig {
  environment: string
  app: {
    name: string
    version: string
    debug: boolean
    hotReload: boolean
  }
  server: {
    host: string
    port: number
    cors: {
      enabled: boolean
      origins: string[]
      credentials: boolean
    }
  }
  database: {
    maxConnections: number
    timeout: number
    logging: boolean
    migrations: {
      autoRun: boolean
    }
    ssl?: boolean
    pool?: {
      min: number
      max: number
      acquireTimeoutMillis: number
      idleTimeoutMillis: number
    }
  }
  cache: {
    enabled: boolean
    provider: 'memory' | 'redis'
    ttl: {
      short: number
      medium: number
      long: number
    }
    compression?: boolean
  }
  jobs: {
    enabled: boolean
    concurrency: number
    maxRetries: number
    retryDelay: number
    cleanupInterval: number
    healthCheck?: boolean
  }
  monitoring: {
    enabled: boolean
    level: string
    console: boolean
    file: boolean
    sentry: boolean
    datadog: boolean
    metrics?: {
      enabled: boolean
      interval: number
    }
  }
  security: {
    rateLimiting: {
      enabled: boolean
      strict: boolean
      windowMs: number
      maxRequests: number
    }
    csrf: {
      enabled: boolean
    }
    helmet: {
      enabled: boolean
      contentSecurityPolicy: boolean
      hsts?: boolean
    }
    ipWhitelist?: {
      enabled: boolean
      ips: string[]
    }
  }
  features: {
    aiAnalysis: boolean
    realTimeAlerts: boolean
    advancedAnalytics: boolean
    apiAccess: boolean
    debugMode: boolean
  }
  external: {
    sec: {
      baseUrl: string
      rateLimit: number
      timeout: number
      retries?: number
    }
    openai: {
      model: string
      maxTokens: number
      temperature: number
      timeout?: number
    }
    stripe: {
      mode: 'test' | 'live'
      webhookTolerance: number
    }
  }
  email: {
    provider: 'console' | 'sendgrid' | 'ses' | 'smtp'
    templates: {
      baseUrl: string
    }
    bounce?: {
      enabled: boolean
    }
    unsubscribe?: {
      enabled: boolean
    }
  }
  sms: {
    provider: 'console' | 'twilio'
    enabled: boolean
    deliveryTracking?: boolean
  }
  performance?: {
    compression?: {
      enabled: boolean
      level: number
    }
    staticAssets?: {
      maxAge: number
      immutable: boolean
    }
    preload?: {
      enabled: boolean
    }
  }
  backup?: {
    enabled: boolean
    schedule: string
    retention: number
    s3?: {
      bucket: string
      encryption: boolean
    }
  }
  alerts?: {
    system?: {
      enabled: boolean
      channels: string[]
      thresholds: {
        errorRate: number
        responseTime: number
        memoryUsage: number
      }
    }
  }
  testing?: {
    enabled: boolean
    fixtures?: {
      enabled: boolean
      autoLoad: boolean
    }
    mockServices?: {
      stripe: boolean
      twilio: boolean
      sendgrid: boolean
    }
  }
}

class ConfigManager {
  private static instance: ConfigManager
  private config: AppConfig
  private environment: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): AppConfig {
    try {
      const configPath = path.join(process.cwd(), 'config', `${this.environment}.json`)
      const configFile = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(configFile) as AppConfig

      // Override with environment variables
      return this.mergeWithEnvVars(config)
    } catch (error) {
      console.warn(`Failed to load config for ${this.environment}, falling back to defaults`)
      return this.getDefaultConfig()
    }
  }

  private mergeWithEnvVars(config: AppConfig): AppConfig {
    // Server configuration
    if (process.env.PORT) {
      config.server.port = parseInt(process.env.PORT)
    }
    if (process.env.HOST) {
      config.server.host = process.env.HOST
    }

    // CORS configuration
    if (process.env.ALLOWED_CORS_ORIGINS) {
      config.server.cors.origins = process.env.ALLOWED_CORS_ORIGINS.split(',')
    }

    // Database configuration
    if (process.env.DATABASE_MAX_CONNECTIONS) {
      config.database.maxConnections = parseInt(process.env.DATABASE_MAX_CONNECTIONS)
    }
    if (process.env.DATABASE_TIMEOUT) {
      config.database.timeout = parseInt(process.env.DATABASE_TIMEOUT)
    }
    if (process.env.ENABLE_QUERY_LOGGING === 'true') {
      config.database.logging = true
    }

    // Cache configuration
    if (process.env.REDIS_URL) {
      config.cache.provider = 'redis'
    }
    if (process.env.CACHE_TTL_SHORT) {
      config.cache.ttl.short = parseInt(process.env.CACHE_TTL_SHORT)
    }
    if (process.env.CACHE_TTL_MEDIUM) {
      config.cache.ttl.medium = parseInt(process.env.CACHE_TTL_MEDIUM)
    }
    if (process.env.CACHE_TTL_LONG) {
      config.cache.ttl.long = parseInt(process.env.CACHE_TTL_LONG)
    }

    // Job queue configuration
    if (process.env.JOB_CONCURRENCY) {
      config.jobs.concurrency = parseInt(process.env.JOB_CONCURRENCY)
    }
    if (process.env.JOB_MAX_RETRIES) {
      config.jobs.maxRetries = parseInt(process.env.JOB_MAX_RETRIES)
    }
    if (process.env.JOB_RETRY_DELAY) {
      config.jobs.retryDelay = parseInt(process.env.JOB_RETRY_DELAY)
    }

    // Monitoring configuration
    if (process.env.LOG_LEVEL) {
      config.monitoring.level = process.env.LOG_LEVEL
    }
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      config.monitoring.sentry = true
    }
    if (process.env.DATADOG_API_KEY) {
      config.monitoring.datadog = true
    }

    // Security configuration
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      config.security.rateLimiting.enabled = false
    }

    // Feature flags
    if (process.env.FEATURE_AI_ANALYSIS === 'false') {
      config.features.aiAnalysis = false
    }
    if (process.env.FEATURE_REAL_TIME_ALERTS === 'false') {
      config.features.realTimeAlerts = false
    }
    if (process.env.FEATURE_ADVANCED_ANALYTICS === 'false') {
      config.features.advancedAnalytics = false
    }
    if (process.env.FEATURE_API_ACCESS === 'false') {
      config.features.apiAccess = false
    }

    // External service configuration
    if (process.env.SEC_API_BASE_URL) {
      config.external.sec.baseUrl = process.env.SEC_API_BASE_URL
    }
    if (process.env.SEC_RATE_LIMIT_DELAY) {
      config.external.sec.rateLimit = parseInt(process.env.SEC_RATE_LIMIT_DELAY)
    }

    if (process.env.OPENAI_MODEL) {
      config.external.openai.model = process.env.OPENAI_MODEL
    }
    if (process.env.OPENAI_MAX_TOKENS) {
      config.external.openai.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS)
    }

    // Email configuration
    if (process.env.SENDGRID_API_KEY) {
      config.email.provider = 'sendgrid'
    } else if (process.env.AWS_ACCESS_KEY_ID) {
      config.email.provider = 'ses'
    } else if (process.env.SMTP_HOST) {
      config.email.provider = 'smtp'
    }

    if (process.env.NEXT_PUBLIC_BASE_URL) {
      config.email.templates.baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    }

    // SMS configuration
    if (process.env.TWILIO_ACCOUNT_SID) {
      config.sms.provider = 'twilio'
      config.sms.enabled = true
    }

    return config
  }

  private getDefaultConfig(): AppConfig {
    return {
      environment: this.environment,
      app: {
        name: 'WhatChanged',
        version: '1.0.0',
        debug: this.environment !== 'production',
        hotReload: this.environment === 'development'
      },
      server: {
        host: 'localhost',
        port: 3000,
        cors: {
          enabled: true,
          origins: ['http://localhost:3000'],
          credentials: true
        }
      },
      database: {
        maxConnections: 10,
        timeout: 5000,
        logging: this.environment !== 'production',
        migrations: {
          autoRun: this.environment !== 'production'
        }
      },
      cache: {
        enabled: true,
        provider: 'memory',
        ttl: {
          short: 300,
          medium: 1800,
          long: 3600
        }
      },
      jobs: {
        enabled: true,
        concurrency: 3,
        maxRetries: 3,
        retryDelay: 1000,
        cleanupInterval: 300000
      },
      monitoring: {
        enabled: true,
        level: this.environment === 'production' ? 'info' : 'debug',
        console: this.environment !== 'production',
        file: this.environment === 'production',
        sentry: this.environment === 'production',
        datadog: this.environment === 'production'
      },
      security: {
        rateLimiting: {
          enabled: true,
          strict: this.environment === 'production',
          windowMs: 900000,
          maxRequests: this.environment === 'production' ? 100 : 1000
        },
        csrf: {
          enabled: this.environment === 'production'
        },
        helmet: {
          enabled: true,
          contentSecurityPolicy: this.environment === 'production'
        }
      },
      features: {
        aiAnalysis: true,
        realTimeAlerts: true,
        advancedAnalytics: true,
        apiAccess: true,
        debugMode: this.environment !== 'production'
      },
      external: {
        sec: {
          baseUrl: 'https://www.sec.gov/Archives/edgar',
          rateLimit: 100,
          timeout: 10000
        },
        openai: {
          model: 'gpt-3.5-turbo',
          maxTokens: 2000,
          temperature: 0.1
        },
        stripe: {
          mode: this.environment === 'production' ? 'live' : 'test',
          webhookTolerance: 300
        }
      },
      email: {
        provider: this.environment === 'production' ? 'sendgrid' : 'console',
        templates: {
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        }
      },
      sms: {
        provider: this.environment === 'production' ? 'twilio' : 'console',
        enabled: false
      }
    }
  }

  // Getters for different configuration sections
  get app() {
    return this.config.app
  }

  get server() {
    return this.config.server
  }

  get database() {
    return this.config.database
  }

  get cache() {
    return this.config.cache
  }

  get jobs() {
    return this.config.jobs
  }

  get monitoring() {
    return this.config.monitoring
  }

  get security() {
    return this.config.security
  }

  get features() {
    return this.config.features
  }

  get external() {
    return this.config.external
  }

  get email() {
    return this.config.email
  }

  get sms() {
    return this.config.sms
  }

  get performance() {
    return this.config.performance
  }

  get backup() {
    return this.config.backup
  }

  get alerts() {
    return this.config.alerts
  }

  get testing() {
    return this.config.testing
  }

  // Utility methods
  get isDevelopment() {
    return this.environment === 'development'
  }

  get isProduction() {
    return this.environment === 'production'
  }

  get isStaging() {
    return this.environment === 'staging'
  }

  get isTest() {
    return this.environment === 'test'
  }

  // Get full configuration object
  getConfig() {
    return this.config
  }

  // Get environment-specific value
  get<T>(path: string, defaultValue?: T): T | undefined {
    const keys = path.split('.')
    let current: any = this.config

    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue
      }
      current = current[key]
    }

    return current !== undefined ? current : defaultValue
  }

  // Validate configuration
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate required environment variables
    if (this.isProduction) {
      const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'STRIPE_SECRET_KEY'
      ]

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          errors.push(`Missing required environment variable: ${envVar}`)
        }
      }
    }

    // Validate configuration values
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Server port must be between 1 and 65535')
    }

    if (this.config.database.maxConnections < 1) {
      errors.push('Database max connections must be greater than 0')
    }

    if (this.config.jobs.concurrency < 1) {
      errors.push('Job concurrency must be greater than 0')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Global configuration instance
export const config = ConfigManager.getInstance()

// Validate configuration on startup
const validation = config.validate()
if (!validation.valid) {
  console.error('Configuration validation failed:')
  validation.errors.forEach(error => console.error(`  - ${error}`))
  
  if (config.isProduction) {
    process.exit(1)
  }
}

export default config