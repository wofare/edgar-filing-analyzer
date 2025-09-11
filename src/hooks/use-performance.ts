import { useEffect, useRef, useCallback } from 'react'

interface PerformanceMetrics {
  renderTime: number
  componentName: string
  timestamp: number
}

export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0)
  const renderEndTime = useRef<number>(0)

  // Mark render start
  const markRenderStart = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  // Mark render end and log performance
  const markRenderEnd = useCallback(() => {
    renderEndTime.current = performance.now()
    const renderTime = renderEndTime.current - renderStartTime.current

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`)
      
      // Warn if render time is too slow
      if (renderTime > 100) {
        console.warn(`[Performance] Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }
    }

    // Send metrics to monitoring service in production
    if (process.env.NODE_ENV === 'production' && renderTime > 50) {
      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now()
      }
      
      // This would normally send to your monitoring service
      // sendPerformanceMetrics(metrics)
    }

    return renderTime
  }, [componentName])

  // Auto-mark render start on component mount
  useEffect(() => {
    markRenderStart()
    
    return () => {
      markRenderEnd()
    }
  }, [markRenderStart, markRenderEnd])

  return {
    markRenderStart,
    markRenderEnd,
    getRenderTime: () => renderEndTime.current - renderStartTime.current
  }
}

// Hook to measure Core Web Vitals
export function useCoreWebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Measure First Contentful Paint (FCP)
    const measureFCP = () => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            console.log(`FCP: ${entry.startTime.toFixed(2)}ms`)
          }
        }
      })
      
      try {
        observer.observe({ entryTypes: ['paint'] })
      } catch (e) {
        // PerformanceObserver not supported
      }
    }

    // Measure Largest Contentful Paint (LCP)
    const measureLCP = () => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        console.log(`LCP: ${lastEntry.startTime.toFixed(2)}ms`)
      })
      
      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] })
      } catch (e) {
        // PerformanceObserver not supported
      }
    }

    // Measure First Input Delay (FID)
    const measureFID = () => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fid = (entry as any).processingStart - entry.startTime
          console.log(`FID: ${fid.toFixed(2)}ms`)
        }
      })
      
      try {
        observer.observe({ entryTypes: ['first-input'] })
      } catch (e) {
        // PerformanceObserver not supported
      }
    }

    // Measure Cumulative Layout Shift (CLS)
    const measureCLS = () => {
      let clsValue = 0
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        console.log(`CLS: ${clsValue.toFixed(4)}`)
      })
      
      try {
        observer.observe({ entryTypes: ['layout-shift'] })
      } catch (e) {
        // PerformanceObserver not supported
      }
    }

    measureFCP()
    measureLCP()
    measureFID()
    measureCLS()

  }, [])
}

// Hook to measure page load performance
export function usePageLoadPerformance(pageName: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const measurePageLoad = () => {
      // Wait for page to be fully loaded
      if (document.readyState === 'complete') {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        
        const metrics = {
          pageName,
          dns: perfData.domainLookupEnd - perfData.domainLookupStart,
          connection: perfData.connectEnd - perfData.connectStart,
          request: perfData.responseStart - perfData.requestStart,
          response: perfData.responseEnd - perfData.responseStart,
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          domComplete: perfData.domComplete - perfData.navigationStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          total: perfData.loadEventEnd - perfData.navigationStart
        }

        console.log(`[Performance] ${pageName} load metrics:`, metrics)

        // Log warning if total load time > 2 seconds
        if (metrics.total > 2000) {
          console.warn(`[Performance] Slow page load detected for ${pageName}: ${metrics.total.toFixed(2)}ms`)
        }

        return metrics
      } else {
        // Wait for load event
        window.addEventListener('load', measurePageLoad, { once: true })
      }
    }

    measurePageLoad()
  }, [pageName])
}

// Utility function to check if user is on slow connection
export function useConnectionSpeed() {
  const getConnectionInfo = useCallback(() => {
    if (typeof navigator === 'undefined' || !(navigator as any).connection) {
      return { effectiveType: 'unknown', downlink: 0 }
    }
    
    const connection = (navigator as any).connection
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink
    }
  }, [])

  return getConnectionInfo()
}