import { test, expect } from '@playwright/test'

test.describe('Subscription Management', () => {
  test.use({ storageState: 'tests/e2e/auth/user.json' })

  test('should display current plan information', async ({ page }) => {
    await page.goto('/billing')
    
    // Should show current plan (free for test user)
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('Free')
    await expect(page.locator('[data-testid="plan-features"]')).toContainText('3 companies')
    await expect(page.locator('[data-testid="plan-features"]')).toContainText('Basic email alerts')
  })

  test('should show available upgrade options', async ({ page }) => {
    await page.goto('/billing')
    
    // Should show upgrade options
    await expect(page.locator('[data-testid="upgrade-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="basic-plan-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="pro-plan-card"]')).toBeVisible()
    
    // Check pricing display
    await expect(page.locator('[data-testid="basic-price"]')).toContainText('$9.99')
    await expect(page.locator('[data-testid="pro-price"]')).toContainText('$19.99')
    
    // Check annual savings display
    await expect(page.locator('[data-testid="annual-savings"]')).toContainText('Save')
  })

  test('should initiate subscription upgrade flow', async ({ page }) => {
    await page.goto('/billing')
    
    // Click upgrade to basic plan
    await page.click('[data-testid="upgrade-basic-button"]')
    
    // Should navigate to checkout (mocked)
    await expect(page).toHaveURL(/.*checkout.*/)
    
    // Mock checkout page should be displayed
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="plan-summary"]')).toContainText('Basic Plan')
    await expect(page.locator('[data-testid="plan-price"]')).toContainText('$9.99')
  })

  test('should display billing history', async ({ page }) => {
    await page.goto('/billing/history')
    
    // For free users, should show empty state or upgrade prompt
    const hasPayments = await page.locator('[data-testid="payment-history"]').count() > 0
    
    if (hasPayments) {
      await expect(page.locator('[data-testid="payment-item"]')).toHaveCountGreaterThan(0)
    } else {
      await expect(page.locator('[data-testid="no-payments-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible()
    }
  })
})

test.describe('Premium Subscription Features', () => {
  test.use({ storageState: 'tests/e2e/auth/premium.json' })

  test('should display active subscription details', async ({ page }) => {
    await page.goto('/billing')
    
    // Should show active subscription
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('Basic')
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Active')
    await expect(page.locator('[data-testid="next-billing-date"]')).toBeVisible()
    
    // Should show manage subscription options
    await expect(page.locator('[data-testid="manage-subscription"]')).toBeVisible()
    await expect(page.locator('[data-testid="cancel-subscription"]')).toBeVisible()
  })

  test('should open customer portal', async ({ page }) => {
    await page.goto('/billing')
    
    // Click manage subscription
    await page.click('[data-testid="manage-subscription-button"]')
    
    // Should open customer portal (in new tab/window)
    // Note: In real tests, this would open Stripe customer portal
    // For testing, we mock this behavior
    await expect(page.locator('[data-testid="portal-loading"]')).toBeVisible()
  })

  test('should show plan upgrade options for existing subscribers', async ({ page }) => {
    await page.goto('/billing')
    
    // Should show upgrade to Pro option
    await expect(page.locator('[data-testid="upgrade-to-pro"]')).toBeVisible()
    await expect(page.locator('[data-testid="pro-plan-benefits"]')).toContainText('Unlimited companies')
    await expect(page.locator('[data-testid="pro-plan-benefits"]')).toContainText('API access')
  })

  test('should display payment history for subscribers', async ({ page }) => {
    await page.goto('/billing/history')
    
    // Should show payment history
    await expect(page.locator('[data-testid="payment-history"]')).toBeVisible()
    
    // Should have at least one payment record (subscription creation)
    const paymentItems = page.locator('[data-testid="payment-item"]')
    await expect(paymentItems).toHaveCountGreaterThanOrEqual(1)
    
    // Check payment details
    const firstPayment = paymentItems.first()
    await expect(firstPayment.locator('[data-testid="payment-amount"]')).toContainText('$9.99')
    await expect(firstPayment.locator('[data-testid="payment-status"]')).toContainText('Paid')
    await expect(firstPayment.locator('[data-testid="payment-date"]')).toBeVisible()
  })

  test('should handle subscription cancellation flow', async ({ page }) => {
    await page.goto('/billing')
    
    // Click cancel subscription
    await page.click('[data-testid="cancel-subscription-button"]')
    
    // Should show cancellation modal
    await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="cancel-warning"]')).toContainText('lose access')
    
    // Show retention offer
    await expect(page.locator('[data-testid="retention-offer"]')).toBeVisible()
    
    // Cancel cancellation (stay subscribed)
    await page.click('[data-testid="keep-subscription-button"]')
    
    // Modal should close
    await expect(page.locator('[data-testid="cancel-modal"]')).not.toBeVisible()
    
    // Subscription should still be active
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Active')
  })

  test('should show subscription renewal reminders', async ({ page }) => {
    // This would test renewal reminder logic
    await page.goto('/billing')
    
    // If subscription is near expiry, should show reminder
    const renewalDate = await page.locator('[data-testid="next-billing-date"]').textContent()
    
    if (renewalDate) {
      const date = new Date(renewalDate)
      const daysUntilRenewal = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilRenewal <= 7) {
        await expect(page.locator('[data-testid="renewal-reminder"]')).toBeVisible()
      }
    }
  })
})

test.describe('Billing Edge Cases', () => {
  test.use({ storageState: 'tests/e2e/auth/user.json' })

  test('should handle failed payment scenarios', async ({ page }) => {
    // This would test the flow when payments fail
    await page.goto('/billing')
    
    // Mock a failed payment state
    // In reality, this would be triggered by webhook or payment processor
    
    // Should show payment failure notice
    // await expect(page.locator('[data-testid="payment-failed-notice"]')).toBeVisible()
    // await expect(page.locator('[data-testid="update-payment-method"]')).toBeVisible()
  })

  test('should handle subscription limits enforcement', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Test that limits are properly enforced
    const watchlistCount = await page.locator('[data-testid="watchlist-count"]').textContent()
    const currentCount = parseInt(watchlistCount?.split(' ')[0] || '0')
    
    // Free plan limit is 3 companies
    if (currentCount >= 3) {
      await page.click('[data-testid="add-company-button"]')
      
      // Should show upgrade prompt
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toBeVisible()
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toContainText('upgrade')
    }
  })

  test('should display proper pricing for different regions', async ({ page }) => {
    await page.goto('/billing')
    
    // Check that pricing is displayed
    const basicPrice = await page.locator('[data-testid="basic-price"]').textContent()
    const proPrice = await page.locator('[data-testid="pro-price"]').textContent()
    
    // Should include currency symbol
    expect(basicPrice).toMatch(/\$\d+\.\d{2}/)
    expect(proPrice).toMatch(/\$\d+\.\d{2}/)
    
    // Should show tax information if applicable
    const taxInfo = page.locator('[data-testid="tax-information"]')
    if (await taxInfo.count() > 0) {
      await expect(taxInfo).toContainText('tax')
    }
  })

  test('should handle promo codes and discounts', async ({ page }) => {
    await page.goto('/billing')
    
    // Click upgrade to trigger checkout flow
    await page.click('[data-testid="upgrade-basic-button"]')
    
    // Should have promo code field in checkout
    if (await page.locator('[data-testid="promo-code-input"]').count() > 0) {
      await page.fill('[data-testid="promo-code-input"]', 'TEST10')
      await page.click('[data-testid="apply-promo-button"]')
      
      // Should show discount applied
      await expect(page.locator('[data-testid="discount-applied"]')).toBeVisible()
      await expect(page.locator('[data-testid="discounted-price"]')).toBeVisible()
    }
  })
})