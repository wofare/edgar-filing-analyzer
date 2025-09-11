'use client'

import { memo, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  AlertCircle,
  DollarSign,
  BarChart3,
  Clock
} from 'lucide-react'

interface PriceData {
  current: number
  change: number
  changePercent: number
  sparkline?: number[]
  open?: number
  high?: number
  low?: number
  volume?: number
  lastUpdated?: string
}

interface LatestFiling {
  formType: string
  filedDate: string
  summary: string
  soWhat: string[]
  materialityScore: number
}

interface OverviewCardProps {
  ticker: string
  companyName: string
  priceData: PriceData | null
  latestFiling: LatestFiling | null
}

export const OverviewCard = memo(function OverviewCard({
  ticker,
  companyName,
  priceData,
  latestFiling
}: OverviewCardProps) {
  // Memoize formatters for better performance
  const formatters = useMemo(() => ({
    currency: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    date: new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }), [])

  const formatCurrency = useMemo(() => (value: number) => formatters.currency.format(value), [formatters.currency])
  const formatPercent = useMemo(() => (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, [])
  
  const formatVolume = useMemo(() => (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`
    }
    return volume.toLocaleString()
  }, [])

  const formatDate = useMemo(() => (dateString: string) => formatters.date.format(new Date(dateString)), [formatters.date])

  const getMaterialityLevel = useMemo(() => (score: number) => {
    if (score >= 0.8) return { level: 'Very High', color: 'destructive' as const }
    if (score >= 0.7) return { level: 'High', color: 'destructive' as const }
    if (score >= 0.5) return { level: 'Medium', color: 'secondary' as const }
    return { level: 'Low', color: 'secondary' as const }
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{ticker}</CardTitle>
            <CardDescription className="text-base">{companyName}</CardDescription>
          </div>
          {priceData?.lastUpdated && (
            <div className="text-right text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last updated: {formatDate(priceData.lastUpdated)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price Section */}
        {priceData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(priceData.current)}
                </div>
                <div className={`flex items-center gap-2 text-lg ${
                  priceData.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {priceData.change >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  <span>
                    {formatCurrency(Math.abs(priceData.change))} ({formatPercent(priceData.changePercent)})
                  </span>
                </div>
              </div>

              {/* Mini Sparkline */}
              {priceData.sparkline && priceData.sparkline.length > 0 && (
                <div className="w-24 h-12 relative">
                  <svg className="w-full h-full" viewBox="0 0 100 50">
                    <polyline
                      fill="none"
                      stroke={priceData.change >= 0 ? "#16a34a" : "#dc2626"}
                      strokeWidth="2"
                      points={priceData.sparkline
                        .map((price, index) => {
                          const x = (index / (priceData.sparkline!.length - 1)) * 100
                          const min = Math.min(...priceData.sparkline!)
                          const max = Math.max(...priceData.sparkline!)
                          const y = max === min ? 25 : 45 - ((price - min) / (max - min)) * 40
                          return `${x},${y}`
                        })
                        .join(' ')}
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Additional Price Metrics */}
            {(priceData.open || priceData.high || priceData.low || priceData.volume) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {priceData.open && (
                  <div>
                    <div className="text-gray-500">Open</div>
                    <div className="font-medium">{formatCurrency(priceData.open)}</div>
                  </div>
                )}
                {priceData.high && (
                  <div>
                    <div className="text-gray-500">High</div>
                    <div className="font-medium text-green-600">{formatCurrency(priceData.high)}</div>
                  </div>
                )}
                {priceData.low && (
                  <div>
                    <div className="text-gray-500">Low</div>
                    <div className="font-medium text-red-600">{formatCurrency(priceData.low)}</div>
                  </div>
                )}
                {priceData.volume && (
                  <div>
                    <div className="text-gray-500">Volume</div>
                    <div className="font-medium">{formatVolume(priceData.volume)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Price data not available</p>
          </div>
        )}

        {priceData && latestFiling && <Separator />}

        {/* Latest Filing Section */}
        {latestFiling ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-semibold">Latest Filing</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{latestFiling.formType}</Badge>
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(latestFiling.filedDate)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-gray-700 text-sm leading-relaxed">
                {latestFiling.summary}
              </p>

              {/* Key Highlights */}
              {latestFiling.soWhat.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-900 mb-2">Key Highlights:</h4>
                  <ul className="space-y-1">
                    {latestFiling.soWhat.slice(0, 3).map((highlight, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-600 mt-1 flex-shrink-0">•</span>
                        <span className="line-clamp-2">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  {latestFiling.soWhat.length > 3 && (
                    <p className="text-xs text-gray-500 mt-1">
                      +{latestFiling.soWhat.length - 3} more highlights
                    </p>
                  )}
                </div>
              )}

              {/* Materiality Score */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Materiality Score: <span className="font-medium">{latestFiling.materialityScore.toFixed(2)}</span>
                  </span>
                </div>
                <Badge variant={getMaterialityLevel(latestFiling.materialityScore).color}>
                  {getMaterialityLevel(latestFiling.materialityScore).level}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent filings available</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button size="sm" className="flex-1 sm:flex-none">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Details
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
            <FileText className="w-4 h-4 mr-2" />
            All Filings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})