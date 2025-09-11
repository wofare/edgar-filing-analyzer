import { z } from 'zod'

// Filing validation schemas
export const createFilingSchema = z.object({
  accessionNo: z.string().regex(/^\d{10}-\d{2}-\d{6}$/, 'Invalid accession number format'),
  cik: z.string().regex(/^\d{10}$/, 'CIK must be 10 digits'),
  formType: z.string().min(1, 'Form type is required'),
  filedDate: z.coerce.date(),
  reportDate: z.coerce.date().optional(),
  description: z.string().max(500, 'Description too long').optional(),
  documentUrl: z.string().url('Invalid document URL'),
})

export const filingIngestSchema = z.object({
  cik: z.string().regex(/^\d{10}$/, 'CIK must be 10 digits'),
  accessionNo: z.string().regex(/^\d{10}-\d{2}-\d{6}$/, 'Invalid accession number format'),
  formType: z.string().min(1, 'Form type is required'),
  forceReprocess: z.boolean().default(false),
})

export const bulkFilingIngestSchema = z.object({
  filings: z.array(filingIngestSchema).min(1, 'At least one filing required').max(50, 'Maximum 50 filings per batch'),
})

export const filingFilterSchema = z.object({
  formType: z.string().optional(),
  ticker: z.string().regex(/^[A-Z]{1,5}$/, 'Invalid ticker format').optional(),
  cik: z.string().regex(/^\d{10}$/, 'Invalid CIK format').optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  hasChanges: z.boolean().optional(),
  minMaterialityScore: z.number().min(0).max(1).optional(),
  processed: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(25),
})

export const filingDiffFilterSchema = z.object({
  section: z.string().optional(),
  changeType: z.string().optional(),
  minMaterialityScore: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(100).default(50),
})

// Filing response schemas
export const filingResponseSchema = z.object({
  id: z.string(),
  accessionNo: z.string(),
  cik: z.string(),
  companyName: z.string(),
  ticker: z.string(),
  formType: z.string(),
  filedDate: z.date(),
  reportDate: z.date().nullable(),
  description: z.string().nullable(),
  documentUrl: z.string(),
  processed: z.boolean(),
  summary: z.string().nullable(),
  keyHighlights: z.array(z.string()),
  overallImpact: z.string().nullable(),
  totalChanges: z.number(),
  materialChanges: z.number(),
  hasChanges: z.boolean(),
  materialityScore: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const filingListResponseSchema = z.object({
  filings: z.array(filingResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
})

export const filingDiffResponseSchema = z.object({
  filing: filingResponseSchema,
  summary: z.object({
    totalChanges: z.number(),
    materialChanges: z.number(),
    overallImpact: z.string(),
    keyHighlights: z.array(z.string()),
  }),
  diffs: z.array(z.object({
    id: z.string(),
    sectionType: z.string(),
    changeType: z.string(),
    summary: z.string(),
    impact: z.string().nullable(),
    materialityScore: z.number().nullable(),
    oldContent: z.string().nullable(),
    newContent: z.string().nullable(),
    sectionOrder: z.number().nullable(),
    createdAt: z.date(),
  })),
  materialityTags: z.array(z.object({
    type: z.string(),
    label: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    description: z.string().nullable(),
  })),
})

export const jobStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  cik: z.string().optional(),
  accessionNo: z.string().optional(),
  formType: z.string().optional(),
  progress: z.number().min(0).max(1).optional(),
  estimatedCompletion: z.date().nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).nullable(),
  result: z.object({
    filingId: z.string(),
    totalChanges: z.number(),
    materialChanges: z.number(),
  }).nullable(),
  attempts: z.number(),
  maxAttempts: z.number(),
  lastAttempt: z.date().nullable(),
  nextRetryAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Type definitions
export type CreateFilingInput = z.infer<typeof createFilingSchema>
export type FilingIngestInput = z.infer<typeof filingIngestSchema>
export type BulkFilingIngestInput = z.infer<typeof bulkFilingIngestSchema>
export type FilingFilterInput = z.infer<typeof filingFilterSchema>
export type FilingDiffFilterInput = z.infer<typeof filingDiffFilterSchema>
export type FilingResponse = z.infer<typeof filingResponseSchema>
export type FilingListResponse = z.infer<typeof filingListResponseSchema>
export type FilingDiffResponse = z.infer<typeof filingDiffResponseSchema>
export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>

// Filing utility functions
export class FilingModel {
  static validateAccessionNumber(accessionNo: string): boolean {
    return /^\d{10}-\d{2}-\d{6}$/.test(accessionNo)
  }

  static extractCikFromAccession(accessionNo: string): string | null {
    const match = accessionNo.match(/^(\d{10})-\d{2}-\d{6}$/)
    return match ? match[1] : null
  }

  static generateFilingUrl(cik: string, accessionNo: string): string {
    const cleanAccession = accessionNo.replace(/-/g, '')
    return `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${cleanAccession}/${accessionNo}.txt`
  }

  static generateViewerUrl(cik: string, accessionNo: string): string {
    return `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accessionNo.replace(/-/g, '')}/${accessionNo}-index.html`
  }

  static categorizeFormType(formType: string): 'annual' | 'quarterly' | 'current' | 'proxy' | 'registration' | 'other' {
    if (formType.startsWith('10-K')) return 'annual'
    if (formType.startsWith('10-Q')) return 'quarterly'
    if (formType.startsWith('8-K')) return 'current'
    if (formType.includes('DEF 14A')) return 'proxy'
    if (formType.startsWith('S-1') || formType.startsWith('S-3')) return 'registration'
    return 'other'
  }

  static isAmendment(formType: string): boolean {
    return formType.includes('/A')
  }

  static getBaseFormType(formType: string): string {
    return formType.replace('/A', '')
  }

  static calculateProcessingPriority(formType: string, filedDate: Date): number {
    // Higher number = higher priority
    let priority = 50 // Base priority
    
    // Recent filings get higher priority
    const daysSinceFiledMs = Date.now() - filedDate.getTime()
    const daysSinceFiled = daysSinceFiledMs / (1000 * 60 * 60 * 24)
    
    if (daysSinceFiled < 1) priority += 50
    else if (daysSinceFiled < 7) priority += 30
    else if (daysSinceFiled < 30) priority += 10
    
    // Form type priority
    const formTypePriority: Record<string, number> = {
      '8-K': 40,      // Current events - high priority
      '10-Q': 30,     // Quarterly - medium-high priority  
      '10-K': 25,     // Annual - medium priority
      'DEF 14A': 20,  // Proxy - medium priority
      'S-1': 15,      // Registration - lower priority
    }
    
    const baseForm = this.getBaseFormType(formType)
    priority += formTypePriority[baseForm] || 0
    
    return priority
  }

  static estimateProcessingTime(formType: string, fileSize?: number): number {
    // Estimate processing time in minutes
    const baseTime: Record<string, number> = {
      '8-K': 2,      // Usually shorter
      '10-Q': 8,     // Medium length
      '10-K': 15,    // Longer, more complex
      'DEF 14A': 10, // Proxy statements
      'S-1': 20,     // Registration, very long
    }
    
    const baseForm = this.getBaseFormType(formType)
    let estimate = baseTime[baseForm] || 10
    
    // Adjust for file size if available
    if (fileSize) {
      const sizeMB = fileSize / (1024 * 1024)
      if (sizeMB > 5) estimate *= 1.5
      if (sizeMB > 10) estimate *= 2
    }
    
    return Math.ceil(estimate)
  }

  static parseFilingDate(dateStr: string): Date | null {
    // Handle various date formats from SEC
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,          // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,        // MM/DD/YYYY  
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,    // M/D/YYYY
    ]
    
    for (const format of formats) {
      if (format.test(dateStr)) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }
    
    return null
  }

  static generateJobId(cik: string, accessionNo: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)
    return `filing_${cik}_${accessionNo.replace(/-/g, '')}_${timestamp}_${random}`
  }

  static isRecentFiling(filedDate: Date, daysThreshold: number = 30): boolean {
    const daysSinceFiledMs = Date.now() - filedDate.getTime()
    const daysSinceFiled = daysSinceFiledMs / (1000 * 60 * 60 * 24)
    return daysSinceFiled <= daysThreshold
  }

  static shouldTriggerAlerts(formType: string, materialChanges: number, materialityScore: number): boolean {
    // Determine if filing should trigger user alerts
    if (materialChanges === 0) return false
    if (materialityScore < 0.5) return false
    
    // Always alert for certain form types
    const alwaysAlert = ['8-K', '8-K/A'] // Current reports are always important
    if (alwaysAlert.includes(formType)) return true
    
    // Alert for material changes in periodic reports
    const periodicForms = ['10-K', '10-K/A', '10-Q', '10-Q/A']
    if (periodicForms.includes(formType) && materialityScore >= 0.7) return true
    
    return false
  }
}

// Error classes
export class FilingValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'FilingValidationError'
  }
}

export class FilingNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Filing not found: ${identifier}`)
    this.name = 'FilingNotFoundError'
  }
}

export class FilingAlreadyProcessedError extends Error {
  constructor(accessionNo: string) {
    super(`Filing already processed: ${accessionNo}`)
    this.name = 'FilingAlreadyProcessedError'
  }
}

export class FilingProcessingError extends Error {
  constructor(message: string, public retryable: boolean = true) {
    super(message)
    this.name = 'FilingProcessingError'
  }
}

export class InvalidAccessionNumberError extends Error {
  constructor(accessionNo: string) {
    super(`Invalid accession number format: ${accessionNo}`)
    this.name = 'InvalidAccessionNumberError'
  }
}