import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { env } from '@/lib/env'

export interface PriceData {
  symbol: string
  current: number
  open: number
  high: number
  low: number
  previousClose: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  lastUpdated: Date
  sparkline: number[] // 30-day price history
  provider: string
  fallbackUsed?: boolean
  primaryError?: string
}

export interface ProviderConfig {
  name: string
  apiKey?: string
  baseUrl: string
  rateLimitPerSecond: number
  timeout: number
  retryCount: number
}

export interface PriceAdapterConfig {
  primaryProvider: string
  fallbackProviders: string[]
  cacheTTL: number // seconds
  enableCache: boolean
}

interface CacheEntry {
  data: PriceData
  expiry: number
}

abstract class BasePriceProvider {
  protected client: AxiosInstance
  protected config: ProviderConfig
  protected requestTimes: number[] = []

  constructor(config: ProviderConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'WhatChanged/1.0'
      }
    })

    // Add rate limiting interceptor
    this.client.interceptors.request.use(async (req) => {
      await this.waitForRateLimit()
      return req
    })
  }

  abstract getPriceData(symbol: string, period?: string): Promise<PriceData>
  abstract searchSymbol(query: string): Promise<Array<{ symbol: string; name: string }>>

  protected async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Remove requests older than 1 second
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000)
    
    if (this.requestTimes.length >= this.config.rateLimitPerSecond) {
      const oldestRequest = Math.min(...this.requestTimes)
      const waitTime = 1000 - (now - oldestRequest) + 10 // Add buffer
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return this.waitForRateLimit() // Recursive call
      }
    }
    
    this.requestTimes.push(now)
  }

  protected parseNumber(value: any): number {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return isNaN(num) ? 0 : num
  }

  protected calculateSparkline(prices: number[], targetLength: number = 30): number[] {
    if (prices.length === 0) return Array(targetLength).fill(0)
    if (prices.length === targetLength) return prices
    
    if (prices.length < targetLength) {
      // Pad with repeated values
      const padded = [...prices]
      while (padded.length < targetLength) {
        padded.unshift(prices[0])
      }
      return padded
    }
    
    // Sample down to target length
    const step = prices.length / targetLength
    const sampled: number[] = []
    for (let i = 0; i < targetLength; i++) {
      const index = Math.floor(i * step)
      sampled.push(prices[index])
    }
    
    return sampled
  }
}

class AlphaVantageProvider extends BasePriceProvider {
  constructor(apiKey: string) {
    super({
      name: 'Alpha Vantage',
      apiKey,
      baseUrl: 'https://www.alphavantage.co',
      rateLimitPerSecond: 5,
      timeout: 10000,
      retryCount: 2
    })
  }

  async getPriceData(symbol: string, period = '1M'): Promise<PriceData> {
    try {
      // Get current quote
      const quoteResponse = await this.client.get('/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: this.config.apiKey
        }
      })

      const quote = quoteResponse.data['Global Quote']
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error(`No data found for symbol ${symbol}`)
      }

      // Get historical data for sparkline
      const historicalResponse = await this.client.get('/query', {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          outputsize: 'compact',
          apikey: this.config.apiKey
        }
      })

      const timeSeries = historicalResponse.data['Time Series (Daily)'] || {}
      const prices = Object.values(timeSeries)
        .slice(0, 30)
        .map((day: any) => this.parseNumber(day['4. close']))
        .reverse()

      const current = this.parseNumber(quote['05. price'])
      const previousClose = this.parseNumber(quote['08. previous close'])
      const change = this.parseNumber(quote['09. change'])
      const changePercent = this.parseNumber(quote['10. change percent'].replace('%', ''))

      return {
        symbol: symbol.toUpperCase(),
        current,
        open: this.parseNumber(quote['02. open']),
        high: this.parseNumber(quote['03. high']),
        low: this.parseNumber(quote['04. low']),
        previousClose,
        change,
        changePercent,
        volume: this.parseNumber(quote['06. volume']),
        lastUpdated: new Date(quote['07. latest trading day']),
        sparkline: this.calculateSparkline(prices),
        provider: 'alpha'
      }
    } catch (error) {
      throw new PriceProviderError(`Alpha Vantage error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'alpha', true)
    }
  }

  async searchSymbol(query: string): Promise<Array<{ symbol: string; name: string }>> {
    try {
      const response = await this.client.get('/query', {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: query,
          apikey: this.config.apiKey
        }
      })

      const matches = response.data.bestMatches || []
      return matches.slice(0, 10).map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name']
      }))
    } catch (error) {
      return []
    }
  }
}

class FinnhubProvider extends BasePriceProvider {
  constructor(apiKey: string) {
    super({
      name: 'Finnhub',
      apiKey,
      baseUrl: 'https://finnhub.io/api/v1',
      rateLimitPerSecond: 30,
      timeout: 10000,
      retryCount: 2
    })

    this.client.defaults.headers['X-Finnhub-Token'] = apiKey
  }

  async getPriceData(symbol: string, period = '1M'): Promise<PriceData> {
    try {
      // Get current quote
      const quoteResponse = await this.client.get('/quote', {
        params: { symbol: symbol.toUpperCase() }
      })

      const quote = quoteResponse.data
      if (!quote || quote.c === 0) {
        throw new Error(`No data found for symbol ${symbol}`)
      }

      // Get historical data for sparkline
      const now = Math.floor(Date.now() / 1000)
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60)

      const candleResponse = await this.client.get('/stock/candle', {
        params: {
          symbol: symbol.toUpperCase(),
          resolution: 'D',
          from: thirtyDaysAgo,
          to: now
        }
      })

      const candles = candleResponse.data
      const prices = candles.s === 'ok' ? candles.c || [] : []

      const current = this.parseNumber(quote.c)
      const previousClose = this.parseNumber(quote.pc)
      const change = current - previousClose
      const changePercent = (change / previousClose) * 100

      return {
        symbol: symbol.toUpperCase(),
        current,
        open: this.parseNumber(quote.o),
        high: this.parseNumber(quote.h),
        low: this.parseNumber(quote.l),
        previousClose,
        change,
        changePercent,
        volume: 0, // Finnhub doesn't provide volume in quote endpoint
        lastUpdated: new Date(quote.t * 1000),
        sparkline: this.calculateSparkline(prices),
        provider: 'finnhub'
      }
    } catch (error) {
      throw new PriceProviderError(`Finnhub error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'finnhub', true)
    }
  }

  async searchSymbol(query: string): Promise<Array<{ symbol: string; name: string }>> {
    try {
      const response = await this.client.get('/search', {
        params: { q: query }
      })

      const results = response.data.result || []
      return results.slice(0, 10).map((result: any) => ({
        symbol: result.symbol,
        name: result.description
      }))
    } catch (error) {
      return []
    }
  }
}

class YahooFinanceProvider extends BasePriceProvider {
  constructor() {
    super({
      name: 'Yahoo Finance',
      baseUrl: 'https://query1.finance.yahoo.com',
      rateLimitPerSecond: 10,
      timeout: 10000,
      retryCount: 2
    })
  }

  async getPriceData(symbol: string, period = '1M'): Promise<PriceData> {
    try {
      // Get current quote
      const quoteResponse = await this.client.get('/v8/finance/chart/' + symbol.toUpperCase(), {
        params: {
          range: '1d',
          interval: '1d'
        }
      })

      const chart = quoteResponse.data.chart?.result?.[0]
      if (!chart) {
        throw new Error(`No data found for symbol ${symbol}`)
      }

      const meta = chart.meta
      const current = this.parseNumber(meta.regularMarketPrice)
      const previousClose = this.parseNumber(meta.previousClose)

      // Get historical data for sparkline
      const historicalResponse = await this.client.get('/v8/finance/chart/' + symbol.toUpperCase(), {
        params: {
          range: '1mo',
          interval: '1d'
        }
      })

      const historicalChart = historicalResponse.data.chart?.result?.[0]
      const prices = historicalChart?.indicators?.quote?.[0]?.close || []

      const change = current - previousClose
      const changePercent = (change / previousClose) * 100

      return {
        symbol: symbol.toUpperCase(),
        current,
        open: this.parseNumber(meta.regularMarketOpen),
        high: this.parseNumber(meta.regularMarketDayHigh),
        low: this.parseNumber(meta.regularMarketDayLow),
        previousClose,
        change,
        changePercent,
        volume: this.parseNumber(meta.regularMarketVolume),
        marketCap: this.parseNumber(meta.marketCap),
        lastUpdated: new Date(meta.regularMarketTime * 1000),
        sparkline: this.calculateSparkline(prices.filter((p: any) => p !== null)),
        provider: 'yahoo'
      }
    } catch (error) {
      throw new PriceProviderError(`Yahoo Finance error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'yahoo', true)
    }
  }

  async searchSymbol(query: string): Promise<Array<{ symbol: string; name: string }>> {
    try {
      const response = await this.client.get('/v1/finance/search', {
        params: { q: query }
      })

      const quotes = response.data.quotes || []
      return quotes
        .filter((quote: any) => quote.typeDisp === 'Equity')
        .slice(0, 10)
        .map((quote: any) => ({
          symbol: quote.symbol,
          name: quote.longname || quote.shortname || quote.symbol
        }))
    } catch (error) {
      return []
    }
  }
}

export class PriceAdapter {
  private providers: Map<string, BasePriceProvider> = new Map()
  private cache: Map<string, CacheEntry> = new Map()
  private config: PriceAdapterConfig
  private healthStatus: Map<string, { lastCheck: Date; isHealthy: boolean; errorCount: number }> = new Map()

  constructor(config?: Partial<PriceAdapterConfig>) {
    this.config = {
      primaryProvider: config?.primaryProvider || env.PRICE_PROVIDER || 'alpha',
      fallbackProviders: config?.fallbackProviders || ['finnhub', 'yahoo'],
      cacheTTL: config?.cacheTTL || 300, // 5 minutes
      enableCache: config?.enableCache ?? true
    }

    this.initializeProviders()
    this.startHealthMonitoring()
  }

  private initializeProviders(): void {
    // Initialize Alpha Vantage if API key available
    if (env.ALPHA_VANTAGE_API_KEY) {
      this.providers.set('alpha', new AlphaVantageProvider(env.ALPHA_VANTAGE_API_KEY))
    }

    // Initialize Finnhub if API key available
    if (env.FINNHUB_API_KEY) {
      this.providers.set('finnhub', new FinnhubProvider(env.FINNHUB_API_KEY))
    }

    // Yahoo Finance doesn't require API key
    this.providers.set('yahoo', new YahooFinanceProvider())

    // Initialize health status for all providers
    for (const providerName of this.providers.keys()) {
      this.healthStatus.set(providerName, {
        lastCheck: new Date(),
        isHealthy: true,
        errorCount: 0
      })
    }
  }

  async getPriceData(symbol: string, options?: {
    period?: string
    forceProvider?: string
    skipCache?: boolean
  }): Promise<PriceData> {
    const cacheKey = `${symbol}-${options?.period || '1M'}`
    
    // Check cache first
    if (this.config.enableCache && !options?.skipCache) {
      const cached = this.getCachedData(cacheKey)
      if (cached) return cached
    }

    const providersToTry = this.getProviderOrder(options?.forceProvider)
    let lastError: Error | null = null
    
    for (const providerName of providersToTry) {
      try {
        const provider = this.providers.get(providerName)
        if (!provider) continue

        const data = await provider.getPriceData(symbol, options?.period)
        
        // Update health status
        this.updateHealthStatus(providerName, true)
        
        // Cache the result
        if (this.config.enableCache) {
          this.setCachedData(cacheKey, data)
        }
        
        // Add fallback indicator if not using primary provider
        if (providerName !== this.config.primaryProvider) {
          data.fallbackUsed = true
          data.primaryError = lastError?.message
        }
        
        return data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        this.updateHealthStatus(providerName, false)
        
        // Continue to next provider
        continue
      }
    }

    // All providers failed - try stale cache
    if (this.config.enableCache) {
      const staleData = this.getStaleData(cacheKey)
      if (staleData) {
        return {
          ...staleData,
          provider: staleData.provider + '-stale',
          fallbackUsed: true,
          primaryError: 'All providers failed, using stale data'
        }
      }
    }

    throw new PriceProviderError(`All price providers failed for ${symbol}. Last error: ${lastError?.message}`, 'all', false)
  }

  async searchSymbol(query: string): Promise<Array<{ symbol: string; name: string; provider: string }>> {
    const providersToTry = this.getProviderOrder()
    const results: Array<{ symbol: string; name: string; provider: string }> = []
    
    for (const providerName of providersToTry) {
      try {
        const provider = this.providers.get(providerName)
        if (!provider) continue

        const providerResults = await provider.searchSymbol(query)
        
        for (const result of providerResults) {
          // Avoid duplicates
          if (!results.some(r => r.symbol === result.symbol)) {
            results.push({ ...result, provider: providerName })
          }
        }
        
        // Stop after getting sufficient results
        if (results.length >= 20) break
      } catch (error) {
        // Continue to next provider
        continue
      }
    }

    return results.slice(0, 20)
  }

  private getProviderOrder(forceProvider?: string): string[] {
    if (forceProvider && this.providers.has(forceProvider)) {
      return [forceProvider]
    }

    const healthyProviders = Array.from(this.healthStatus.entries())
      .filter(([, status]) => status.isHealthy)
      .map(([name]) => name)
      .sort((a, b) => {
        // Prefer primary provider
        if (a === this.config.primaryProvider) return -1
        if (b === this.config.primaryProvider) return 1
        return 0
      })

    if (healthyProviders.length > 0) {
      return healthyProviders
    }

    // If no healthy providers, try all in order
    return [this.config.primaryProvider, ...this.config.fallbackProviders]
      .filter(name => this.providers.has(name))
  }

  private getCachedData(key: string): PriceData | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  private getStaleData(key: string): PriceData | null {
    const entry = this.cache.get(key)
    return entry ? entry.data : null
  }

  private setCachedData(key: string, data: PriceData): void {
    const expiry = Date.now() + (this.config.cacheTTL * 1000)
    this.cache.set(key, { data, expiry })
    
    // Clean old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanCache()
    }
  }

  private cleanCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }

  private updateHealthStatus(providerName: string, success: boolean): void {
    const status = this.healthStatus.get(providerName)
    if (!status) return

    status.lastCheck = new Date()
    
    if (success) {
      status.errorCount = Math.max(0, status.errorCount - 1)
      status.isHealthy = true
    } else {
      status.errorCount++
      status.isHealthy = status.errorCount < 3 // Mark unhealthy after 3 consecutive errors
    }

    this.healthStatus.set(providerName, status)
  }

  private startHealthMonitoring(): void {
    // Reset error counts periodically
    setInterval(() => {
      for (const [name, status] of this.healthStatus.entries()) {
        if (status.errorCount > 0) {
          status.errorCount = Math.max(0, status.errorCount - 1)
          status.isHealthy = status.errorCount < 3
          this.healthStatus.set(name, status)
        }
      }
    }, 60000) // Every minute
  }

  getHealthStatus(): Record<string, { isHealthy: boolean; errorCount: number; lastCheck: Date }> {
    const status: Record<string, any> = {}
    for (const [name, health] of this.healthStatus.entries()) {
      status[name] = { ...health }
    }
    return status
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits vs misses for accurate rate
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}

// Error classes
export class PriceProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public retryable: boolean = true
  ) {
    super(message)
    this.name = 'PriceProviderError'
  }
}

export class PriceDataNotFoundError extends PriceProviderError {
  constructor(symbol: string, provider: string) {
    super(`Price data not found for ${symbol}`, provider, false)
    this.name = 'PriceDataNotFoundError'
  }
}

export class RateLimitExceededError extends PriceProviderError {
  constructor(provider: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`, provider, true)
    this.name = 'RateLimitExceededError'
  }
}

// Helper function
export function createPriceAdapter(config?: Partial<PriceAdapterConfig>): PriceAdapter {
  return new PriceAdapter(config)
}

export default PriceAdapter