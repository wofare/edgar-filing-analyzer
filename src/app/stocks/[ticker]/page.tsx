'use client'

import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { usePerformanceMonitor, usePageLoadPerformance, useCoreWebVitals } from '@/hooks/use-performance'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Dynamically import heavy components with loading states
const OverviewCard = dynamic(() => import('@/components/overview-card').then(mod => ({ default: mod.OverviewCard })), {
  loading: () => <Card className="animate-pulse h-64 bg-slate-200" />,
  ssr: false
})

const PriceChart = dynamic(() => import('@/components/charts/price-chart').then(mod => ({ default: mod.PriceChart })), {
  loading: () => <Card className="animate-pulse h-80 bg-slate-200" />,
  ssr: false
})

const FilingDiffViewer = dynamic(() => import('@/components/filing-diff-viewer').then(mod => ({ default: mod.FilingDiffViewer })), {
  loading: () => <div className="animate-pulse h-40 bg-slate-200 rounded" />,
  ssr: false
})
import { 
  ArrowLeft, 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Calendar,
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2
} from 'lucide-react'

interface StockOverview {
  ticker: string
  companyName: string
  latestFiling: {
    formType: string
    filedDate: string
    summary: string
    soWhat: string[]
    materialityScore: number
  } | null
  priceData: {
    current: number
    change: number
    changePercent: number
    sparkline: number[]
  } | null
  recentFilings: Array<{
    accessionNo: string
    formType: string
    filedDate: string
  }>
  materialChanges: Array<{
    type: string
    description: string
    impact: string
  }>
}

interface PriceData {
  symbol: string
  current: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  volume: number
  sparkline: number[]
  provider: string
  lastUpdated: string
}

export default function StockOverviewPage() {
  const params = useParams()
  const ticker = (params.ticker as string)?.toUpperCase()

  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToWatchlist, setAddingToWatchlist] = useState(false)

  // Performance monitoring
  const { markRenderStart, markRenderEnd } = usePerformanceMonitor(`StockOverviewPage-${ticker}`)
  usePageLoadPerformance(`/stocks/${ticker}`)
  useCoreWebVitals()

  // Mark render start
  useEffect(() => {
    markRenderStart()
  }, [])

  useEffect(() => {
    if (!ticker) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch both overview and price data in parallel for better performance
        const [overviewResponse, priceResponse] = await Promise.allSettled([
          fetch(`/api/stocks/${ticker}/overview`),
          fetch(`/api/price/${ticker}?period=1M`)
        ])

        // Handle overview response
        if (overviewResponse.status === 'fulfilled') {
          if (!overviewResponse.value.ok) {
            if (overviewResponse.value.status === 404) {
              throw new Error(`Company with ticker ${ticker} not found`)
            }
            throw new Error(`Failed to fetch overview: ${overviewResponse.value.statusText}`)
          }
          const overviewData = await overviewResponse.value.json()
          setOverview(overviewData)
        } else {
          throw new Error('Failed to fetch stock overview')
        }

        // Handle price response (optional, non-blocking)
        if (priceResponse.status === 'fulfilled' && priceResponse.value.ok) {
          const priceDataResult = await priceResponse.value.json()
          setPriceData(priceDataResult)
        } else {
          console.warn('Failed to fetch detailed price data')
        }

      } catch (err) {
        console.error('Error fetching stock data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load stock data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [ticker])

  const handleAddToWatchlist = async () => {
    if (!ticker) return

    try {
      setAddingToWatchlist(true)

      const response = await fetch('/api/settings/alerts?action=watchlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user' // In real app, get from auth
        },
        body: JSON.stringify({
          ticker,
          alertTypes: ['MATERIAL_CHANGE', 'NEW_FILING'],
          priceChangeThreshold: 5,
          isActive: true
        })
      })

      if (response.ok) {
        // Show success message (would use toast in real app)
        alert(`${ticker} added to watchlist!`)
      } else {
        throw new Error('Failed to add to watchlist')
      }
    } catch (err) {
      console.error('Error adding to watchlist:', err)
      alert('Failed to add to watchlist. Please try again.')
    } finally {
      setAddingToWatchlist(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading {ticker} data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Data Available</h1>
          <p className="text-gray-600">No filing data found for {ticker}</p>
        </div>
      </div>
    )
  }

  // Memoize expensive formatters
  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    return (dateString: string) => formatter.format(new Date(dateString))
  }, [])

  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })
    return (value: number) => formatter.format(value)
  }, [])

  const formatPercent = useMemo(() => {
    return (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {overview.ticker}
                </h1>
                <p className="text-lg text-gray-600">{overview.companyName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                onClick={handleAddToWatchlist}
                disabled={addingToWatchlist}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {addingToWatchlist ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Watchlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Overview & Price */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price & Overview Card */}
            <Suspense fallback={<Card className="animate-pulse h-64 bg-slate-200" />}>
              <OverviewCard
                ticker={overview.ticker}
                companyName={overview.companyName}
                priceData={overview.priceData || priceData}
                latestFiling={overview.latestFiling}
              />
            </Suspense>

            {/* Price Chart */}
            {(overview.priceData || priceData) && (
              <Suspense fallback={<Card className="animate-pulse h-80 bg-slate-200" />}>
                <Card>
                  <CardHeader>
                    <CardTitle>Price Chart</CardTitle>
                    <CardDescription>
                      {priceData ? `Last updated: ${formatDate(priceData.lastUpdated)}` : 'Real-time price data'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PriceChart 
                      data={(overview.priceData || priceData)!.sparkline}
                      currentPrice={(overview.priceData || priceData)!.current}
                      change={(overview.priceData || priceData)!.change}
                      changePercent={(overview.priceData || priceData)!.changePercent}
                    />
                  </CardContent>
                </Card>
              </Suspense>
            )}

            {/* Material Changes */}
            {overview.materialChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    Material Changes
                  </CardTitle>
                  <CardDescription>
                    Significant changes detected in recent filings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {overview.materialChanges.map((change, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline">{change.type}</Badge>
                        </div>
                        <p className="text-sm text-gray-900 mb-2">{change.description}</p>
                        <p className="text-sm text-gray-600">{change.impact}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Recent Filings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Filings</CardTitle>
                <CardDescription>
                  Latest SEC filings from {overview.companyName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {overview.recentFilings.map((filing, index) => (
                    <div key={filing.accessionNo} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{filing.formType}</div>
                        <div className="text-sm text-gray-500">
                          {formatDate(filing.filedDate)}
                        </div>
                      </div>
                      <Link 
                        href={`/filings/${overview.ticker}/${filing.accessionNo.replace(/-/g, '')}`}
                      >
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Latest Filing Details */}
            {overview.latestFiling && (
              <Card>
                <CardHeader>
                  <CardTitle>Latest Filing</CardTitle>
                  <CardDescription>
                    {overview.latestFiling.formType} • {formatDate(overview.latestFiling.filedDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="text-sm text-gray-600">{overview.latestFiling.summary}</p>
                    </div>

                    {overview.latestFiling.soWhat.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Key Highlights</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {overview.latestFiling.soWhat.map((highlight, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-1">•</span>
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm text-gray-500">
                        Materiality Score: <span className="font-medium">{overview.latestFiling.materialityScore.toFixed(2)}</span>
                      </div>
                      <Badge 
                        variant={overview.latestFiling.materialityScore >= 0.7 ? 'destructive' : 'secondary'}
                      >
                        {overview.latestFiling.materialityScore >= 0.7 ? 'High' : 'Medium'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Bell className="w-4 h-4 mr-2" />
                  Set Price Alerts
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  View All Filings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analyze Trends
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}