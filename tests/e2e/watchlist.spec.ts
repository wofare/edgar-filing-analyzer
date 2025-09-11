import { test, expect } from '@playwright/test'

test.describe('Watchlist Management', () => {
  test.use({ storageState: 'tests/e2e/auth/user.json' })

  test('should add company to watchlist', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Navigate to add company
    await page.click('[data-testid="add-company-button"]')
    
    // Search for a company
    await page.fill('[data-testid="company-search-input"]', 'TESTCO')
    await page.click('[data-testid="search-button"]')
    
    // Should show search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="company-result"]').first()).toContainText('Test Company Inc.')
    
    // Add company to watchlist
    await page.click('[data-testid="add-to-watchlist-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('added to watchlist')
    
    // Verify company appears in watchlist
    await page.goto('/watchlist')
    await expect(page.locator('[data-testid="watchlist-item"]').first()).toContainText('TESTCO')
  })

  test('should remove company from watchlist', async ({ page }) => {
    await page.goto('/watchlist')
    
    // Should have at least one company in watchlist
    await expect(page.locator('[data-testid="watchlist-item"]')).toHaveCount(1)
    
    // Remove company
    await page.click('[data-testid="remove-from-watchlist-button"]')
    
    // Confirm removal in modal
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible()
    await page.click('[data-testid="confirm-remove-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('removed from watchlist')
    
    // Watchlist should be empty
    await expect(page.locator('[data-testid="empty-watchlist"]')).toBeVisible()
  })

  test('should configure alert settings for company', async ({ page }) => {
    // First add a company to watchlist
    await page.goto('/dashboard')
    await page.click('[data-testid="add-company-button"]')
    await page.fill('[data-testid="company-search-input"]', 'TESTCO')
    await page.click('[data-testid="search-button"]')
    await page.click('[data-testid="add-to-watchlist-button"]')
    
    // Navigate to watchlist
    await page.goto('/watchlist')
    
    // Configure alerts for company
    await page.click('[data-testid="configure-alerts-button"]')
    
    // Update alert settings
    await page.check('[data-testid="material-change-alerts"]')
    await page.check('[data-testid="new-filing-alerts"]')
    await page.fill('[data-testid="materiality-threshold"]', '0.7')
    
    await page.click('[data-testid="save-alert-settings"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Alert settings saved')
  })

  test('should enforce free plan watchlist limit', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check current watchlist count
    const watchlistCount = await page.locator('[data-testid="watchlist-count"]').textContent()
    const currentCount = parseInt(watchlistCount?.split(' ')[0] || '0')
    
    // If we're at the limit (3 for free plan), try to add another
    if (currentCount >= 3) {
      await page.click('[data-testid="add-company-button"]')
      await page.fill('[data-testid="company-search-input"]', 'DEMO')
      await page.click('[data-testid="search-button"]')
      await page.click('[data-testid="add-to-watchlist-button"]')
      
      // Should show limit message
      await expect(page.locator('[data-testid="limit-message"]')).toContainText('watchlist limit')
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible()
    }
  })

  test('should display company overview and filings', async ({ page }) => {
    // Add company first
    await page.goto('/dashboard')
    await page.click('[data-testid="add-company-button"]')
    await page.fill('[data-testid="company-search-input"]', 'TESTCO')
    await page.click('[data-testid="search-button"]')
    await page.click('[data-testid="add-to-watchlist-button"]')
    
    // View company details
    await page.goto('/watchlist')
    await page.click('[data-testid="view-company-button"]')
    
    // Should show company overview
    await expect(page.locator('[data-testid="company-name"]')).toContainText('Test Company Inc.')
    await expect(page.locator('[data-testid="company-symbol"]')).toContainText('TESTCO')
    await expect(page.locator('[data-testid="company-industry"]')).toContainText('Technology')
    
    // Should show recent filings
    await expect(page.locator('[data-testid="recent-filings"]')).toBeVisible()
    await expect(page.locator('[data-testid="filing-item"]')).toHaveCount(1)
    
    // Click on filing to view details
    await page.click('[data-testid="filing-item"]')
    await expect(page.locator('[data-testid="filing-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="filing-summary"]')).toContainText('Annual report')
  })

  test('should search and filter companies', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('[data-testid="add-company-button"]')
    
    // Test search functionality
    await page.fill('[data-testid="company-search-input"]', 'Test')
    await page.click('[data-testid="search-button"]')
    
    // Should show filtered results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
    const results = page.locator('[data-testid="company-result"]')
    await expect(results).toHaveCountGreaterThan(0)
    
    // All results should contain 'Test' in name or symbol
    const resultCount = await results.count()
    for (let i = 0; i < resultCount; i++) {
      const resultText = await results.nth(i).textContent()
      expect(resultText?.toLowerCase()).toMatch(/test/i)
    }
    
    // Test industry filter
    await page.selectOption('[data-testid="industry-filter"]', 'Technology')
    await page.click('[data-testid="search-button"]')
    
    // Results should be filtered by industry
    const filteredResults = page.locator('[data-testid="company-result"]')
    const filteredCount = await filteredResults.count()
    
    if (filteredCount > 0) {
      for (let i = 0; i < filteredCount; i++) {
        const industry = await filteredResults.nth(i).locator('[data-testid="company-industry"]').textContent()
        expect(industry).toContain('Technology')
      }
    }
  })
})

test.describe('Premium Watchlist Features', () => {
  test.use({ storageState: 'tests/e2e/auth/premium.json' })

  test('should allow more companies for premium users', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Premium users should see higher limits
    const limitsText = await page.locator('[data-testid="watchlist-limits"]').textContent()
    expect(limitsText).toMatch(/25|unlimited/i)
  })

  test('should show advanced analytics', async ({ page }) => {
    await page.goto('/watchlist')
    
    // Premium features should be available
    await expect(page.locator('[data-testid="analytics-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="trend-analysis"]')).toBeVisible()
    await expect(page.locator('[data-testid="risk-assessment"]')).toBeVisible()
  })

  test('should enable SMS alerts for premium users', async ({ page }) => {
    await page.goto('/settings/notifications')
    
    // SMS option should be available
    await expect(page.locator('[data-testid="sms-alerts-checkbox"]')).toBeEnabled()
    await expect(page.locator('[data-testid="sms-alerts-label"]')).not.toContainText('Premium required')
  })
})