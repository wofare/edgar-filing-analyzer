'use client'

import { useMemo, memo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PriceChartProps {
  data: number[]
  currentPrice: number
  change: number
  changePercent: number
  period?: string
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  animate?: boolean
  variant?: 'line' | 'area'
}

interface ChartDataPoint {
  index: number
  price: number
  timestamp: string
}

export const PriceChart = memo(function PriceChart({
  data,
  currentPrice,
  change,
  changePercent,
  period = '1M',
  height = 300,
  showGrid = true,
  showTooltip = true,
  animate = true,
  variant = 'area'
}: PriceChartProps) {
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return []

    return data.map((price, index) => ({
      index,
      price,
      timestamp: generateTimestamp(index, data.length, period)
    }))
  }, [data, period])

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (data.length === 0) return { minPrice: 0, maxPrice: 0, priceRange: 0 }
    
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min
    
    return {
      minPrice: min - (range * 0.1), // Add 10% padding below
      maxPrice: max + (range * 0.1), // Add 10% padding above  
      priceRange: range
    }
  }, [data])

  const isPositive = change >= 0
  const chartColor = isPositive ? '#16a34a' : '#dc2626'
  const gradientColor = isPositive ? '#16a34a20' : '#dc262620'

  // Memoize formatters for performance
  const formatCurrency = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return (value: number) => formatter.format(value)
  }, [])

  const formatPercent = useCallback((value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }, [])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload as ChartDataPoint
    
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3">
        <div className="text-sm text-gray-600 mb-1">{data.timestamp}</div>
        <div className="font-semibold">{formatCurrency(data.price)}</div>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No chart data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold">
            {formatCurrency(currentPrice)}
          </div>
          <div className={`flex items-center gap-1 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="font-medium">
              {formatCurrency(Math.abs(change))} ({formatPercent(changePercent)})
            </span>
          </div>
        </div>
        <Badge variant="secondary">{period}</Badge>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          {variant === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              
              {showGrid && (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#e2e8f0" 
                  vertical={false}
                />
              )}
              
              <XAxis 
                dataKey="index"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => ''}
              />
              
              <YAxis 
                domain={[minPrice, maxPrice]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => formatCurrency(value)}
                width={60}
              />
              
              {showTooltip && (
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
              )}
              
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: chartColor,
                  stroke: 'white',
                  strokeWidth: 2
                }}
                animationDuration={animate ? 1500 : 0}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              {showGrid && (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#e2e8f0" 
                  vertical={false}
                />
              )}
              
              <XAxis 
                dataKey="index"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => ''}
              />
              
              <YAxis 
                domain={[minPrice, maxPrice]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => formatCurrency(value)}
                width={60}
              />
              
              {showTooltip && (
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
              )}
              
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: chartColor,
                  stroke: 'white',
                  strokeWidth: 2
                }}
                animationDuration={animate ? 1500 : 0}
                animationEasing="ease-in-out"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Chart Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-gray-500">Min</div>
          <div className="font-medium text-red-600">
            {formatCurrency(Math.min(...data))}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Avg</div>
          <div className="font-medium">
            {formatCurrency(data.reduce((a, b) => a + b, 0) / data.length)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Max</div>
          <div className="font-medium text-green-600">
            {formatCurrency(Math.max(...data))}
          </div>
        </div>
      </div>
    </div>
  )
})

function generateTimestamp(index: number, totalPoints: number, period: string): string {
  const now = new Date()
  let startTime: Date

  // Calculate start time based on period
  switch (period) {
    case '1D':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '1W':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '1M':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '3M':
      startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case '1Y':
      startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    default:
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  // Calculate timestamp for this data point
  const timeRange = now.getTime() - startTime.getTime()
  const pointTime = new Date(startTime.getTime() + (index / (totalPoints - 1)) * timeRange)

  // Format based on period
  if (period === '1D') {
    return pointTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  } else {
    return pointTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }
}

// Export mini version for overview cards
export function MiniPriceChart({ 
  data, 
  change, 
  width = 100, 
  height = 40 
}: { 
  data: number[]
  change: number
  width?: number 
  height?: number 
}) {
  if (!data || data.length === 0) return null

  const chartData = data.map((price, index) => ({ index, price }))
  const color = change >= 0 ? '#16a34a' : '#dc2626'

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          animationDuration={0}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}