import { diffLines, diffWords, diffChars, Change } from 'diff'

export interface DiffSection {
  sectionType: string
  sectionName: string
  oldContent: string | null
  newContent: string | null
  changes: DiffChange[]
  materialityScore: number
  summary: string
  impact: string | null
  sectionOrder?: number
  lineStart?: number
  lineEnd?: number
}

export interface DiffChange {
  changeType: 'addition' | 'deletion' | 'modification' | 'unchanged'
  oldText: string | null
  newText: string | null
  context: string
  significance: 'low' | 'medium' | 'high'
  keywords: string[]
  position: {
    lineNumber: number
    characterStart: number
    characterEnd: number
  }
}

export interface FilingComparison {
  previousFiling: FilingDocument | null
  currentFiling: FilingDocument
  sections: DiffSection[]
  summary: {
    totalSections: number
    changedSections: number
    addedSections: number
    removedSections: number
    materialChanges: number
    overallMaterialityScore: number
    keyChanges: string[]
    impactAssessment: string
  }
  metadata: {
    comparedAt: Date
    processingTimeMs: number
    engineVersion: string
  }
}

export interface FilingDocument {
  accessionNumber: string
  cik: string
  formType: string
  filedDate: Date
  content: string
  sections: ExtractedSection[]
}

export interface ExtractedSection {
  type: string
  name: string
  content: string
  order: number
  lineStart: number
  lineEnd: number
  metadata?: Record<string, any>
}

class SectionExtractor {
  private static readonly SECTION_PATTERNS = {
    '10-K': [
      { type: 'BUSINESS', pattern: /ITEM\s+1[.\s]+BUSINESS/i, name: 'Business Overview' },
      { type: 'RISK_FACTORS', pattern: /ITEM\s+1A[.\s]+RISK\s+FACTORS/i, name: 'Risk Factors' },
      { type: 'PROPERTIES', pattern: /ITEM\s+2[.\s]+PROPERTIES/i, name: 'Properties' },
      { type: 'LEGAL_PROCEEDINGS', pattern: /ITEM\s+3[.\s]+LEGAL\s+PROCEEDINGS/i, name: 'Legal Proceedings' },
      { type: 'SELECTED_FINANCIAL', pattern: /ITEM\s+6[.\s]+SELECTED\s+FINANCIAL/i, name: 'Selected Financial Data' },
      { type: 'MD_A', pattern: /ITEM\s+7[.\s]+MANAGEMENT'?S\s+DISCUSSION/i, name: 'Management Discussion & Analysis' },
      { type: 'FINANCIAL_STATEMENTS', pattern: /ITEM\s+8[.\s]+FINANCIAL\s+STATEMENTS/i, name: 'Financial Statements' },
      { type: 'CONTROLS', pattern: /ITEM\s+9A[.\s]+CONTROLS\s+AND\s+PROCEDURES/i, name: 'Controls and Procedures' }
    ],
    '10-Q': [
      { type: 'FINANCIAL_STATEMENTS', pattern: /ITEM\s+1[.\s]+FINANCIAL\s+STATEMENTS/i, name: 'Financial Statements' },
      { type: 'MD_A', pattern: /ITEM\s+2[.\s]+MANAGEMENT'?S\s+DISCUSSION/i, name: 'Management Discussion & Analysis' },
      { type: 'CONTROLS', pattern: /ITEM\s+4[.\s]+CONTROLS\s+AND\s+PROCEDURES/i, name: 'Controls and Procedures' },
      { type: 'LEGAL_PROCEEDINGS', pattern: /ITEM\s+1[.\s]+LEGAL\s+PROCEEDINGS/i, name: 'Legal Proceedings' }
    ],
    '8-K': [
      { type: 'TRIGGERING_EVENTS', pattern: /ITEM\s+[1-9][.\s]/i, name: 'Triggering Events' },
      { type: 'FINANCIAL_STATEMENTS', pattern: /ITEM\s+9\.01[.\s]+FINANCIAL\s+STATEMENTS/i, name: 'Financial Statements' },
      { type: 'EXHIBITS', pattern: /ITEM\s+9\.01[.\s]+EXHIBITS/i, name: 'Exhibits' }
    ]
  }

  static extractSections(content: string, formType: string): ExtractedSection[] {
    const sections: ExtractedSection[] = []
    const patterns = this.SECTION_PATTERNS[formType as keyof typeof this.SECTION_PATTERNS] || []
    
    if (patterns.length === 0) {
      // Generic section extraction for unknown form types
      return this.extractGenericSections(content)
    }

    const lines = content.split('\n')
    let currentSection: ExtractedSection | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Check if line matches any section pattern
      for (const pattern of patterns) {
        if (pattern.pattern.test(line)) {
          // Save previous section if exists
          if (currentSection) {
            currentSection.lineEnd = i - 1
            currentSection.content = currentSection.content.trim()
            sections.push(currentSection)
          }
          
          // Start new section
          currentSection = {
            type: pattern.type,
            name: pattern.name,
            content: '',
            order: sections.length + 1,
            lineStart: i,
            lineEnd: lines.length - 1 // Will be updated when next section starts
          }
          
          break
        }
      }
      
      // Add line to current section
      if (currentSection) {
        currentSection.content += line + '\n'
      }
    }
    
    // Add final section
    if (currentSection) {
      currentSection.content = currentSection.content.trim()
      sections.push(currentSection)
    }
    
    return sections
  }

  private static extractGenericSections(content: string): ExtractedSection[] {
    const sections: ExtractedSection[] = []
    const lines = content.split('\n')
    
    // Look for headers (lines that are mostly uppercase or have specific patterns)
    let currentSection: ExtractedSection | null = null
    let sectionCounter = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip empty lines
      if (!line) continue
      
      // Check if line looks like a section header
      const isHeader = this.isLikelyHeader(line, i, lines)
      
      if (isHeader) {
        // Save previous section
        if (currentSection) {
          currentSection.lineEnd = i - 1
          currentSection.content = currentSection.content.trim()
          sections.push(currentSection)
        }
        
        // Start new section
        currentSection = {
          type: 'SECTION_' + (++sectionCounter),
          name: line.substring(0, 100), // Limit header length
          content: '',
          order: sectionCounter,
          lineStart: i,
          lineEnd: lines.length - 1
        }
      }
      
      // Add line to current section
      if (currentSection) {
        currentSection.content += lines[i] + '\n'
      } else if (sectionCounter === 0) {
        // Create initial section for content before first header
        currentSection = {
          type: 'PREAMBLE',
          name: 'Document Preamble',
          content: lines[i] + '\n',
          order: 0,
          lineStart: 0,
          lineEnd: lines.length - 1
        }
      }
    }
    
    // Add final section
    if (currentSection) {
      currentSection.content = currentSection.content.trim()
      sections.push(currentSection)
    }
    
    return sections
  }

  private static isLikelyHeader(line: string, lineIndex: number, allLines: string[]): boolean {
    // Various heuristics to identify headers
    if (line.length < 3 || line.length > 200) return false
    
    // Check for item patterns
    if (/^\s*ITEM\s+\d+/i.test(line)) return true
    
    // Check for part patterns  
    if (/^\s*PART\s+[IVX]+/i.test(line)) return true
    
    // Check if mostly uppercase and not too long
    const uppercaseRatio = (line.match(/[A-Z]/g) || []).length / line.length
    if (uppercaseRatio > 0.7 && line.length < 100) {
      // Check if next few lines are regular text (not all caps)
      const nextLines = allLines.slice(lineIndex + 1, lineIndex + 4)
      const hasRegularText = nextLines.some(nextLine => {
        const nextUppercaseRatio = (nextLine.match(/[A-Z]/g) || []).length / nextLine.length
        return nextUppercaseRatio < 0.5 && nextLine.trim().length > 10
      })
      
      return hasRegularText
    }
    
    return false
  }
}

class MaterialityAnalyzer {
  private static readonly MATERIAL_KEYWORDS = {
    high: [
      'material adverse', 'significantly', 'substantially', 'materially',
      'acquisition', 'merger', 'bankruptcy', 'restructuring', 'litigation',
      'impairment', 'discontinued', 'segment', 'divest', 'spin-off',
      'going concern', 'default', 'covenant', 'restatement'
    ],
    medium: [
      'change', 'modify', 'update', 'revise', 'amend', 'new', 'increased',
      'decreased', 'investment', 'contract', 'agreement', 'policy',
      'estimate', 'outlook', 'guidance', 'facility', 'debt'
    ],
    low: [
      'additional', 'disclosure', 'note', 'footnote', 'reference',
      'see also', 'updated', 'clarification', 'formatting'
    ]
  }

  static analyzeMateriality(oldContent: string | null, newContent: string | null, changeType: string): {
    score: number
    keywords: string[]
    significance: 'low' | 'medium' | 'high'
    reasoning: string
  } {
    let score = 0
    const foundKeywords: string[] = []
    
    const content = newContent || oldContent || ''
    const contentLower = content.toLowerCase()
    
    // Base score from change type
    const changeTypeScores: Record<string, number> = {
      'addition': 0.6,
      'deletion': 0.7,
      'modification': 0.5,
      'unchanged': 0.0
    }
    
    score += changeTypeScores[changeType] || 0.5
    
    // Keyword analysis
    for (const [level, keywords] of Object.entries(this.MATERIAL_KEYWORDS)) {
      const weight = level === 'high' ? 0.3 : level === 'medium' ? 0.2 : 0.1
      
      for (const keyword of keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          score += weight
          foundKeywords.push(keyword)
          
          // Don't double-count keywords
          if (score >= 1.0) break
        }
      }
      
      if (score >= 1.0) break
    }
    
    // Content length factor (longer changes tend to be more material)
    const contentLength = content.length
    if (contentLength > 1000) score += 0.1
    if (contentLength > 5000) score += 0.1
    
    // Numeric changes (dollar amounts, percentages) are often material
    const hasNumbers = /\$[\d,]+|\d+%|\d+\.\d+/.test(content)
    if (hasNumbers) score += 0.2
    
    // Cap score at 1.0
    score = Math.min(score, 1.0)
    
    // Determine significance
    let significance: 'low' | 'medium' | 'high'
    if (score >= 0.7) significance = 'high'
    else if (score >= 0.4) significance = 'medium'
    else significance = 'low'
    
    const reasoning = this.generateMaterialityReasoning(score, foundKeywords, changeType)
    
    return {
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      keywords: foundKeywords,
      significance,
      reasoning
    }
  }

  private static generateMaterialityReasoning(score: number, keywords: string[], changeType: string): string {
    const reasons: string[] = []
    
    if (keywords.length > 0) {
      const highKeywords = keywords.filter(k => this.MATERIAL_KEYWORDS.high.includes(k))
      if (highKeywords.length > 0) {
        reasons.push(`Contains high-impact keywords: ${highKeywords.join(', ')}`)
      }
    }
    
    if (changeType === 'addition') reasons.push('New content added')
    else if (changeType === 'deletion') reasons.push('Content removed')
    else if (changeType === 'modification') reasons.push('Existing content modified')
    
    if (score >= 0.7) reasons.push('High materiality score indicates significant impact')
    else if (score >= 0.4) reasons.push('Medium materiality score indicates moderate impact')
    
    return reasons.length > 0 ? reasons.join('; ') : 'Standard content change'
  }
}

export class DiffEngine {
  private engineVersion = '1.0.0'

  async compareFilings(previousFiling: FilingDocument | null, currentFiling: FilingDocument): Promise<FilingComparison> {
    const startTime = Date.now()
    
    const sections: DiffSection[] = []
    const currentSections = currentFiling.sections
    const previousSections = previousFiling?.sections || []
    
    // Create maps for easier lookup
    const previousSectionMap = new Map<string, ExtractedSection>()
    previousSections.forEach(section => {
      previousSectionMap.set(section.type, section)
    })
    
    const processedTypes = new Set<string>()
    
    // Compare current sections with previous
    for (const currentSection of currentSections) {
      const previousSection = previousSectionMap.get(currentSection.type)
      
      const diffSection = await this.compareSections(
        previousSection || null,
        currentSection,
        currentSection.type
      )
      
      sections.push(diffSection)
      processedTypes.add(currentSection.type)
    }
    
    // Handle removed sections (present in previous but not in current)
    for (const previousSection of previousSections) {
      if (!processedTypes.has(previousSection.type)) {
        const diffSection = await this.compareSections(
          previousSection,
          null,
          previousSection.type
        )
        
        sections.push(diffSection)
      }
    }
    
    // Calculate summary statistics
    const summary = this.calculateSummary(sections)
    
    const processingTimeMs = Date.now() - startTime
    
    return {
      previousFiling,
      currentFiling,
      sections,
      summary,
      metadata: {
        comparedAt: new Date(),
        processingTimeMs,
        engineVersion: this.engineVersion
      }
    }
  }

  private async compareSections(
    previousSection: ExtractedSection | null,
    currentSection: ExtractedSection | null,
    sectionType: string
  ): Promise<DiffSection> {
    const oldContent = previousSection?.content || null
    const newContent = currentSection?.content || null
    
    let changeType: 'addition' | 'deletion' | 'modification' | 'unchanged'
    let changes: DiffChange[] = []
    
    if (!oldContent && newContent) {
      changeType = 'addition'
      changes = this.createAdditionChanges(newContent)
    } else if (oldContent && !newContent) {
      changeType = 'deletion'
      changes = this.createDeletionChanges(oldContent)
    } else if (oldContent && newContent) {
      if (oldContent === newContent) {
        changeType = 'unchanged'
      } else {
        changeType = 'modification'
        changes = this.compareTexts(oldContent, newContent)
      }
    } else {
      changeType = 'unchanged'
    }
    
    // Analyze materiality
    const materiality = MaterialityAnalyzer.analyzeMateriality(oldContent, newContent, changeType)
    
    // Generate summary
    const summary = this.generateSectionSummary(changeType, changes, materiality)
    
    return {
      sectionType,
      sectionName: currentSection?.name || previousSection?.name || sectionType,
      oldContent,
      newContent,
      changes,
      materialityScore: materiality.score,
      summary,
      impact: materiality.reasoning,
      sectionOrder: currentSection?.order || previousSection?.order,
      lineStart: currentSection?.lineStart || previousSection?.lineStart,
      lineEnd: currentSection?.lineEnd || previousSection?.lineEnd
    }
  }

  private compareTexts(oldText: string, newText: string): DiffChange[] {
    const changes: DiffChange[] = []
    
    // Use word-level diffing for better granularity
    const diff = diffWords(oldText, newText, { ignoreCase: false })
    
    let position = 0
    let lineNumber = 1
    
    for (const change of diff) {
      const value = change.value || ''
      const lines = value.split('\n')
      
      let changeType: 'addition' | 'deletion' | 'modification' | 'unchanged'
      if (change.added) changeType = 'addition'
      else if (change.removed) changeType = 'deletion'
      else changeType = 'unchanged'
      
      if (changeType !== 'unchanged') {
        const materiality = MaterialityAnalyzer.analyzeMateriality(
          change.removed ? value : null,
          change.added ? value : null,
          changeType
        )
        
        changes.push({
          changeType,
          oldText: change.removed ? value : null,
          newText: change.added ? value : null,
          context: this.extractContext(oldText, newText, position),
          significance: materiality.significance,
          keywords: materiality.keywords,
          position: {
            lineNumber,
            characterStart: position,
            characterEnd: position + value.length
          }
        })
      }
      
      // Update position tracking
      position += value.length
      lineNumber += lines.length - 1
    }
    
    return changes
  }

  private createAdditionChanges(content: string): DiffChange[] {
    const materiality = MaterialityAnalyzer.analyzeMateriality(null, content, 'addition')
    
    return [{
      changeType: 'addition',
      oldText: null,
      newText: content,
      context: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      significance: materiality.significance,
      keywords: materiality.keywords,
      position: {
        lineNumber: 1,
        characterStart: 0,
        characterEnd: content.length
      }
    }]
  }

  private createDeletionChanges(content: string): DiffChange[] {
    const materiality = MaterialityAnalyzer.analyzeMateriality(content, null, 'deletion')
    
    return [{
      changeType: 'deletion',
      oldText: content,
      newText: null,
      context: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      significance: materiality.significance,
      keywords: materiality.keywords,
      position: {
        lineNumber: 1,
        characterStart: 0,
        characterEnd: content.length
      }
    }]
  }

  private extractContext(oldText: string, newText: string, position: number, contextLength = 100): string {
    const text = newText || oldText
    const start = Math.max(0, position - contextLength / 2)
    const end = Math.min(text.length, position + contextLength / 2)
    
    let context = text.substring(start, end)
    if (start > 0) context = '...' + context
    if (end < text.length) context = context + '...'
    
    return context
  }

  private generateSectionSummary(
    changeType: string,
    changes: DiffChange[],
    materiality: { score: number; keywords: string[]; significance: string; reasoning: string }
  ): string {
    if (changeType === 'unchanged') {
      return 'No changes detected in this section'
    }
    
    if (changeType === 'addition') {
      return `New section added${materiality.keywords.length > 0 ? ` containing: ${materiality.keywords.slice(0, 3).join(', ')}` : ''}`
    }
    
    if (changeType === 'deletion') {
      return `Section removed${materiality.keywords.length > 0 ? ` (previously contained: ${materiality.keywords.slice(0, 3).join(', ')})` : ''}`
    }
    
    const highImpactChanges = changes.filter(c => c.significance === 'high').length
    const mediumImpactChanges = changes.filter(c => c.significance === 'medium').length
    
    let summary = `${changes.length} change${changes.length !== 1 ? 's' : ''} detected`
    
    if (highImpactChanges > 0) {
      summary += `, ${highImpactChanges} high-impact`
    }
    
    if (mediumImpactChanges > 0) {
      summary += `, ${mediumImpactChanges} medium-impact`
    }
    
    if (materiality.keywords.length > 0) {
      summary += `. Key terms: ${materiality.keywords.slice(0, 3).join(', ')}`
    }
    
    return summary
  }

  private calculateSummary(sections: DiffSection[]) {
    const totalSections = sections.length
    const changedSections = sections.filter(s => s.changes.length > 0).length
    const addedSections = sections.filter(s => !s.oldContent && s.newContent).length
    const removedSections = sections.filter(s => s.oldContent && !s.newContent).length
    const materialChanges = sections.filter(s => s.materialityScore >= 0.7).length
    
    const overallMaterialityScore = sections.length > 0
      ? sections.reduce((sum, s) => sum + s.materialityScore, 0) / sections.length
      : 0
    
    // Generate key changes
    const keyChanges = sections
      .filter(s => s.materialityScore >= 0.6)
      .sort((a, b) => b.materialityScore - a.materialityScore)
      .slice(0, 5)
      .map(s => s.summary)
    
    // Generate impact assessment
    let impactAssessment = 'Low impact'
    if (overallMaterialityScore >= 0.7) impactAssessment = 'High impact'
    else if (overallMaterialityScore >= 0.4) impactAssessment = 'Medium impact'
    
    return {
      totalSections,
      changedSections,
      addedSections,
      removedSections,
      materialChanges,
      overallMaterialityScore: Math.round(overallMaterialityScore * 100) / 100,
      keyChanges,
      impactAssessment
    }
  }

  static extractSections(content: string, formType: string): ExtractedSection[] {
    return SectionExtractor.extractSections(content, formType)
  }
}

// Error classes
export class DiffEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiffEngineError'
  }
}

export class InvalidFilingFormatError extends DiffEngineError {
  constructor(formType: string) {
    super(`Unsupported filing format: ${formType}`)
    this.name = 'InvalidFilingFormatError'
  }
}

export class SectionExtractionError extends DiffEngineError {
  constructor(message: string) {
    super(`Section extraction failed: ${message}`)
    this.name = 'SectionExtractionError'
  }
}

export function createDiffEngine(): DiffEngine {
  return new DiffEngine()
}

export default DiffEngine
