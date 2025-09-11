import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should register new user successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/auth/signup')
    
    // Check page loaded
    await expect(page).toHaveTitle(/Sign Up.*WhatChanged/i)
    
    // Fill registration form
    const timestamp = Date.now()
    const testEmail = `newuser${timestamp}@e2etest.com`
    
    await page.fill('[data-testid="name-input"]', 'New Test User')
    await page.fill('[data-testid="email-input"]', testEmail)
    await page.fill('[data-testid="password-input"]', 'NewPassword123!')
    await page.fill('[data-testid="confirm-password-input"]', 'NewPassword123!')
    await page.check('[data-testid="terms-checkbox"]')
    
    // Submit form
    await page.click('[data-testid="signup-button"]')
    
    // Should redirect to verification page
    await expect(page).toHaveURL(/.*verify-email/)
    await expect(page.locator('[data-testid="verification-message"]')).toContainText('check your email')
  })

  test('should prevent registration with existing email', async ({ page }) => {
    await page.goto('/auth/signup')
    
    // Try to register with existing email
    await page.fill('[data-testid="name-input"]', 'Duplicate User')
    await page.fill('[data-testid="email-input"]', 'testuser@e2etest.com')
    await page.fill('[data-testid="password-input"]', 'Password123!')
    await page.fill('[data-testid="confirm-password-input"]', 'Password123!')
    await page.check('[data-testid="terms-checkbox"]')
    
    await page.click('[data-testid="signup-button"]')
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('already exists')
  })

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', 'testuser@e2etest.com')
    await page.fill('[data-testid="password-input"]', 'TestPassword123!')
    
    // Submit form
    await page.click('[data-testid="signin-button"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    
    // Check user name is displayed
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Test User')
  })

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Fill with invalid credentials
    await page.fill('[data-testid="email-input"]', 'testuser@e2etest.com')
    await page.fill('[data-testid="password-input"]', 'WrongPassword123!')
    
    await page.click('[data-testid="signin-button"]')
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials')
  })

  test('should handle password reset flow', async ({ page }) => {
    await page.goto('/auth/signin')
    
    // Click forgot password link
    await page.click('[data-testid="forgot-password-link"]')
    
    // Should navigate to reset page
    await expect(page).toHaveURL(/.*forgot-password/)
    
    // Fill email
    await page.fill('[data-testid="email-input"]', 'testuser@e2etest.com')
    await page.click('[data-testid="reset-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('reset link sent')
  })

  test('should logout user successfully', async ({ page }) => {
    // Login first
    await page.goto('/auth/signin')
    await page.fill('[data-testid="email-input"]', 'testuser@e2etest.com')
    await page.fill('[data-testid="password-input"]', 'TestPassword123!')
    await page.click('[data-testid="signin-button"]')
    
    await expect(page).toHaveURL(/.*dashboard/)
    
    // Open user menu and logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')
    
    // Should redirect to home page
    await expect(page).toHaveURL('/')
    
    // User menu should not be visible
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
  })
})

test.describe('Profile Management', () => {
  test.use({ storageState: 'tests/e2e/auth/user.json' })

  test('should update user profile', async ({ page }) => {
    await page.goto('/settings/profile')
    
    // Update profile information
    await page.fill('[data-testid="name-input"]', 'Updated Test User')
    await page.fill('[data-testid="phone-input"]', '+15551234567')
    
    await page.click('[data-testid="save-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Profile updated')
    
    // Verify changes persisted
    await page.reload()
    await expect(page.locator('[data-testid="name-input"]')).toHaveValue('Updated Test User')
    await expect(page.locator('[data-testid="phone-input"]')).toHaveValue('+15551234567')
  })

  test('should change password', async ({ page }) => {
    await page.goto('/settings/security')
    
    // Fill password change form
    await page.fill('[data-testid="current-password-input"]', 'TestPassword123!')
    await page.fill('[data-testid="new-password-input"]', 'NewTestPassword123!')
    await page.fill('[data-testid="confirm-password-input"]', 'NewTestPassword123!')
    
    await page.click('[data-testid="change-password-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Password changed')
  })

  test('should update notification preferences', async ({ page }) => {
    await page.goto('/settings/notifications')
    
    // Toggle preferences
    await page.check('[data-testid="email-alerts-checkbox"]')
    await page.check('[data-testid="sms-alerts-checkbox"]')
    await page.uncheck('[data-testid="marketing-emails-checkbox"]')
    
    // Update alert threshold
    await page.fill('[data-testid="alert-threshold-input"]', '0.8')
    
    await page.click('[data-testid="save-preferences-button"]')
    
    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Preferences updated')
    
    // Verify changes persisted
    await page.reload()
    await expect(page.locator('[data-testid="email-alerts-checkbox"]')).toBeChecked()
    await expect(page.locator('[data-testid="sms-alerts-checkbox"]')).toBeChecked()
    await expect(page.locator('[data-testid="marketing-emails-checkbox"]')).not.toBeChecked()
    await expect(page.locator('[data-testid="alert-threshold-input"]')).toHaveValue('0.8')
  })
})