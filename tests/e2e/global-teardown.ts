import { FullConfig } from '@playwright/test'
import { prisma } from '@/lib/db'
import fs from 'fs'
import path from 'path'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...')

  try {
    // Clean up test data
    await cleanupTestData()
    console.log('✅ Test data cleaned up')

    // Clean up authentication files
    await cleanupAuthFiles()
    console.log('✅ Authentication files cleaned up')

    // Disconnect from database
    await prisma.$disconnect()
    console.log('✅ Database disconnected')

    console.log('🎉 E2E test environment cleaned up!')
  } catch (error) {
    console.error('❌ Failed to cleanup E2E test environment:', error)
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

  // Clean up test companies and filings
  await prisma.filing.deleteMany({
    where: {
      ticker: {
        startsWith: 'TEST'
      }
    }
  })

  await prisma.company.deleteMany({
    where: {
      symbol: {
        startsWith: 'TEST'
      }
    }
  })

  // Clean up test jobs
  await prisma.job.deleteMany({
    where: {
      parameters: {
        path: ['cik'],
        string_contains: '0000000001'
      }
    }
  })
}

async function cleanupAuthFiles() {
  const authDir = path.join(process.cwd(), 'tests/e2e/auth')
  
  if (fs.existsSync(authDir)) {
    const files = fs.readdirSync(authDir)
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(authDir, file)
        try {
          fs.unlinkSync(filePath)
        } catch (error) {
          console.warn(`Failed to delete auth file ${file}:`, error)
        }
      }
    }
  }
}

export default globalTeardown