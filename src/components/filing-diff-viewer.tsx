'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Diff,
  Eye,
  Download,
  Share,
  Loader2,
  Calendar
} from 'lucide-react'

interface FilingDiff {
  id: string
  section: string
  changeType: string
  summary: string | null
  impact: string | null
  materialityScore: number
  lineNumber: number | null
  beforeText?: string
  afterText?: string
  context?: {
    beforeLines: string[]
    afterLines: string[]
  }
}

interface FilingDiffData {
  filing: {
    id: string
    cik: string
    accessionNo: string
    ticker: string
    companyName: string
    formType: string
    filedDate: string
    reportDate: string | null
    url: string
    summary: string | null
    content?: string
  }
  previousFiling?: {
    id: string
    accessionNo: string
    filedDate: string
    formType: string
  }
  diffs: FilingDiff[]
  metadata: {
    totalChanges: number
    materialChanges: number
    sectionsChanged: string[]
    analysisDate: string
    comparisonMethod: string
  }
}

interface FilingDiffViewerProps {
  cik: string
  accessionNo: string
  className?: string
}

export function FilingDiffViewer({ cik, accessionNo, className }: FilingDiffViewerProps) {
  const [diffData, setDiffData] = useState<FilingDiffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [materialityThreshold, setMaterialityThreshold] = useState(0.5)
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all')
  const [diffFormat, setDiffFormat] = useState<'summary' | 'detailed' | 'raw'>('summary')

  // UI State
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDiffData()
  }, [cik, accessionNo, materialityThreshold, diffFormat])

  const fetchDiffData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        materialityThreshold: materialityThreshold.toString(),
        diffFormat,
        includeDiffs: 'true',
        includeContent: diffFormat === 'raw' ? 'true' : 'false'
      })

      const response = await fetch(`/api/filings/${cik}/${accessionNo}?${params}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Filing not found')
        }
        throw new Error(`Failed to fetch filing diff: ${response.statusText}`)
      }

      const data = await response.json()
      setDiffData(data)

    } catch (err) {
      console.error('Error fetching diff data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load diff data')
    } finally {
      setLoading(false)
    }
  }

  const filteredDiffs = useMemo(() => {
    if (!diffData) return []

    let filtered = diffData.diffs

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(diff =>
        diff.section.toLowerCase().includes(query) ||
        diff.summary?.toLowerCase().includes(query) ||
        diff.impact?.toLowerCase().includes(query) ||
        diff.changeType.toLowerCase().includes(query)
      )
    }

    // Filter by section
    if (selectedSection !== 'all') {
      filtered = filtered.filter(diff => diff.section === selectedSection)
    }

    // Filter by change type
    if (changeTypeFilter !== 'all') {
      filtered = filtered.filter(diff => diff.changeType.toLowerCase() === changeTypeFilter.toLowerCase())
    }

    // Sort by materiality score (highest first)
    return filtered.sort((a, b) => b.materialityScore - a.materialityScore)
  }, [diffData, searchQuery, selectedSection, changeTypeFilter])

  const toggleDiffExpansion = (diffId: string) => {
    setExpandedDiffs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(diffId)) {
        newSet.delete(diffId)
      } else {
        newSet.add(diffId)
      }
      return newSet
    })
  }

  const getMaterialityColor = (score: number) => {
    if (score >= 0.8) return 'destructive'
    if (score >= 0.7) return 'destructive'
    if (score >= 0.5) return 'secondary'
    return 'outline'
  }

  const getMaterialityLevel = (score: number) => {
    if (score >= 0.8) return 'Very High'
    if (score >= 0.7) return 'High'
    if (score >= 0.5) return 'Medium'
    return 'Low'
  }

  const getChangeTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'addition': return 'bg-green-50 text-green-700 border-green-200'
      case 'deletion': return 'bg-red-50 text-red-700 border-red-200'
      case 'modification': return 'bg-blue-50 text-blue-700 border-blue-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analyzing filing differences...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !diffData) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Diff</h3>
          <p className="text-gray-600 mb-4">{error || 'No diff data available'}</p>
          <Button onClick={fetchDiffData}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Diff className="w-5 h-5" />
                Filing Comparison Analysis
              </CardTitle>
              <CardDescription>
                {diffData.filing.ticker} • {diffData.filing.formType} • {formatDate(diffData.filing.filedDate)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{diffData.metadata.totalChanges}</div>
              <div className="text-sm text-gray-500">Total Changes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{diffData.metadata.materialChanges}</div>
              <div className="text-sm text-gray-500">Material Changes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{diffData.metadata.sectionsChanged.length}</div>
              <div className="text-sm text-gray-500">Sections Modified</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {diffData.previousFiling ? 'vs Previous' : 'No Comparison'}
              </div>
              <div className="text-sm text-gray-500">
                {diffData.previousFiling ? formatDate(diffData.previousFiling.filedDate) : 'First Filing'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search changes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Section</label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {diffData.metadata.sectionsChanged.map(section => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Change Type</label>
              <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="addition">Addition</SelectItem>
                  <SelectItem value="deletion">Deletion</SelectItem>
                  <SelectItem value="modification">Modification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Min Materiality: {materialityThreshold}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={materialityThreshold}
                onChange={(e) => setMaterialityThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diff Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Changes Found ({filteredDiffs.length})
          </h3>
          <Select value={diffFormat} onValueChange={setDiffFormat as any}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="raw">Raw Text</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredDiffs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Changes Found</h3>
              <p className="text-gray-600">
                No changes match your current filter criteria. Try adjusting the filters above.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDiffs.map((diff) => (
            <Card key={diff.id} className="overflow-hidden">
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline">{diff.section}</Badge>
                          <Badge className={getChangeTypeColor(diff.changeType)}>
                            {diff.changeType}
                          </Badge>
                          <Badge variant={getMaterialityColor(diff.materialityScore)}>
                            {getMaterialityLevel(diff.materialityScore)} ({diff.materialityScore.toFixed(2)})
                          </Badge>
                          {diff.lineNumber && (
                            <span className="text-sm text-gray-500">
                              Line {diff.lineNumber}
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-base">
                          {diff.summary || 'Change detected'}
                        </CardTitle>
                        {diff.impact && (
                          <CardDescription className="mt-1">
                            Impact: {diff.impact}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDiffExpansion(diff.id)}
                      >
                        {expandedDiffs.has(diff.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    {diffFormat === 'raw' && (diff.beforeText || diff.afterText) && (
                      <div className="space-y-4">
                        {diff.beforeText && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Before:</h4>
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                              <pre className="text-sm text-red-800 whitespace-pre-wrap">
                                {diff.beforeText}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {diff.afterText && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">After:</h4>
                            <div className="bg-green-50 border border-green-200 rounded p-3">
                              <pre className="text-sm text-green-800 whitespace-pre-wrap">
                                {diff.afterText}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {diffFormat === 'detailed' && diff.context && (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Context (Before):</h4>
                          <div className="bg-gray-50 border rounded p-3">
                            {diff.context.beforeLines.map((line, index) => (
                              <div key={index} className="text-sm text-gray-700">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Context (After):</h4>
                          <div className="bg-gray-50 border rounded p-3">
                            {diff.context.afterLines.map((line, index) => (
                              <div key={index} className="text-sm text-gray-700">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {diffFormat === 'summary' && (
                      <div className="text-sm text-gray-600">
                        <p>
                          This change has been categorized as <strong>{diff.changeType.toLowerCase()}</strong> 
                          {diff.impact && <span> with the following impact: {diff.impact}</span>}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}