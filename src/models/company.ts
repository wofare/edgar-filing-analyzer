import { z } from 'zod'

// Company validation schemas
export const createCompanySchema = z.object({
  symbol: z.string().regex(/^[A-Z]{1,5}$/, 'Invalid ticker symbol format'),
  name: z.string().min(1, 'Company name is required').max(200, 'Company name too long'),
  cik: z.string().regex(/^\d{10}$/, 'CIK must be 10 digits'),
  industry: z.string().max(100, 'Industry name too long').optional(),
  sector: z.string().max(100, 'Sector name too long').optional(),
})

export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200, 'Company name too long').optional(),
  industry: z.string().max(100, 'Industry name too long').optional(),
  sector: z.string().max(100, 'Sector name too long').optional(),
})

export const companySearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  sectors: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
})

// Company response types
export const companyResponseSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  cik: z.string(),
  industry: z.string().nullable(),
  sector: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const companyWithStatsSchema = companyResponseSchema.extend({
  stats: z.object({
    totalFilings: z.number(),
    recentFilings: z.number(),
    lastFilingDate: z.date().nullable(),
    averageMaterialityScore: z.number().nullable(),
    watchlistCount: z.number(),
  }),
})

export const companySummarySchema = z.object({
  symbol: z.string(),
  name: z.string(),
  industry: z.string().nullable(),
  sector: z.string().nullable(),
  recentActivity: z.object({
    lastFilingDate: z.date().nullable(),
    recentFilingCount: z.number(),
    materialChangesCount: z.number(),
  }),
})

// Type definitions
export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type CompanySearchInput = z.infer<typeof companySearchSchema>
export type CompanyResponse = z.infer<typeof companyResponseSchema>
export type CompanyWithStats = z.infer<typeof companyWithStatsSchema>
export type CompanySummary = z.infer<typeof companySummarySchema>

// Company utility functions
export class CompanyModel {
  static validateTicker(ticker: string): boolean {
    return createCompanySchema.shape.symbol.safeParse(ticker).success
  }

  static validateCik(cik: string): boolean {
    return createCompanySchema.shape.cik.safeParse(cik).success
  }

  static normalizeTicker(ticker: string): string {
    return ticker.toUpperCase().trim()
  }

  static normalizeCik(cik: string): string {
    // Pad with leading zeros to ensure 10 digits
    return cik.padStart(10, '0')
  }

  static formatCikForSec(cik: string): string {
    // SEC API expects CIK with leading zeros removed
    return parseInt(cik, 10).toString()
  }

  static parseCikFromAccession(accessionNo: string): string | null {
    // Accession format: XXXXXXXXXX-YY-NNNNNN where X is CIK
    const match = accessionNo.match(/^(\d{10})-\d{2}-\d{6}$/)
    return match ? match[1] : null
  }

  static isValidFormType(formType: string): boolean {
    const validFormTypes = [
      '10-K', '10-Q', '8-K',
      '10-K/A', '10-Q/A', '8-K/A',
      'DEF 14A', 'S-1', 'S-1/A',
      '20-F', '40-F', '6-K',
      'SC 13D', 'SC 13G',
    ]
    return validFormTypes.includes(formType)
  }

  static categorizeFormType(formType: string): 'annual' | 'quarterly' | 'current' | 'proxy' | 'registration' | 'other' {
    if (formType.startsWith('10-K')) return 'annual'
    if (formType.startsWith('10-Q')) return 'quarterly'
    if (formType.startsWith('8-K')) return 'current'
    if (formType.includes('DEF 14A')) return 'proxy'
    if (formType.startsWith('S-1') || formType.startsWith('S-3') || formType.startsWith('S-4')) return 'registration'
    return 'other'
  }

  static getFormTypePriority(formType: string): number {
    // Higher number = higher priority for display
    const priorities: Record<string, number> = {
      '10-K': 100,
      '10-K/A': 95,
      '10-Q': 90,
      '10-Q/A': 85,
      '8-K': 80,
      '8-K/A': 75,
      'DEF 14A': 70,
      'S-1': 60,
      'S-1/A': 55,
    }
    return priorities[formType] || 50
  }

  static extractIndustryFromSicCode(sicCode: string): string | null {
    // SIC code to industry mapping (simplified)
    const sicToIndustry: Record<string, string> = {
      '73': 'Technology',
      '36': 'Technology',
      '38': 'Technology',
      '28': 'Healthcare',
      '80': 'Healthcare',
      '60': 'Financial',
      '61': 'Financial',
      '62': 'Financial',
      '67': 'Financial',
      '50': 'Consumer Goods',
      '51': 'Consumer Goods',
      '56': 'Consumer Goods',
      '57': 'Consumer Goods',
      '58': 'Consumer Goods',
      '59': 'Consumer Goods',
    }
    
    const prefix = sicCode.substring(0, 2)
    return sicToIndustry[prefix] || null
  }

  static generateCompanySlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .trim()
  }

  static isTickerSimilar(ticker1: string, ticker2: string): boolean {
    const normalized1 = ticker1.replace(/[^A-Z]/g, '')
    const normalized2 = ticker2.replace(/[^A-Z]/g, '')
    
    if (normalized1 === normalized2) return true
    
    // Check for common variations (e.g., BRK.A vs BRKA)
    if (normalized1.replace(/[AB]$/, '') === normalized2.replace(/[AB]$/, '')) return true
    
    return false
  }

  static getMarketCapCategory(marketCap: number): 'nano' | 'micro' | 'small' | 'mid' | 'large' | 'mega' {
    if (marketCap < 50_000_000) return 'nano' // < $50M
    if (marketCap < 300_000_000) return 'micro' // < $300M  
    if (marketCap < 2_000_000_000) return 'small' // < $2B
    if (marketCap < 10_000_000_000) return 'mid' // < $10B
    if (marketCap < 200_000_000_000) return 'large' // < $200B
    return 'mega' // >= $200B
  }
}

// Error classes
export class CompanyValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'CompanyValidationError'
  }
}

export class CompanyNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Company not found: ${identifier}`)
    this.name = 'CompanyNotFoundError'
  }
}

export class CompanyAlreadyExistsError extends Error {
  constructor(ticker: string) {
    super(`Company already exists: ${ticker}`)
    this.name = 'CompanyAlreadyExistsError'
  }
}

export class InvalidCikError extends Error {
  constructor(cik: string) {
    super(`Invalid CIK format: ${cik}`)
    this.name = 'InvalidCikError'
  }
}

export class InvalidTickerError extends Error {
  constructor(ticker: string) {
    super(`Invalid ticker format: ${ticker}`)
    this.name = 'InvalidTickerError'
  }
}