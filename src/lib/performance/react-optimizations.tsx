import React, { memo, useMemo, useCallback, lazy, Suspense } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useInfiniteQuery } from '@tanstack/react-query'

// Lazy loading components
export const LazyFilingDetails = lazy(() => import('@/components/FilingDetails'))
export const LazyCompanyChart = lazy(() => import('@/components/CompanyChart'))
export const LazyAnalytics = lazy(() => import('@/components/Analytics'))

// Performance optimized components
export const OptimizedCompanyList = memo(function CompanyList({ 
  companies, 
  onSelectCompany,
  selectedCompanyId 
}: {
  companies: any[]
  onSelectCompany: (companyId: string) => void
  selectedCompanyId?: string
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  // Virtualized list for large datasets
  const virtualizer = useVirtualizer({
    count: companies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  })

  const memoizedCompanyItems = useMemo(() => {
    return virtualizer.getVirtualItems().map((virtualItem) => {
      const company = companies[virtualItem.index]
      return (
        <CompanyListItem
          key={company.id}
          company={company}
          isSelected={company.id === selectedCompanyId}
          onSelect={onSelectCompany}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`
          }}
        />
      )
    })
  }, [virtualizer.getVirtualItems(), companies, selectedCompanyId, onSelectCompany])

  return (
    <div
      ref={parentRef}
      className="h-96 overflow-auto"
      style={{
        contain: 'strict'
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {memoizedCompanyItems}
      </div>
    </div>
  )
})

const CompanyListItem = memo(function CompanyListItem({
  company,
  isSelected,
  onSelect,
  style
}: {
  company: any
  isSelected: boolean
  onSelect: (companyId: string) => void
  style: React.CSSProperties
}) {
  const handleClick = useCallback(() => {
    onSelect(company.id)
  }, [company.id, onSelect])

  const priceChangeClass = useMemo(() => {
    if (!company.priceChange) return 'text-gray-500'
    return company.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
  }, [company.priceChange])

  const formattedPrice = useMemo(() => {
    return company.currentPrice ? `$${company.currentPrice.toFixed(2)}` : 'N/A'
  }, [company.currentPrice])

  const formattedChange = useMemo(() => {
    if (!company.priceChange || !company.priceChangePercent) return 'N/A'
    const sign = company.priceChange >= 0 ? '+' : ''
    return `${sign}${company.priceChange.toFixed(2)} (${sign}${company.priceChangePercent.toFixed(2)}%)`
  }, [company.priceChange, company.priceChangePercent])

  return (
    <div
      style={style}
      className={`
        flex items-center justify-between p-4 border-b cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
      `}
      onClick={handleClick}
    >
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className="font-medium text-gray-900">{company.symbol}</div>
          <div className="text-sm text-gray-500 truncate">{company.name}</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">{company.industry}</div>
      </div>
      
      <div className="text-right">
        <div className="font-medium">{formattedPrice}</div>
        <div className={`text-sm ${priceChangeClass}`}>{formattedChange}</div>
      </div>
    </div>
  )
})

// Optimized filing list with infinite scroll
export const OptimizedFilingList = memo(function FilingList({
  companyId,
  onSelectFiling
}: {
  companyId: string
  onSelectFiling: (filing: any) => void
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['filings', companyId],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(`/api/filings?companyId=${companyId}&offset=${pageParam}&limit=20`)
      if (!response.ok) throw new Error('Failed to fetch filings')
      return response.json()
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length * 20 : undefined
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000 // 10 minutes
  })

  const allFilings = useMemo(() => {
    return data?.pages.flatMap(page => page.filings) ?? []
  }, [data])

  const parentRef = React.useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: allFilings.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 3
  })

  React.useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse()

    if (!lastItem) return

    if (
      lastItem.index >= allFilings.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allFilings.length,
    isFetchingNextPage,
    virtualizer.getVirtualItems()
  ])

  if (isLoading) {
    return <FilingListSkeleton />
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-8">
        Failed to load filings. Please try again.
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-96 overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const isLoaderRow = virtualItem.index > allFilings.length - 1
          const filing = allFilings[virtualItem.index]

          return (
            <div
              key={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? (
                  <FilingItemSkeleton />
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No more filings to load
                  </div>
                )
              ) : (
                <FilingListItem
                  filing={filing}
                  onSelect={onSelectFiling}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

const FilingListItem = memo(function FilingListItem({
  filing,
  onSelect
}: {
  filing: any
  onSelect: (filing: any) => void
}) {
  const handleClick = useCallback(() => {
    onSelect(filing)
  }, [filing, onSelect])

  const formattedDate = useMemo(() => {
    return new Date(filing.filedDate).toLocaleDateString()
  }, [filing.filedDate])

  const materialChangesCount = useMemo(() => {
    return filing._count?.diffs || 0
  }, [filing._count])

  const hasMaterialChanges = materialChangesCount > 0

  return (
    <div
      className="flex items-start justify-between p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {filing.formType}
          </span>
          {hasMaterialChanges && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {materialChangesCount} Material Changes
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-900 line-clamp-2 mb-1">
          {filing.summary || 'No summary available'}
        </p>
        
        {filing.keyHighlights && filing.keyHighlights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {filing.keyHighlights.slice(0, 3).map((highlight: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
              >
                {highlight}
              </span>
            ))}
            {filing.keyHighlights.length > 3 && (
              <span className="text-xs text-gray-500">
                +{filing.keyHighlights.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="text-right text-sm text-gray-500 ml-4">
        <div>{formattedDate}</div>
        {filing.reportDate && (
          <div className="text-xs">
            Report: {new Date(filing.reportDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  )
})

// Skeleton components for loading states
const FilingListSkeleton = () => (
  <div className="space-y-4 p-4">
    {Array.from({ length: 5 }).map((_, index) => (
      <FilingItemSkeleton key={index} />
    ))}
  </div>
)

const FilingItemSkeleton = () => (
  <div className="animate-pulse border-b p-4">
    <div className="flex items-start space-x-4">
      <div className="flex-1">
        <div className="flex space-x-2 mb-2">
          <div className="h-5 w-12 bg-gray-200 rounded-full"></div>
          <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="flex space-x-1">
          <div className="h-6 w-16 bg-gray-200 rounded"></div>
          <div className="h-6 w-20 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div className="w-20">
        <div className="h-4 bg-gray-200 rounded mb-1"></div>
        <div className="h-3 bg-gray-200 rounded"></div>
      </div>
    </div>
  </div>
)

// Optimized dashboard component
export const OptimizedDashboard = memo(function Dashboard({
  userId
}: {
  userId: string
}) {
  const { data: dashboardData, isLoading } = useInfiniteQuery({
    queryKey: ['dashboard', userId],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  })

  const memoizedContent = useMemo(() => {
    if (!dashboardData) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Watchlist"
          value={dashboardData.summary.totalCompanies}
          limit={dashboardData.userLimits.watchlistLimit}
          icon="companies"
        />
        
        <DashboardCard
          title="Alerts This Week"
          value={dashboardData.summary.alertsThisWeek}
          icon="alerts"
        />
        
        <DashboardCard
          title="Plan"
          value={dashboardData.userLimits.canUseAPI ? 'Pro' : 'Basic'}
          icon="plan"
        />
      </div>
    )
  }, [dashboardData])

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {memoizedContent}
      
      <Suspense fallback={<div className="h-64 bg-gray-100 rounded animate-pulse"></div>}>
        <LazyAnalytics userId={userId} />
      </Suspense>
    </div>
  )
})

const DashboardCard = memo(function DashboardCard({
  title,
  value,
  limit,
  icon
}: {
  title: string
  value: string | number
  limit?: number
  icon: string
}) {
  const displayValue = useMemo(() => {
    if (typeof value === 'number' && limit) {
      return `${value}/${limit === 999999 ? '∞' : limit}`
    }
    return value
  }, [value, limit])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{displayValue}</p>
        </div>
        <div className="text-blue-600">
          {/* Icon would go here */}
        </div>
      </div>
    </div>
  )
})

const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={index} className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-8 w-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    ))}
  </div>
)

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  React.useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      if (renderTime > 16.67) { // Longer than one frame at 60fps
        console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`)
      }
      
      // Report to performance monitoring service
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'page_render_time', {
          component: componentName,
          duration: Math.round(renderTime)
        })
      }
    }
  }, [componentName])
}