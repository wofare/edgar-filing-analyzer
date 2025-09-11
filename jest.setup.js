import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only-32chars'
process.env.OPENAI_API_KEY = 'sk-test-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_key'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_key'
process.env.SEC_EDGAR_USER_AGENT = 'Test Agent'
process.env.EMAIL_FROM = 'test@example.com'