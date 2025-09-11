import { z } from 'zod'
import { AlertType, SubscriptionStatus } from '@prisma/client'

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  materialityThreshold: z.number().min(0).max(1, 'Threshold must be between 0 and 1').optional(),
  formTypes: z.array(z.enum(['10-K', '10-Q', '8-K', '8-K/A', '10-K/A', '10-Q/A', 'DEF 14A', 'S-1'])).optional(),
})

export const alertSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  materialityThreshold: z.number().min(0).max(1, 'Threshold must be between 0 and 1'),
  formTypes: z.array(z.enum(['10-K', '10-Q', '8-K', '8-K/A', '10-K/A', '10-Q/A', 'DEF 14A', 'S-1'])),
  watchlist: z.array(z.object({
    ticker: z.string().regex(/^[A-Z]{1,5}$/, 'Invalid ticker format'),
    alertTypes: z.array(z.nativeEnum(AlertType)),
  })).optional(),
})

export const userContactSchema = z.object({
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
})

// User response types (what API returns)
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  subscriptionTier: z.string().nullable(),
  subscriptionEndsAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const userSettingsResponseSchema = z.object({
  userId: z.string(),
  settings: z.object({
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    materialityThreshold: z.number(),
    formTypes: z.array(z.string()),
    watchlist: z.array(z.object({
      ticker: z.string(),
      alertTypes: z.array(z.string()),
    })),
  }),
  contacts: z.object({
    email: z.string(),
    phone: z.string().nullable(),
    verified: z.object({
      email: z.boolean(),
      phone: z.boolean(),
    }),
  }),
})

// Type definitions
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type AlertSettingsInput = z.infer<typeof alertSettingsSchema>
export type UserContactInput = z.infer<typeof userContactSchema>
export type UserResponse = z.infer<typeof userResponseSchema>
export type UserSettingsResponse = z.infer<typeof userSettingsResponseSchema>

// User utility functions
export class UserModel {
  static validateEmail(email: string): boolean {
    return createUserSchema.shape.email.safeParse(email).success
  }

  static validatePhone(phone: string): boolean {
    return phone === '' || createUserSchema.shape.phone!.safeParse(phone).success
  }

  static validateTicker(ticker: string): boolean {
    return /^[A-Z]{1,5}$/.test(ticker)
  }

  static validateMaterialityThreshold(threshold: number): boolean {
    return threshold >= 0 && threshold <= 1
  }

  static sanitizeFormTypes(formTypes: string[]): string[] {
    const validFormTypes = ['10-K', '10-Q', '8-K', '8-K/A', '10-K/A', '10-Q/A', 'DEF 14A', 'S-1']
    return formTypes.filter(type => validFormTypes.includes(type))
  }

  static formatPhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '')
    
    // Add + prefix if not present and looks like international
    if (digits.length > 10 && !phone.startsWith('+')) {
      return '+' + digits
    }
    
    return phone
  }

  static isValidSubscriptionStatus(status: string): status is SubscriptionStatus {
    return Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)
  }

  static canReceiveAlerts(user: {
    emailEnabled: boolean
    smsEnabled: boolean
    pushEnabled: boolean
    emailVerified: boolean
    phoneVerified: boolean
  }): boolean {
    return (
      (user.emailEnabled && user.emailVerified) ||
      (user.smsEnabled && user.phoneVerified) ||
      user.pushEnabled
    )
  }

  static getEffectiveAlertMethods(user: {
    emailEnabled: boolean
    smsEnabled: boolean
    pushEnabled: boolean
    emailVerified: boolean
    phoneVerified: boolean
  }): string[] {
    const methods: string[] = []
    
    if (user.emailEnabled && user.emailVerified) {
      methods.push('EMAIL')
    }
    
    if (user.smsEnabled && user.phoneVerified) {
      methods.push('SMS')
    }
    
    if (user.pushEnabled) {
      methods.push('PUSH')
    }
    
    return methods
  }
}

// Error classes
export class UserValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'UserValidationError'
  }
}

export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`)
    this.name = 'UserNotFoundError'
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`User already exists: ${email}`)
    this.name = 'UserAlreadyExistsError'
  }
}