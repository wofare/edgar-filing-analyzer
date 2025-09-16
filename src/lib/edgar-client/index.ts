import { env } from '@/lib/env'
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

export interface EdgarFiling {
  cik: string
  accessionNumber: string
  filingDate: string
  reportDate: string | null
  acceptanceDateTime: string
  act: string
  form: string
  fileNumber: string | null
  filmNumber: string | null
  items: string | null
  size: number
  isXBRL: boolean
  isInlineXBRL: boolean
  primaryDocument: string
  primaryDocDescription: string
}

export interface EdgarCompanyInfo {
  cik: string
  entityType: string
  sic: string
  sicDescription: string
  insiderTransactionForOwnerExists: boolean
  insiderTransactionForIssuerExists: boolean
  name: string
  tickers: string[]
  exchanges: string[]
  ein: string
  description: string
  website: string
  investorWebsite: string
  category: string
  fiscalYearEnd: string
  stateOfIncorporation: string
  stateOfIncorporationDescription: string
  addresses: {
    mailing?: {
      street1: string
      street2?: string
      city: string
      stateOrCountry: string
      zipCode: string
      stateOrCountryDescription: string
    }
    business?: {
      street1: string
      street2?: string
      city: string
      stateOrCountry: string
      zipCode: string
      stateOrCountryDescription: string
    }
  }
  phone: string
  flags: string
  formerNames: Array<{
    name: string
    from: string
    to: string
  }>
  filings: {
    recent: {
      accessionNumber: string[]
      filingDate: string[]
      reportDate: string[]
      acceptanceDateTime: string[]
      act: string[]
      form: string[]
      fileNumber: string[]
      filmNumber: string[]
      items: string[]
      size: number[]
      isXBRL: number[]
      isInlineXBRL: number[]
      primaryDocument: string[]
      primaryDocDescription: string[]
    }
    files: Array<{
      name: string
      filingCount: number
      filingFrom: string
      filingTo: string
    }>
  }
}

export interface EdgarFilingContent {
  accessionNumber: string
  primaryDocument: string
  content: string
  documents: Array<{
    sequence: string
    description: string
    documentName: string
    type: string
    size: number
  }>
}

export interface RateLimitInfo {
  requestsPerSecond: number
  requestsInLastSecond: number
  nextAllowedRequest: number
}

class RateLimiter {
  private requestTimes: number[] = []
  private readonly maxRequestsPerSecond: number

  constructor(maxRequestsPerSecond: number = 10) {
    this.maxRequestsPerSecond = maxRequestsPerSecond
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now()
    
    // Remove requests older than 1 second
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000)
    
    if (this.requestTimes.length >= this.maxRequestsPerSecond) {
      // Wait until the oldest request is more than 1 second old
      const oldestRequest = Math.min(...this.requestTimes)
      const waitTime = 1000 - (now - oldestRequest) + 10 // Add 10ms buffer
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      // Recursive call to check again after waiting
      return this.waitForSlot()
    }
    
    this.requestTimes.push(now)
  }

  getStatus(): RateLimitInfo {
    const now = Date.now()
    const recentRequests = this.requestTimes.filter(time => now - time < 1000)
    const nextAllowed = recentRequests.length >= this.maxRequestsPerSecond
      ? Math.min(...this.requestTimes) + 1000
      : now
    
    return {
      requestsPerSecond: this.maxRequestsPerSecond,
      requestsInLastSecond: recentRequests.length,
      nextAllowedRequest: nextAllowed
    }
  }
}

export class EdgarClient {
  private client: AxiosInstance
  private rateLimiter: RateLimiter
  private userAgent: string

  constructor(options?: {
    userAgent?: string
    requestsPerSecond?: number
    timeout?: number
  }) {
    this.userAgent = options?.userAgent || env.SEC_EDGAR_USER_AGENT
    this.rateLimiter = new RateLimiter(options?.requestsPerSecond || 10)
    
    this.client = axios.create({
      baseURL: 'https://data.sec.gov',
      timeout: options?.timeout || 30000,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
        'Host': 'data.sec.gov'
      }
    })

    // Add rate limiting interceptor
    this.client.interceptors.request.use(async (config) => {
      await this.rateLimiter.waitForSlot()
      return config
    })

    // Add retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as AxiosRequestConfig & { _retryCount?: number }
        
        if (error.response?.status === 429 && (!config._retryCount || config._retryCount < 3)) {
          config._retryCount = (config._retryCount || 0) + 1
          
          const retryAfter = error.response.headers['retry-after']
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, config._retryCount) * 1000
          
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.client(config)
        }
        
        return Promise.reject(error)
      }
    )
  }

  async getCompanyTickers(): Promise<Record<string, { cik_str: string; ticker: string; title: string }>> {
    const response = await this.client.get('/files/company_tickers.json')
    return response.data
  }

  async getCompanyInfo(cik: string): Promise<EdgarCompanyInfo> {
    const normalizedCik = this.normalizeCik(cik)
    const response = await this.client.get(`/submissions/CIK${normalizedCik}.json`)
    return response.data
  }

  async getCompanyFilings(cik: string, options?: {
    form?: string
    before?: string
    after?: string
    count?: number
  }): Promise<EdgarFiling[]> {
    const companyInfo = await this.getCompanyInfo(cik)
    const recent = companyInfo.filings.recent
    
    let filings: EdgarFiling[] = []
    
    // Convert arrays to objects
    for (let i = 0; i < recent.accessionNumber.length; i++) {
      filings.push({
        cik: cik,
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        reportDate: recent.reportDate[i] || null,
        acceptanceDateTime: recent.acceptanceDateTime[i],
        act: recent.act[i],
        form: recent.form[i],
        fileNumber: recent.fileNumber[i] || null,
        filmNumber: recent.filmNumber[i] || null,
        items: recent.items[i] || null,
        size: recent.size[i],
        isXBRL: recent.isXBRL[i] === 1,
        isInlineXBRL: recent.isInlineXBRL[i] === 1,
        primaryDocument: recent.primaryDocument[i],
        primaryDocDescription: recent.primaryDocDescription[i]
      })
    }

    // Apply filters
    if (options?.form) {
      filings = filings.filter(f => f.form === options.form)
    }

    if (options?.before) {
      filings = filings.filter(f => f.filingDate < options.before!)
    }

    if (options?.after) {
      filings = filings.filter(f => f.filingDate > options.after!)
    }

    // Sort by filing date (most recent first)
    filings.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime())

    // Apply count limit
    if (options?.count) {
      filings = filings.slice(0, options.count)
    }

    return filings
  }

  async getFilingContent(cik: string, accessionNumber: string): Promise<EdgarFilingContent> {
    const normalizedCik = this.normalizeCik(cik)
    const cleanAccession = accessionNumber.replace(/-/g, '')
    
    // Get filing index to understand structure
    const indexUrl = `/Archives/edgar/data/${normalizedCik}/${cleanAccession}/${accessionNumber}-index.html`
    const indexResponse = await this.client.get(indexUrl)
    
    // Parse documents from index (simplified)
    const documents = this.parseFilingIndex(indexResponse.data)
    
    // Get primary document content
    const primaryDoc = documents.find(d => d.type === 'filing') || documents[0]
    const contentUrl = `/Archives/edgar/data/${normalizedCik}/${cleanAccession}/${primaryDoc.documentName}`
    const contentResponse = await this.client.get(contentUrl)

    return {
      accessionNumber,
      primaryDocument: primaryDoc.documentName,
      content: contentResponse.data,
      documents
    }
  }

  async getFilingXbrl(cik: string, accessionNumber: string): Promise<any> {
    const normalizedCik = this.normalizeCik(cik)
    const cleanAccession = accessionNumber.replace(/-/g, '')
    
    try {
      const xbrlUrl = `/api/xbrl/companyconcept/CIK${normalizedCik}/us-gaap/Assets.json`
      const response = await this.client.get(xbrlUrl)
      return response.data
    } catch (error) {
      throw new Error(`XBRL data not available for ${accessionNumber}`)
    }
  }

  async searchCompanies(query: string): Promise<Array<{ cik: string; name: string; ticker?: string }>> {
    const tickers = await this.getCompanyTickers()
    const results: Array<{ cik: string; name: string; ticker?: string }> = []
    
    const searchTerm = query.toLowerCase()
    
    for (const [, company] of Object.entries(tickers)) {
      const nameMatch = company.title.toLowerCase().includes(searchTerm)
      const tickerMatch = company.ticker.toLowerCase() === searchTerm
      
      if (nameMatch || tickerMatch) {
        results.push({
          cik: company.cik_str,
          name: company.title,
          ticker: company.ticker
        })
      }
    }

    return results.slice(0, 50) // Limit results
  }

  async getRecentFilings(options?: {
    form?: string
    limit?: number
    startDate?: string
  }): Promise<EdgarFiling[]> {
    // This would require parsing RSS feeds or using company submissions
    // For now, we'll return empty array as this requires more complex implementation
    throw new Error('Recent filings API not implemented - use getCompanyFilings instead')
  }

  getRateLimitStatus(): RateLimitInfo {
    return this.rateLimiter.getStatus()
  }

  private normalizeCik(cik: string): string {
    // Remove leading zeros for directory structure but pad for API calls
    const numericCik = parseInt(cik, 10)
    return numericCik.toString().padStart(10, '0')
  }

  private parseFilingIndex(html: string): Array<{
    sequence: string
    description: string
    documentName: string
    type: string
    size: number
  }> {
    // Simplified HTML parsing - in production, use a proper HTML parser
    const documents: Array<{
      sequence: string
      description: string
      documentName: string
      type: string
      size: number
    }> = []
    
    // Look for table rows with document information
    const tableRegex = /<tr[^>]*>.*?<\/tr>/gis
    const matches = html.match(tableRegex) || []
    
    for (const row of matches) {
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis
      const cells = []
      let match
      
      while ((match = cellRegex.exec(row)) !== null) {
        cells.push(match[1].replace(/<[^>]*>/g, '').trim())
      }
      
      if (cells.length >= 4) {
        documents.push({
          sequence: cells[0] || '1',
          description: cells[1] || 'Unknown',
          documentName: cells[2] || 'unknown.txt',
          type: cells[3] || 'filing',
          size: parseInt(cells[4]) || 0
        })
      }
    }
    
    return documents.length > 0 ? documents : [{
      sequence: '1',
      description: 'Primary Document',
      documentName: 'primary.txt',
      type: 'filing',
      size: 0
    }]
  }

  static generateFilingUrl(cik: string, accessionNumber: string, document?: string): string {
    const normalizedCik = parseInt(cik, 10).toString()
    const cleanAccession = accessionNumber.replace(/-/g, '')
    const docName = document || `${accessionNumber}.txt`
    
    return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${cleanAccession}/${docName}`
  }

  static generateViewerUrl(cik: string, accessionNumber: string): string {
    const normalizedCik = parseInt(cik, 10).toString()
    const cleanAccession = accessionNumber.replace(/-/g, '')
    
    return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${cleanAccession}/${accessionNumber}-index.html`
  }
}

// Error classes
export class EdgarClientError extends Error {
  constructor(message: string, public statusCode?: number, public response?: any) {
    super(message)
    this.name = 'EdgarClientError'
  }
}

export class RateLimitExceededError extends EdgarClientError {
  constructor(retryAfter?: number) {
    super(`SEC EDGAR rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`)
    this.name = 'RateLimitExceededError'
  }
}

export class FilingNotFoundError extends EdgarClientError {
  constructor(cik: string, accessionNumber: string) {
    super(`Filing not found: CIK ${cik}, Accession ${accessionNumber}`)
    this.name = 'FilingNotFoundError'
  }
}

export class InvalidCikError extends EdgarClientError {
  constructor(cik: string) {
    super(`Invalid CIK format: ${cik}`)
    this.name = 'InvalidCikError'
  }
}

export function createEDGARClient(options?: {
  userAgent?: string
  requestsPerSecond?: number
  timeout?: number
}): EdgarClient {
  return new EdgarClient(options)
}

// Default export
export default EdgarClient
