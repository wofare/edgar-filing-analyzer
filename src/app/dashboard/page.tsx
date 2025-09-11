'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewCard } from '@/components/overview-card'
import { AlertSettingsForm } from '@/components/forms/alert-settings'
import {
  Bell,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertCircle,
  Settings,
  Eye,
  ExternalLink,
  Loader2,
  Clock,
  Building
} from 'lucide-react'

interface WatchlistItem {
  id: string
  ticker: string
  companyName: string
  alertTypes: string[]
  priceChangeThreshold: number
  isActive: boolean
  addedAt: string
  latestPrice?: {
    current: number
    change: number
    changePercent: number
  }
  recentActivity?: {
    filings: number
    materialChanges: number
  }
}

interface RecentFiling {
  id: string
  ticker: string
  companyName: string
  formType: string
  filedDate: string
  summary: string
  materialChanges: number
  materialityScore: number
}

export default function DashboardPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [recentFilings, setRecentFilings] = useState<RecentFiling[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingTicker, setAddingTicker] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch user's watchlist and alert settings
      const alertResponse = await fetch('/api/settings/alerts', {
        headers: {
          'x-user-id': 'demo-user' // In real app, get from auth
        }
      })

      if (alertResponse.ok) {
        const alertData = await alertResponse.json()
        setWatchlist(alertData.watchlist || [])
      }

      // Fetch recent filings
      const filingsResponse = await fetch('/api/filings?limit=20&sortBy=filedDate&sortOrder=desc&materialChangesOnly=false')
      
      if (filingsResponse.ok) {
        const filingsData = await filingsResponse.json()
        setRecentFilings(filingsData.filings || [])
      }

      // Fetch price data for watchlist items
      // In a real app, this would be done in parallel or server-side
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToWatchlist = async (ticker: string) => {
    if (!ticker.trim()) return

    try {
      const response = await fetch('/api/settings/alerts?action=watchlist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user'
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          alertTypes: ['MATERIAL_CHANGE', 'NEW_FILING'],
          priceChangeThreshold: 5,
          isActive: true
        })
      })

      if (response.ok) {
        const result = await response.json()
        setWatchlist(prev => [...prev, result.item])
        setAddingTicker('')
      } else {
        throw new Error('Failed to add to watchlist')
      }
    } catch (err) {
      console.error('Error adding to watchlist:', err)
      alert('Failed to add ticker to watchlist')
    }
  }

  const handleRemoveFromWatchlist = async (itemId: string) => {
    try {
      const response = await fetch(`/api/settings/alerts?action=watchlist&id=${itemId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': 'demo-user'
        }
      })

      if (response.ok) {
        setWatchlist(prev => prev.filter(item => item.id !== itemId))
      } else {
        throw new Error('Failed to remove from watchlist')
      }
    } catch (err) {
      console.error('Error removing from watchlist:', err)
      alert('Failed to remove from watchlist')
    }
  }

  const filteredFilings = recentFilings.filter(filing =>
    filing.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filing.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    filing.formType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Monitor your portfolio and stay informed about material changes</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-900">Error Loading Dashboard</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchDashboardData}
                  className="ml-auto"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="watchlist" className="space-y-6">
          <TabsList>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="filings">Recent Filings</TabsTrigger>
            <TabsTrigger value="alerts">Alert Settings</TabsTrigger>
          </TabsList>

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="space-y-6">
            {/* Add to Watchlist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add to Watchlist
                </CardTitle>
                <CardDescription>
                  Track companies and get notified about material changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter ticker symbol (e.g., AAPL)"
                    value={addingTicker}
                    onChange={(e) => setAddingTicker(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddToWatchlist(addingTicker)}
                    className="max-w-xs"
                  />
                  <Button 
                    onClick={() => handleAddToWatchlist(addingTicker)}
                    disabled={!addingTicker.trim()}
                  >
                    Add to Watchlist
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Watchlist Items */}
            {watchlist.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Companies in Watchlist</h3>
                  <p className="text-gray-600 mb-6">Add companies to your watchlist to track their SEC filings and price movements</p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => handleAddToWatchlist('AAPL')}>
                      Add AAPL as Example
                    </Button>
                    <Link href="/">
                      <Button variant="outline">Browse Popular Companies</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{item.ticker}</CardTitle>
                          <CardDescription className="text-sm">
                            {item.companyName}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/stocks/${item.ticker}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveFromWatchlist(item.id)}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {/* Price Data (if available) */}
                        {item.latestPrice && (
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">
                              ${item.latestPrice.current.toFixed(2)}
                            </span>
                            <div className={`flex items-center gap-1 ${
                              item.latestPrice.change >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.latestPrice.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              <span className="font-medium">
                                {formatPercent(item.latestPrice.changePercent)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Alert Types */}
                        <div className="flex flex-wrap gap-1">
                          {item.alertTypes.map((type) => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>

                        {/* Recent Activity */}
                        {item.recentActivity && (
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {item.recentActivity.filings} filings
                              </span>
                              {item.recentActivity.materialChanges > 0 && (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <AlertCircle className="w-3 h-3" />
                                  {item.recentActivity.materialChanges} changes
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          Added {formatDate(item.addedAt)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recent Filings Tab */}
          <TabsContent value="filings" className="space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Recent SEC Filings
                </CardTitle>
                <CardDescription>
                  Latest filings from all companies with material changes highlighted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Search by ticker, company name, or form type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                  <Link href="/filings">
                    <Button variant="outline">
                      View All Filings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Filings List */}
            <div className="space-y-4">
              {filteredFilings.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Filings</h3>
                    <p className="text-gray-600">No recent filings match your search criteria</p>
                  </CardContent>
                </Card>
              ) : (
                filteredFilings.map((filing) => (
                  <Card key={filing.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Link href={`/stocks/${filing.ticker}`}>
                              <Badge variant="outline" className="font-mono cursor-pointer hover:bg-blue-50">
                                {filing.ticker}
                              </Badge>
                            </Link>
                            <Badge variant="secondary">{filing.formType}</Badge>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(filing.filedDate)}
                            </span>
                          </div>

                          <h3 className="font-medium text-gray-900 mb-1">{filing.companyName}</h3>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{filing.summary}</p>

                          <div className="flex items-center gap-4">
                            {filing.materialChanges > 0 && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  {filing.materialChanges} material changes
                                </span>
                              </div>
                            )}
                            <div className="text-sm text-gray-500">
                              Materiality: <span className="font-medium">{filing.materialityScore.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Link href={`/stocks/${filing.ticker}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Alert Settings Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Alert Settings
                </CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications about material changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertSettingsForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}