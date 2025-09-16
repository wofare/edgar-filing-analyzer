import OpenAI from 'openai'
import { env } from '@/lib/env'
import type { FilingComparison, DiffSection } from '@/lib/diff-engine'

export interface SummarizationConfig {
  model?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
}

export interface FilingSummary {
  ticker: string
  formType: string
  filedDate: Date
  tldr: string
  soWhat: string[]
  keyHighlights: string[]
  materialChanges: MaterialChange[]
  overallImpact: 'LOW' | 'MEDIUM' | 'HIGH'
  investorImplications: string[]
  riskFactors: string[]
  metadata: {
    confidenceScore: number
    processingTimeMs: number
    tokenUsage: {
      prompt: number
      completion: number
      total: number
    }
    model: string
    generatedAt: Date
  }
}

export interface MaterialChange {
  section: string
  type: 'ADDITION' | 'DELETION' | 'MODIFICATION'
  summary: string
  impact: string
  materialityScore: number
  businessImplication: string
  quotes: string[]
}

export interface SectionSummary {
  sectionType: string
  summary: string
  keyPoints: string[]
  changes: string[]
  materialityAssessment: string
  businessContext: string
}

const PROMPTS = {
  FILING_SUMMARY: `You are a financial analyst specializing in SEC filing analysis. Analyze the following filing changes and provide a comprehensive summary.

Company: {ticker}
Form Type: {formType}
Filing Date: {filedDate}

Changes Analysis:
{changesAnalysis}

Provide a JSON response with the following structure:
{
  "tldr": "One concise sentence (max 120 chars) summarizing the most important change",
  "soWhat": ["3-5 bullet points explaining why this matters to investors", "Focus on business impact and implications"],
  "keyHighlights": ["5-7 specific notable changes or updates", "Be concrete and actionable"],
  "materialChanges": [
    {
      "section": "section name",
      "type": "ADDITION|DELETION|MODIFICATION", 
      "summary": "What changed",
      "impact": "Why it matters",
      "businessImplication": "How this affects the business",
      "quotes": ["relevant quote from filing if applicable"]
    }
  ],
  "overallImpact": "LOW|MEDIUM|HIGH",
  "investorImplications": ["What investors should know", "Trading/investment considerations"],
  "riskFactors": ["New or changed risk factors", "Areas of concern"]
}

Be concise, accurate, and focus on material business impact. Avoid jargon and speculation.`,

  SECTION_ANALYSIS: `Analyze the following section changes from a {formType} filing for {ticker}:

Section: {sectionName}
Change Type: {changeType}
Old Content: {oldContent}
New Content: {newContent}
Materiality Score: {materialityScore}

Provide a JSON response:
{
  "summary": "Concise summary of what changed",
  "keyPoints": ["3-5 most important points"],
  "changes": ["Specific changes identified"],
  "materialityAssessment": "Why this is/isn't material to investors",
  "businessContext": "How this fits into broader business strategy/context"
}

Focus on business implications and investor relevance.`,

  RISK_ASSESSMENT: `Assess the risk implications of the following filing changes:

Company: {ticker}
Changes: {changes}

Identify:
1. New risks introduced
2. Changes to existing risk factors  
3. Risk mitigation measures
4. Overall risk profile impact

Provide specific, actionable risk assessment focused on investment implications.`
}

export class SummarizationService {
  private client: OpenAI
  private config: Required<SummarizationConfig>
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(config?: SummarizationConfig) {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: config?.timeout || 30000,
    })

    this.config = {
      model: config?.model || 'gpt-4',
      maxTokens: config?.maxTokens || 2000,
      temperature: config?.temperature || 0.1, // Low temperature for factual analysis
      timeout: config?.timeout || 30000,
    }
  }

  async summarizeFiling(
    comparison: FilingComparison,
    ticker: string,
    additionalContext?: {
      companyName?: string
      industry?: string
      marketCap?: number
      recentNews?: string[]
    }
  ): Promise<FilingSummary> {
    const startTime = Date.now()

    try {
      await this.checkRateLimit('filing-summary')

      // Prepare changes analysis
      const changesAnalysis = this.prepareChangesAnalysis(comparison)
      
      // Create the prompt
      const prompt = PROMPTS.FILING_SUMMARY
        .replace('{ticker}', ticker)
        .replace('{formType}', comparison.currentFiling.formType)
        .replace('{filedDate}', comparison.currentFiling.filedDate.toISOString().split('T')[0])
        .replace('{changesAnalysis}', changesAnalysis)

      // Call OpenAI
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst expert in SEC filing analysis. Provide accurate, concise, and investment-focused insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      })

      const usage = response.usage
      const content = response.choices[0]?.message?.content

      if (!content) {
        throw new SummarizationError('No response content from OpenAI')
      }

      // Parse and validate response
      const summaryData = JSON.parse(content)
      
      // Validate required fields
      this.validateSummaryResponse(summaryData)

      const processingTime = Date.now() - startTime

      return {
        ticker,
        formType: comparison.currentFiling.formType,
        filedDate: comparison.currentFiling.filedDate,
        tldr: summaryData.tldr,
        soWhat: summaryData.soWhat,
        keyHighlights: summaryData.keyHighlights,
        materialChanges: summaryData.materialChanges,
        overallImpact: summaryData.overallImpact,
        investorImplications: summaryData.investorImplications,
        riskFactors: summaryData.riskFactors,
        metadata: {
          confidenceScore: this.calculateConfidenceScore(comparison, summaryData),
          processingTimeMs: processingTime,
          tokenUsage: {
            prompt: usage?.prompt_tokens || 0,
            completion: usage?.completion_tokens || 0,
            total: usage?.total_tokens || 0
          },
          model: this.config.model,
          generatedAt: new Date()
        }
      }

    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new SummarizationError(`OpenAI API error: ${error.message}`, true)
      }
      throw error
    }
  }

  async summarizeSection(
    section: DiffSection,
    ticker: string,
    formType: string
  ): Promise<SectionSummary> {
    try {
      await this.checkRateLimit('section-summary')

      const prompt = PROMPTS.SECTION_ANALYSIS
        .replace('{formType}', formType)
        .replace('{ticker}', ticker)
        .replace('{sectionName}', section.sectionName)
        .replace('{changeType}', this.getChangeType(section))
        .replace('{oldContent}', this.truncateContent(section.oldContent, 1500))
        .replace('{newContent}', this.truncateContent(section.newContent, 1500))
        .replace('{materialityScore}', section.materialityScore.toString())

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Analyze SEC filing sections for business implications.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new SummarizationError('No section summary response from OpenAI')
      }

      const summaryData = JSON.parse(content)

      return {
        sectionType: section.sectionType,
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints || [],
        changes: summaryData.changes || [],
        materialityAssessment: summaryData.materialityAssessment,
        businessContext: summaryData.businessContext
      }

    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new SummarizationError(`Section summarization failed: ${error.message}`, true)
      }
      throw error
    }
  }

  async generateKeyTakeaways(
    summary: FilingSummary,
    priceContext?: {
      currentPrice: number
      priceChange: number
      volume: number
    }
  ): Promise<string[]> {
    const takeaways: string[] = []

    // Add TL;DR as first takeaway
    takeaways.push(`📋 ${summary.tldr}`)

    // Add top material changes
    const topChanges = summary.materialChanges
      .filter(change => change.materialityScore >= 0.7)
      .slice(0, 2)

    for (const change of topChanges) {
      const emoji = this.getChangeEmoji(change.type)
      takeaways.push(`${emoji} ${change.summary}`)
    }

    // Add risk factors if significant
    if (summary.riskFactors.length > 0 && summary.overallImpact !== 'LOW') {
      takeaways.push(`⚠️ Key risks: ${summary.riskFactors[0]}`)
    }

    // Add investor implications
    if (summary.investorImplications.length > 0) {
      takeaways.push(`💡 ${summary.investorImplications[0]}`)
    }

    return takeaways.slice(0, 5) // Limit to 5 takeaways
  }

  async generateTwitterThread(summary: FilingSummary): Promise<string[]> {
    const tweets: string[] = []
    const maxTweetLength = 280

    // Tweet 1: Main announcement
    const mainTweet = `🚨 ${summary.ticker} ${summary.formType} Update\n\n${summary.tldr}\n\n🧵 Thread below:`
    tweets.push(this.truncateToTweet(mainTweet))

    // Tweet 2-3: Key highlights
    const highlights = summary.keyHighlights.slice(0, 4)
    let currentTweet = '📊 Key Changes:\n\n'
    
    for (let i = 0; i < highlights.length; i++) {
      const bullet = `${i + 1}. ${highlights[i]}\n`
      
      if ((currentTweet + bullet).length > maxTweetLength) {
        tweets.push(currentTweet.trim())
        currentTweet = `${i + 1}. ${highlights[i]}\n`
      } else {
        currentTweet += bullet
      }
    }
    
    if (currentTweet.trim() !== '📊 Key Changes:') {
      tweets.push(currentTweet.trim())
    }

    // Tweet 4: So what
    if (summary.soWhat.length > 0) {
      const soWhatTweet = `🤔 Why it matters:\n\n${summary.soWhat[0]}`
      tweets.push(this.truncateToTweet(soWhatTweet))
    }

    // Tweet 5: Impact assessment
    const impactEmoji = summary.overallImpact === 'HIGH' ? '🔴' : summary.overallImpact === 'MEDIUM' ? '🟡' : '🟢'
    const impactTweet = `${impactEmoji} Overall Impact: ${summary.overallImpact}\n\n${summary.investorImplications[0] || 'Monitor for developments'}`
    tweets.push(this.truncateToTweet(impactTweet))

    return tweets
  }

  private prepareChangesAnalysis(comparison: FilingComparison): string {
    const analysis: string[] = []
    
    // Overall summary
    analysis.push(`Total sections: ${comparison.summary.totalSections}`)
    analysis.push(`Changed sections: ${comparison.summary.changedSections}`)
    analysis.push(`Material changes: ${comparison.summary.materialChanges}`)
    analysis.push(`Overall materiality: ${comparison.summary.overallMaterialityScore}`)
    analysis.push('')

    // Section-by-section changes
    const materialSections = comparison.sections
      .filter(section => section.materialityScore >= 0.5)
      .sort((a, b) => b.materialityScore - a.materialityScore)
      .slice(0, 5) // Top 5 most material sections

    for (const section of materialSections) {
      analysis.push(`Section: ${section.sectionName}`)
      analysis.push(`Type: ${this.getChangeType(section)}`)
      analysis.push(`Materiality: ${section.materialityScore}`)
      analysis.push(`Summary: ${section.summary}`)
      
      if (section.changes.length > 0) {
        const significantChanges = section.changes.filter(c => c.significance !== 'low')
        if (significantChanges.length > 0) {
          analysis.push(`Key changes: ${significantChanges.slice(0, 2).map(c => 
            c.newText?.substring(0, 100) || c.oldText?.substring(0, 100) || 'Content change'
          ).join('; ')}`)
        }
      }
      analysis.push('')
    }

    return analysis.join('\n')
  }

  private getChangeType(section: DiffSection): string {
    if (!section.oldContent && section.newContent) return 'ADDITION'
    if (section.oldContent && !section.newContent) return 'DELETION'
    if (section.oldContent !== section.newContent) return 'MODIFICATION'
    return 'UNCHANGED'
  }

  private truncateContent(content: string | null, maxLength: number): string {
    if (!content) return 'N/A'
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  private validateSummaryResponse(data: any): void {
    const required = ['tldr', 'soWhat', 'keyHighlights', 'overallImpact']
    
    for (const field of required) {
      if (!data[field]) {
        throw new SummarizationError(`Missing required field: ${field}`)
      }
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(data.overallImpact)) {
      throw new SummarizationError(`Invalid overallImpact value: ${data.overallImpact}`)
    }
  }

  private calculateConfidenceScore(comparison: FilingComparison, summaryData: any): number {
    let score = 0.5 // Base score

    // Higher confidence for more material changes
    if (comparison.summary.overallMaterialityScore >= 0.7) score += 0.3
    else if (comparison.summary.overallMaterialityScore >= 0.4) score += 0.2

    // Higher confidence for structured response
    if (summaryData.materialChanges?.length > 0) score += 0.1
    if (summaryData.soWhat?.length >= 3) score += 0.1

    // Lower confidence for very short or very long responses
    const tldrLength = summaryData.tldr?.length || 0
    if (tldrLength >= 50 && tldrLength <= 120) score += 0.1

    return Math.min(1.0, Math.max(0.0, score))
  }

  private getChangeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'ADDITION': '➕',
      'DELETION': '➖', 
      'MODIFICATION': '📝'
    }
    return emojis[type] || '📄'
  }

  private truncateToTweet(text: string, maxLength = 280): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  private async checkRateLimit(operation: string): Promise<void> {
    const now = Date.now()
    const key = `${operation}_${Math.floor(now / 60000)}` // Per minute tracking
    
    const tracker = this.rateLimitTracker.get(key) || { count: 0, resetTime: now + 60000 }
    
    if (tracker.count >= 20) { // 20 requests per minute limit
      const waitTime = tracker.resetTime - now
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
    
    tracker.count++
    this.rateLimitTracker.set(key, tracker)
    
    // Clean old entries
    for (const [k, v] of this.rateLimitTracker.entries()) {
      if (v.resetTime < now) {
        this.rateLimitTracker.delete(k)
      }
    }
  }
}

// Error classes
export class SummarizationError extends Error {
  constructor(message: string, public retryable: boolean = false) {
    super(message)
    this.name = 'SummarizationError'
  }
}

export class RateLimitError extends SummarizationError {
  constructor(retryAfter: number) {
    super(`Summarization rate limit exceeded. Retry after ${retryAfter}ms`, true)
    this.name = 'RateLimitError'
  }
}

export class InvalidResponseError extends SummarizationError {
  constructor(message: string) {
    super(`Invalid AI response: ${message}`)
    this.name = 'InvalidResponseError'
  }
}

export function createSummarizationService(config?: SummarizationConfig): SummarizationService {
  return new SummarizationService(config)
}

export default SummarizationService
