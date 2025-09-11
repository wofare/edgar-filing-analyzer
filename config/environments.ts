interface EnvironmentConfig {
  name: string
  production: boolean
  database: {
    url: string
    maxConnections: number
    connectionTimeout: number
    logQueries: boolean
  }
  redis: {
    url: string
    maxRetries: number
    retryDelayOnFailover: number
  }
  auth: {
    jwtSecret: string
    jwtExpiration: string
    bcryptRounds: number
  }
  external: {
    sec: {
      baseUrl: string
      rateLimit: number
      timeout: number
    }
    openai: {
      apiKey: string
      model: string
      maxTokens: number
      temperature: number
    }
    stripe: {
      publicKey: string
      secretKey: string
      webhookSecret: string
    }
    sendgrid: {
      apiKey: string
      fromEmail: string
    }
    twilio: {
      accountSid: string
      authToken: string
      fromNumber: string
    }
  }
  monitoring: {
    sentry: {
      dsn: string
      environment: string
      tracesSampleRate: number
      replaysSessionSampleRate: number
    }
    datadog: {
      apiKey: string
      applicationKey: string
      service: string
    }
  }
  features: {
    enableSignups: boolean
    enableEmailVerification: boolean
    enableSmsAlerts: boolean
    enablePushNotifications: boolean
    maxWatchlistItems: number
    maxAlertsPerUser: number
  }
  limits: {
    api: {
      rateLimitWindow: number
      rateLimitMax: number
      slowDownAfter: number
    }
    uploads: {
      maxFileSize: number
      allowedTypes: string[]
    }
  }
}

// Development configuration
const development: EnvironmentConfig = {
  name: 'development',
  production: false,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/whatchanged_dev',
    maxConnections: 10,
    connectionTimeout: 30000,
    logQueries: true,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetries: 3,
    retryDelayOnFailover: 1000,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    jwtExpiration: '7d',
    bcryptRounds: 10,
  },
  external: {
    sec: {
      baseUrl: 'https://data.sec.gov',
      rateLimit: 10, // requests per second
      timeout: 30000,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.3,
    },
    stripe: {
      publicKey: process.env.STRIPE_PUBLIC_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@whatchanged.app',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  },
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: 'development',
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
    },
    datadog: {
      apiKey: process.env.DATADOG_API_KEY || '',
      applicationKey: process.env.DATADOG_APPLICATION_KEY || '',
      service: 'whatchanged-dev',
    },
  },
  features: {
    enableSignups: true,
    enableEmailVerification: false, // Disabled in dev for easier testing
    enableSmsAlerts: false, // Disabled in dev to avoid SMS costs
    enablePushNotifications: true,
    maxWatchlistItems: 10,
    maxAlertsPerUser: 100,
  },
  limits: {
    api: {
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 1000, // More generous in dev
      slowDownAfter: 500,
    },
    uploads: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/json', 'text/csv'],
    },
  },
}

// Staging configuration
const staging: EnvironmentConfig = {
  name: 'staging',
  production: false,
  database: {
    url: process.env.DATABASE_URL || '',
    maxConnections: 20,
    connectionTimeout: 30000,
    logQueries: false,
  },
  redis: {
    url: process.env.REDIS_URL || '',
    maxRetries: 5,
    retryDelayOnFailover: 2000,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiration: '7d',
    bcryptRounds: 12,
  },
  external: {
    sec: {
      baseUrl: 'https://data.sec.gov',
      rateLimit: 8, // Slightly conservative for staging
      timeout: 30000,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.3,
    },
    stripe: {
      publicKey: process.env.STRIPE_PUBLIC_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'staging@whatchanged.app',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  },
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: 'staging',
      tracesSampleRate: 0.5,
      replaysSessionSampleRate: 0.05,
    },
    datadog: {
      apiKey: process.env.DATADOG_API_KEY || '',
      applicationKey: process.env.DATADOG_APPLICATION_KEY || '',
      service: 'whatchanged-staging',
    },
  },
  features: {
    enableSignups: true,
    enableEmailVerification: true,
    enableSmsAlerts: true,
    enablePushNotifications: true,
    maxWatchlistItems: 25,
    maxAlertsPerUser: 500,
  },
  limits: {
    api: {
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 500, // Moderate limits for staging
      slowDownAfter: 200,
    },
    uploads: {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['application/json', 'text/csv'],
    },
  },
}

// Production configuration
const production: EnvironmentConfig = {
  name: 'production',
  production: true,
  database: {
    url: process.env.DATABASE_URL || '',
    maxConnections: 30,
    connectionTimeout: 15000,
    logQueries: false,
  },
  redis: {
    url: process.env.REDIS_URL || '',
    maxRetries: 3,
    retryDelayOnFailover: 5000,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiration: '24h', // Shorter in production
    bcryptRounds: 14, // Higher security in production
  },
  external: {
    sec: {
      baseUrl: 'https://data.sec.gov',
      rateLimit: 10, // SEC's limit is 10 req/sec
      timeout: 15000, // Shorter timeout in production
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      maxTokens: 1500, // Slightly lower to control costs
      temperature: 0.2, // More conservative in production
    },
    stripe: {
      publicKey: process.env.STRIPE_PUBLIC_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@whatchanged.app',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  },
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: 'production',
      tracesSampleRate: 0.1, // Lower sampling in production
      replaysSessionSampleRate: 0.01,
    },
    datadog: {
      apiKey: process.env.DATADOG_API_KEY || '',
      applicationKey: process.env.DATADOG_APPLICATION_KEY || '',
      service: 'whatchanged',
    },
  },
  features: {
    enableSignups: true,
    enableEmailVerification: true,
    enableSmsAlerts: true,
    enablePushNotifications: true,
    maxWatchlistItems: 50,
    maxAlertsPerUser: 1000,
  },
  limits: {
    api: {
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100, // Conservative in production
      slowDownAfter: 50,
    },
    uploads: {
      maxFileSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['application/json'],
    },
  },
}

// Configuration selector
const configs = {
  development,
  staging,
  production,
}

// Get current environment
const getEnvironment = (): string => {
  return process.env.NODE_ENV || 'development'
}

// Get current config
export const config = (): EnvironmentConfig => {
  const env = getEnvironment() as keyof typeof configs
  
  if (!configs[env]) {
    throw new Error(`Invalid environment: ${env}`)
  }
  
  return configs[env]
}

// Validate configuration
export const validateConfig = (cfg: EnvironmentConfig): string[] => {
  const errors: string[] = []
  
  // Required environment variables in production
  if (cfg.production) {
    const required = [
      'DATABASE_URL',
      'REDIS_URL', 
      'JWT_SECRET',
      'OPENAI_API_KEY',
      'STRIPE_SECRET_KEY',
      'SENDGRID_API_KEY',
    ]
    
    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable: ${key}`)
      }
    }
    
    // Validate JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production')
    }
  }
  
  // Validate URLs
  if (cfg.database.url && !cfg.database.url.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL')
  }
  
  if (cfg.redis.url && !cfg.redis.url.startsWith('redis://')) {
    errors.push('REDIS_URL must be a valid Redis URL')
  }
  
  return errors
}

// Initialize configuration with validation
export const initializeConfig = (): EnvironmentConfig => {
  const cfg = config()
  const errors = validateConfig(cfg)
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:')
    errors.forEach(error => console.error(`  - ${error}`))
    
    if (cfg.production) {
      throw new Error('Configuration validation failed in production environment')
    } else {
      console.warn('Configuration issues detected, but continuing in non-production environment')
    }
  }
  
  console.log(`🚀 Initialized configuration for environment: ${cfg.name}`)
  return cfg
}

// Export current config as default
export default config()