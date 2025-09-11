import Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { emailService } from '@/lib/email/service'

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  watchlistLimit: number
  alertLimit: number
  stripePriceId: string
}

export interface CustomerPortalOptions {
  returnUrl: string
  locale?: string
}

export class StripeService {
  private stripe: Stripe
  private plans: Map<string, SubscriptionPlan> = new Map()
  private webhookSecret: string

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured')
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20'
    })

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
    if (!this.webhookSecret) {
      console.warn('Stripe webhook secret not configured')
    }

    this.loadSubscriptionPlans()
  }

  // Load subscription plans configuration
  private loadSubscriptionPlans() {
    // Free Plan (not in Stripe)
    this.plans.set('free', {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        '3 companies in watchlist',
        'Basic email alerts',
        'Daily summaries'
      ],
      watchlistLimit: 3,
      alertLimit: 50,
      stripePriceId: ''
    })

    // Basic Plan
    this.plans.set('basic', {
      id: 'basic',
      name: 'Basic',
      price: 999, // $9.99 in cents
      interval: 'month',
      features: [
        '25 companies in watchlist',
        'Email + SMS alerts',
        'Real-time notifications',
        'Custom alert rules',
        'Priority support'
      ],
      watchlistLimit: 25,
      alertLimit: 500,
      stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || ''
    })

    // Pro Plan
    this.plans.set('pro', {
      id: 'pro',
      name: 'Pro',
      price: 1999, // $19.99 in cents
      interval: 'month',
      features: [
        'Unlimited companies',
        'Advanced analytics',
        'API access',
        'Webhook integrations',
        'Custom dashboards',
        'Priority support'
      ],
      watchlistLimit: -1, // Unlimited
      alertLimit: -1,
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || ''
    })

    // Annual Basic Plan
    this.plans.set('basic-annual', {
      id: 'basic-annual',
      name: 'Basic Annual',
      price: 9990, // $99.90 in cents (2 months free)
      interval: 'year',
      features: [
        '25 companies in watchlist',
        'Email + SMS alerts',
        'Real-time notifications',
        'Custom alert rules',
        'Priority support',
        '2 months FREE!'
      ],
      watchlistLimit: 25,
      alertLimit: 6000,
      stripePriceId: process.env.STRIPE_BASIC_ANNUAL_PRICE_ID || ''
    })

    // Annual Pro Plan
    this.plans.set('pro-annual', {
      id: 'pro-annual',
      name: 'Pro Annual',
      price: 19990, // $199.90 in cents (2 months free)
      interval: 'year',
      features: [
        'Unlimited companies',
        'Advanced analytics',
        'API access',
        'Webhook integrations',
        'Custom dashboards',
        'Priority support',
        '2 months FREE!'
      ],
      watchlistLimit: -1,
      alertLimit: -1,
      stripePriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || ''
    })
  }

  // Get all available subscription plans
  getSubscriptionPlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values())
  }

  // Get specific plan by ID
  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.get(planId)
  }

  // Create Stripe customer
  async createCustomer(params: {
    userId: string
    email: string
    name?: string
    phone?: string
  }): Promise<{
    success: boolean
    customerId?: string
    error?: string
  }> {
    try {
      const customer = await this.stripe.customers.create({
        email: params.email,
        name: params.name,
        phone: params.phone,
        metadata: {
          userId: params.userId
        }
      })

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: params.userId },
        data: { stripeCustomerId: customer.id }
      })

      console.log(`Stripe customer created: ${customer.id}`)

      return {
        success: true,
        customerId: customer.id
      }
    } catch (error) {
      console.error('Failed to create Stripe customer:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Create subscription checkout session
  async createCheckoutSession(params: {
    userId: string
    planId: string
    successUrl: string
    cancelUrl: string
    trialDays?: number
  }): Promise<{
    success: boolean
    sessionId?: string
    checkoutUrl?: string
    error?: string
  }> {
    try {
      const plan = this.plans.get(params.planId)
      if (!plan || plan.id === 'free') {
        throw new Error('Invalid subscription plan')
      }

      // Get or create Stripe customer
      let user = await prisma.user.findUnique({
        where: { id: params.userId }
      })

      if (!user) {
        throw new Error('User not found')
      }

      let customerId = user.stripeCustomerId
      if (!customerId) {
        const customerResult = await this.createCustomer({
          userId: params.userId,
          email: user.email,
          name: user.name
        })

        if (!customerResult.success) {
          throw new Error('Failed to create customer')
        }
        customerId = customerResult.customerId!
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: plan.stripePriceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: params.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: params.cancelUrl,
        metadata: {
          userId: params.userId,
          planId: params.planId
        },
        subscription_data: {
          metadata: {
            userId: params.userId,
            planId: params.planId
          },
          ...(params.trialDays && {
            trial_period_days: params.trialDays
          })
        },
        allow_promotion_codes: true
      })

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Create customer portal session
  async createPortalSession(params: {
    userId: string
    returnUrl: string
  }): Promise<{
    success: boolean
    portalUrl?: string
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.userId }
      })

      if (!user || !user.stripeCustomerId) {
        throw new Error('No Stripe customer found')
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: params.returnUrl
      })

      return {
        success: true,
        portalUrl: session.url
      }
    } catch (error) {
      console.error('Failed to create portal session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Get customer's current subscription
  async getCustomerSubscription(userId: string): Promise<{
    success: boolean
    subscription?: any
    plan?: SubscriptionPlan
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Return free plan if no subscription
      if (!user.subscription) {
        return {
          success: true,
          subscription: null,
          plan: this.plans.get('free')
        }
      }

      const subscription = user.subscription
      const plan = this.plans.get(subscription.planId)

      return {
        success: true,
        subscription,
        plan
      }
    } catch (error) {
      console.error('Failed to get customer subscription:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Cancel subscription
  async cancelSubscription(userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true }
      })

      if (!user || !user.subscription || !user.subscription.stripeSubscriptionId) {
        throw new Error('No active subscription found')
      }

      // Cancel at period end
      await this.stripe.subscriptions.update(
        user.subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true
        }
      )

      // Update subscription status in database
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          status: 'cancel_at_period_end'
        }
      })

      console.log(`Subscription cancelled: ${user.subscription.stripeSubscriptionId}`)

      return { success: true }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Process Stripe webhook
  async processWebhook(rawBody: string, signature: string): Promise<{
    success: boolean
    event?: Stripe.Event
    error?: string
  }> {
    try {
      if (!this.webhookSecret) {
        throw new Error('Webhook secret not configured')
      }

      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      )

      console.log(`Processing Stripe webhook: ${event.type}`)

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
          break

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription)
          break

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
          break

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
          break

        default:
          console.log(`Unhandled webhook event type: ${event.type}`)
      }

      return {
        success: true,
        event
      }
    } catch (error) {
      console.error('Webhook processing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Handle checkout session completed
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    try {
      const userId = session.metadata?.userId
      const planId = session.metadata?.planId

      if (!userId || !planId) {
        console.error('Missing metadata in checkout session')
        return
      }

      const plan = this.plans.get(planId)
      if (!plan) {
        console.error('Invalid plan ID in checkout session')
        return
      }

      console.log(`Checkout completed for user ${userId}, plan ${planId}`)

      // Send welcome email
      await emailService.sendWelcomeEmail(userId, plan)

    } catch (error) {
      console.error('Failed to handle checkout completed:', error)
    }
  }

  // Handle subscription change (created/updated)
  private async handleSubscriptionChange(subscription: Stripe.Subscription) {
    try {
      const userId = subscription.metadata?.userId
      const planId = subscription.metadata?.planId

      if (!userId || !planId) {
        console.error('Missing metadata in subscription')
        return
      }

      const plan = this.plans.get(planId)
      if (!plan) {
        console.error('Invalid plan ID in subscription')
        return
      }

      // Create or update subscription in database
      await prisma.subscription.upsert({
        where: {
          userId: userId
        },
        create: {
          userId: userId,
          planId: planId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        },
        update: {
          planId: planId,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      })

      console.log(`Subscription updated: ${subscription.id} (${subscription.status})`)

    } catch (error) {
      console.error('Failed to handle subscription change:', error)
    }
  }

  // Handle subscription deleted
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    try {
      const userId = subscription.metadata?.userId

      if (!userId) {
        console.error('Missing userId in subscription metadata')
        return
      }

      // Update subscription status to cancelled
      await prisma.subscription.updateMany({
        where: {
          userId: userId,
          stripeSubscriptionId: subscription.id
        },
        data: {
          status: 'canceled',
          cancelledAt: new Date()
        }
      })

      console.log(`Subscription deleted: ${subscription.id}`)

    } catch (error) {
      console.error('Failed to handle subscription deleted:', error)
    }
  }

  // Handle successful payment
  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    try {
      const subscriptionId = invoice.subscription as string
      const customerId = invoice.customer as string

      // Log payment
      await prisma.payment.create({
        data: {
          stripePaymentIntentId: invoice.payment_intent as string,
          stripeCustomerId: customerId,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          description: invoice.description || 'Subscription payment'
        }
      })

      console.log(`Payment succeeded: ${invoice.id} ($${invoice.amount_paid / 100})`)

    } catch (error) {
      console.error('Failed to handle payment succeeded:', error)
    }
  }

  // Handle failed payment
  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    try {
      const subscriptionId = invoice.subscription as string
      
      // Get subscription from database
      const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { user: true }
      })

      if (subscription) {
        // Send payment failed email
        await emailService.sendPaymentFailedEmail(
          subscription.user.email,
          {
            amount: invoice.amount_due / 100,
            currency: invoice.currency.toUpperCase(),
            invoiceUrl: invoice.hosted_invoice_url || ''
          }
        )

        console.log(`Payment failed notification sent: ${invoice.id}`)
      }

    } catch (error) {
      console.error('Failed to handle payment failed:', error)
    }
  }

  // Get usage statistics
  async getUsageStats(): Promise<{
    totalCustomers: number
    activeSubscriptions: number
    monthlyRevenue: number
    subscriptionsByPlan: Record<string, number>
  }> {
    try {
      const [customers, subscriptions] = await Promise.all([
        prisma.user.count({ where: { stripeCustomerId: { not: null } } }),
        prisma.subscription.findMany({
          where: { status: { in: ['active', 'trialing'] } }
        })
      ])

      const subscriptionsByPlan = subscriptions.reduce((acc, sub) => {
        acc[sub.planId] = (acc[sub.planId] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Calculate monthly revenue
      let monthlyRevenue = 0
      for (const sub of subscriptions) {
        const plan = this.plans.get(sub.planId)
        if (plan) {
          const monthlyPrice = plan.interval === 'year' ? plan.price / 12 : plan.price
          monthlyRevenue += monthlyPrice
        }
      }

      return {
        totalCustomers: customers,
        activeSubscriptions: subscriptions.length,
        monthlyRevenue: Math.round(monthlyRevenue),
        subscriptionsByPlan
      }
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      throw error
    }
  }
}

// Global Stripe service instance
export const stripeService = new StripeService()

export default stripeService