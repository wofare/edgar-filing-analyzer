import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'crypto'
import { emailService } from '@/lib/email/service'
import { smsService } from '@/lib/sms/service'

export interface UserRegistrationData {
  email: string
  password: string
  name: string
  phone?: string
  acceptTerms: boolean
  acceptMarketing?: boolean
}

export interface PasswordResetRequest {
  email: string
  token: string
}

export interface PhoneVerification {
  phone: string
  code: string
}

export class AuthService {
  // Hash password using bcrypt
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  // Verify password against hash
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword)
  }

  // Generate verification token
  generateVerificationToken(): string {
    return randomBytes(32).toString('hex')
  }

  // Generate verification code (6 digits)
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  // Register new user
  async registerUser(userData: UserRegistrationData): Promise<{
    success: boolean
    userId?: string
    error?: string
  }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      })

      if (existingUser) {
        return {
          success: false,
          error: 'An account with this email already exists'
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password)

      // Generate verification token
      const emailVerificationToken = this.generateVerificationToken()

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          phone: userData.phone,
          acceptTerms: userData.acceptTerms,
          acceptMarketing: userData.acceptMarketing || false,
          emailVerificationToken,
          role: 'USER',
          isActive: true
        }
      })

      // Create initial preferences
      await prisma.userPreference.create({
        data: {
          userId: user.id,
          emailAlerts: true,
          smsAlerts: !!userData.phone,
          dailySummary: true,
          marketingEmails: userData.acceptMarketing || false,
          timezone: 'UTC',
          alertThreshold: 0.7
        }
      })

      // Send verification email
      await emailService.sendVerificationEmail(user.email, {
        name: user.name,
        verificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${emailVerificationToken}`
      })

      console.log(`User registered: ${user.email}`)

      return {
        success: true,
        userId: user.id
      }
    } catch (error) {
      console.error('User registration failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  // Verify email address
  async verifyEmail(token: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findFirst({
        where: { emailVerificationToken: token }
      })

      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        }
      }

      // Update user as verified
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          emailVerificationToken: null
        }
      })

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, {
        name: user.name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`
      })

      console.log(`Email verified: ${user.email}`)

      return { success: true }
    } catch (error) {
      console.error('Email verification failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      }
    }
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      })

      if (!user) {
        // Don't reveal if user exists - security best practice
        return { success: true }
      }

      // Generate reset token and expiry
      const resetToken = this.generateVerificationToken()
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Update user with reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetTokenExpiry
        }
      })

      // Send password reset email
      await emailService.sendPasswordResetEmail(user.email, {
        name: user.name,
        resetUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${resetToken}`
      })

      console.log(`Password reset requested: ${email}`)

      return { success: true }
    } catch (error) {
      console.error('Password reset request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      }
    }
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpiry: { gt: new Date() }
        }
      })

      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        }
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword)

      // Update user password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null
        }
      })

      // Send password changed confirmation
      await emailService.sendPasswordChangedEmail(user.email, {
        name: user.name
      })

      console.log(`Password reset: ${user.email}`)

      return { success: true }
    } catch (error) {
      console.error('Password reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed'
      }
    }
  }

  // Request phone verification
  async requestPhoneVerification(userId: string, phone: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Validate phone number first
      const validation = await smsService.validatePhoneNumber(phone)
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Invalid phone number format'
        }
      }

      // Generate verification code
      const verificationCode = this.generateVerificationCode()
      const codeExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      // Update user with verification code
      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: validation.formatted,
          phoneVerificationCode: verificationCode,
          phoneVerificationExpiry: codeExpiry
        }
      })

      // Send SMS verification code
      await smsService.sendVerificationCode(validation.formatted!, verificationCode)

      console.log(`Phone verification requested: ${userId}`)

      return { success: true }
    } catch (error) {
      console.error('Phone verification request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification request failed'
      }
    }
  }

  // Verify phone with code
  async verifyPhone(userId: string, code: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Check if code matches and hasn't expired
      if (
        user.phoneVerificationCode !== code ||
        !user.phoneVerificationExpiry ||
        user.phoneVerificationExpiry < new Date()
      ) {
        return {
          success: false,
          error: 'Invalid or expired verification code'
        }
      }

      // Update user as phone verified
      await prisma.user.update({
        where: { id: userId },
        data: {
          phoneVerified: new Date(),
          phoneVerificationCode: null,
          phoneVerificationExpiry: null
        }
      })

      console.log(`Phone verified: ${userId}`)

      return { success: true }
    } catch (error) {
      console.error('Phone verification failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Phone verification failed'
      }
    }
  }

  // Change password (authenticated user)
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user || !user.password) {
        return {
          success: false,
          error: 'User not found or no password set'
        }
      }

      // Verify current password
      const isCurrentValid = await this.verifyPassword(currentPassword, user.password)
      if (!isCurrentValid) {
        return {
          success: false,
          error: 'Current password is incorrect'
        }
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword)

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      })

      // Send confirmation email
      await emailService.sendPasswordChangedEmail(user.email, {
        name: user.name
      })

      console.log(`Password changed: ${user.email}`)

      return { success: true }
    } catch (error) {
      console.error('Password change failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password change failed'
      }
    }
  }

  // Update user profile
  async updateProfile(userId: string, data: {
    name?: string
    email?: string
    phone?: string
  }): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Check if email is changing and if new email exists
      if (data.email && data.email !== user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: data.email }
        })

        if (existingUser) {
          return {
            success: false,
            error: 'Email address is already in use'
          }
        }

        // If changing email, reset verification
        data.email = data.email.toLowerCase()
      }

      // Validate phone if provided
      let formattedPhone = data.phone
      if (data.phone) {
        const validation = await smsService.validatePhoneNumber(data.phone)
        if (!validation.isValid) {
          return {
            success: false,
            error: 'Invalid phone number format'
          }
        }
        formattedPhone = validation.formatted
      }

      // Update user profile
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.email && { 
            email: data.email,
            emailVerified: null,
            emailVerificationToken: this.generateVerificationToken()
          }),
          ...(formattedPhone && { 
            phone: formattedPhone,
            phoneVerified: null
          })
        }
      })

      // Send verification email if email changed
      if (data.email) {
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId }
        })

        if (updatedUser?.emailVerificationToken) {
          await emailService.sendVerificationEmail(data.email, {
            name: updatedUser.name,
            verificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/verify-email?token=${updatedUser.emailVerificationToken}`
          })
        }
      }

      console.log(`Profile updated: ${userId}`)

      return { success: true }
    } catch (error) {
      console.error('Profile update failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed'
      }
    }
  }

  // Delete user account
  async deleteAccount(userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Cancel Stripe subscription if exists
      if (user.subscription?.stripeSubscriptionId) {
        const { stripeService } = await import('@/lib/stripe/service')
        await stripeService.cancelSubscription(userId)
      }

      // Soft delete - mark as deleted but keep data for compliance
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          email: `deleted_${Date.now()}_${user.email}`,
          name: 'Deleted User',
          phone: null
        }
      })

      console.log(`Account deleted: ${userId}`)

      return { success: true }
    } catch (error) {
      console.error('Account deletion failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account deletion failed'
      }
    }
  }

  // Get user profile with subscription info
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true,
          preferences: true,
          watchlists: {
            include: {
              company: {
                select: {
                  symbol: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              watchlists: true,
              alerts: true
            }
          }
        }
      })

      if (!user) {
        return null
      }

      // Don't return sensitive data
      const { password, emailVerificationToken, passwordResetToken, phoneVerificationCode, ...safeUser } = user

      return safeUser
    } catch (error) {
      console.error('Failed to get user profile:', error)
      return null
    }
  }

  // Check user permissions/limits based on subscription
  async checkUserLimits(userId: string): Promise<{
    watchlistLimit: number
    alertLimit: number
    canUseSMS: boolean
    canUseAPI: boolean
    currentWatchlistCount: number
    currentAlertCount: number
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true,
          _count: {
            select: {
              watchlists: true,
              alerts: true
            }
          }
        }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Default to free plan limits
      let limits = {
        watchlistLimit: 3,
        alertLimit: 50,
        canUseSMS: false,
        canUseAPI: false
      }

      // Apply subscription-based limits
      if (user.subscription && user.subscription.status === 'active') {
        const { stripeService } = await import('@/lib/stripe/service')
        const plan = stripeService.getPlan(user.subscription.planId)
        
        if (plan) {
          limits = {
            watchlistLimit: plan.watchlistLimit === -1 ? 999999 : plan.watchlistLimit,
            alertLimit: plan.alertLimit === -1 ? 999999 : plan.alertLimit,
            canUseSMS: plan.id !== 'free',
            canUseAPI: plan.id === 'pro' || plan.id === 'pro-annual'
          }
        }
      }

      return {
        ...limits,
        currentWatchlistCount: user._count.watchlists,
        currentAlertCount: user._count.alerts
      }
    } catch (error) {
      console.error('Failed to check user limits:', error)
      throw error
    }
  }
}

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const authService = new AuthService()
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { subscription: true }
        })

        if (!user || !user.password || !user.isActive) {
          return null
        }

        const isValidPassword = await authService.verifyPassword(
          credentials.password,
          user.password
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          subscription: user.subscription
        }
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          role: 'USER'
        }
      }
    })
  ],
  
  session: {
    strategy: 'jwt'
  },
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role
        token.emailVerified = user.emailVerified
        token.phoneVerified = user.phoneVerified
        token.subscription = user.subscription
      }

      // Refresh user data on each request
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { subscription: true }
        })

        if (dbUser) {
          token.role = dbUser.role
          token.emailVerified = dbUser.emailVerified
          token.phoneVerified = dbUser.phoneVerified
          token.subscription = dbUser.subscription
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.emailVerified = token.emailVerified
        session.user.phoneVerified = token.phoneVerified
        session.user.subscription = token.subscription
      }
      return session
    }
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
}

// Global auth service instance
export const authService = new AuthService()

export default authService