import { chromium, FullConfig } from '@playwright/test'
import { prisma } from '@/lib/db'

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up E2E test environment...')

  try {
    // Ensure database is connected
    await prisma.$connect()
    console.log('✅ Database connected')

    // Clean up test data from previous runs
    await cleanupTestData()
    console.log('✅ Test data cleaned up')

    // Create test users and data
    await createTestData()
    console.log('✅ Test data created')

    // Authenticate test users
    await authenticateTestUsers(config)
    console.log('✅ Test users authenticated')

    console.log('🎉 E2E test environment ready!')
  } catch (error) {
    console.error('❌ Failed to setup E2E test environment:', error)
    throw error
  }
}

async function cleanupTestData() {
  // Clean up test data (users with test emails)
  await prisma.alert.deleteMany({
    where: {
      user: {
        email: {
          contains: '@e2etest.com'
        }
      }
    }
  })

  await prisma.watchlist.deleteMany({
    where: {
      user: {
        email: {
          contains: '@e2etest.com'
        }
      }
    }
  })

  await prisma.subscription.deleteMany({
    where: {
      user: {
        email: {
          contains: '@e2etest.com'
        }
      }
    }
  })

  await prisma.userPreference.deleteMany({
    where: {
      user: {
        email: {
          contains: '@e2etest.com'
        }
      }
    }
  })

  await prisma.user.deleteMany({
    where: {
      email: {
        contains: '@e2etest.com'
      }
    }
  })

  // Clean up test companies
  await prisma.company.deleteMany({
    where: {
      symbol: {
        startsWith: 'TEST'
      }
    }
  })
}

async function createTestData() {
  const { authService } = await import('@/lib/auth/service')

  // Create test users
  const testUsers = [
    {
      email: 'testuser@e2etest.com',
      password: 'TestPassword123!',
      name: 'Test User',
      acceptTerms: true,
      acceptMarketing: false
    },
    {
      email: 'premiumuser@e2etest.com',
      password: 'TestPassword123!',
      name: 'Premium User',
      acceptTerms: true,
      acceptMarketing: true
    },
    {
      email: 'adminuser@e2etest.com',
      password: 'AdminPassword123!',
      name: 'Admin User',
      acceptTerms: true,
      acceptMarketing: false
    }
  ]

  for (const userData of testUsers) {
    const result = await authService.registerUser(userData)
    if (!result.success) {
      console.warn(`Failed to create test user ${userData.email}:`, result.error)
      continue
    }

    // Verify email automatically for test users
    const user = await prisma.user.findUnique({
      where: { email: userData.email }
    })

    if (user?.emailVerificationToken) {
      await authService.verifyEmail(user.emailVerificationToken)
    }

    // Set admin role for admin user
    if (userData.email === 'adminuser@e2etest.com') {
      await prisma.user.update({
        where: { email: userData.email },
        data: { role: 'ADMIN' }
      })
    }

    // Create premium subscription for premium user
    if (userData.email === 'premiumuser@e2etest.com' && user) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: 'basic',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false
        }
      })
    }
  }

  // Create test companies
  const testCompanies = [
    {
      cik: '0000000001',
      symbol: 'TESTCO',
      name: 'Test Company Inc.',
      sic: '1234',
      industry: 'Technology',
      isActive: true
    },
    {
      cik: '0000000002',
      symbol: 'DEMO',
      name: 'Demo Corporation',
      sic: '5678',
      industry: 'Healthcare',
      isActive: true
    }
  ]

  for (const companyData of testCompanies) {
    await prisma.company.upsert({
      where: { cik: companyData.cik },
      create: companyData,
      update: companyData
    })
  }

  // Create test filings
  const testFilings = [
    {
      cik: '0000000001',
      accessionNo: '0000000001-23-000001',
      companyId: '', // Will be set after finding company
      ticker: 'TESTCO',
      companyName: 'Test Company Inc.',
      formType: '10-K',
      filedDate: new Date(),
      reportDate: new Date(),
      url: 'https://example.com/filing1',
      content: 'Test filing content with material changes in risk factors...',
      summary: 'Annual report with significant updates to business strategy.',
      keyHighlights: ['New product launch', 'Revenue growth', 'Market expansion'],
      investorImplications: ['Positive outlook', 'Increased competition risk'],
      isProcessed: true
    }
  ]

  for (const filingData of testFilings) {
    const company = await prisma.company.findUnique({
      where: { cik: filingData.cik }
    })

    if (company) {
      await prisma.filing.create({
        data: {
          ...filingData,
          companyId: company.id
        }
      })
    }
  }
}

async function authenticateTestUsers(config: FullConfig) {
  const browser = await chromium.launch()
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // Create authentication states for test users
  const users = [
    { email: 'testuser@e2etest.com', password: 'TestPassword123!', storageState: 'tests/e2e/auth/user.json' },
    { email: 'premiumuser@e2etest.com', password: 'TestPassword123!', storageState: 'tests/e2e/auth/premium.json' },
    { email: 'adminuser@e2etest.com', password: 'AdminPassword123!', storageState: 'tests/e2e/auth/admin.json' }
  ]

  for (const user of users) {
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      // Navigate to login page
      await page.goto(`${baseURL}/auth/signin`)

      // Fill login form
      await page.fill('[data-testid="email-input"]', user.email)
      await page.fill('[data-testid="password-input"]', user.password)
      await page.click('[data-testid="signin-button"]')

      // Wait for successful login (redirect to dashboard)
      await page.waitForURL('**/dashboard', { timeout: 10000 })

      // Save authentication state
      await context.storageState({ path: user.storageState })
      console.log(`✅ Authenticated ${user.email}`)
    } catch (error) {
      console.warn(`⚠️  Failed to authenticate ${user.email}:`, error)
    } finally {
      await context.close()
    }
  }

  await browser.close()
}

export default globalSetup