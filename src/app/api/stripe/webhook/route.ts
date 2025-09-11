import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('Missing Stripe signature')
      return NextResponse.json(
        { error: 'Missing Stripe signature', code: 'MISSING_SIGNATURE' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
        { status: 400 }
      )
    }

    console.log(`Processing Stripe event: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer)
        break

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer)
        break

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', code: 'WEBHOOK_ERROR' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // Determine plan type from price ID
    const priceId = subscription.items.data[0]?.price?.id
    const planType = getPlanTypeFromPriceId(priceId)

    await prisma.subscription.create({
      data: {
        id: subscription.id,
        userId,
        customerId,
        priceId: priceId || '',
        status: subscription.status,
        planType,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata
      }
    })

    // Update user plan
    await prisma.user.update({
      where: { id: userId },
      data: {
        planType,
        stripeCustomerId: customerId,
        subscriptionStatus: subscription.status
      }
    })

    console.log(`Subscription created: ${subscription.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling subscription created:', error)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    const priceId = subscription.items.data[0]?.price?.id
    const planType = getPlanTypeFromPriceId(priceId)

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: subscription.status,
        planType,
        priceId: priceId || '',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
        updatedAt: new Date()
      }
    })

    // Update user plan
    await prisma.user.update({
      where: { id: userId },
      data: {
        planType,
        subscriptionStatus: subscription.status
      }
    })

    console.log(`Subscription updated: ${subscription.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling subscription updated:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Downgrade user to free plan
    await prisma.user.update({
      where: { id: userId },
      data: {
        planType: 'FREE',
        subscriptionStatus: 'canceled'
      }
    })

    console.log(`Subscription deleted: ${subscription.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling subscription deleted:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // Log the payment
    await prisma.payment.create({
      data: {
        id: invoice.payment_intent as string || `invoice_${invoice.id}`,
        userId,
        subscriptionId: invoice.subscription as string || null,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        invoiceId: invoice.id,
        metadata: {
          invoiceNumber: invoice.number,
          description: invoice.description
        }
      }
    })

    console.log(`Payment succeeded: ${invoice.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling payment succeeded:', error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // Log the failed payment
    await prisma.payment.create({
      data: {
        id: invoice.payment_intent as string || `invoice_${invoice.id}_failed`,
        userId,
        subscriptionId: invoice.subscription as string || null,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        invoiceId: invoice.id,
        metadata: {
          invoiceNumber: invoice.number,
          description: invoice.description,
          failure_reason: 'Payment failed'
        }
      }
    })

    // TODO: Send payment failure notification
    console.log(`Payment failed: ${invoice.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling payment failed:', error)
  }
}

async function handleCustomerCreated(customer: Stripe.Customer) {
  try {
    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customer.id
      }
    })

    console.log(`Customer created: ${customer.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling customer created:', error)
  }
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  try {
    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // Update user email if it changed
    if (customer.email) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: customer.email
        }
      })
    }

    console.log(`Customer updated: ${customer.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling customer updated:', error)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const customerId = session.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // If this was a subscription checkout, the subscription will be handled 
    // by the subscription.created webhook
    if (session.mode === 'subscription') {
      console.log(`Subscription checkout completed for user ${userId}`)
      return
    }

    // Handle one-time payment if needed
    console.log(`One-time payment checkout completed: ${session.id} for user ${userId}`)

  } catch (error) {
    console.error('Error handling checkout completed:', error)
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // TODO: Send trial ending notification
    console.log(`Trial will end soon for user ${userId}, subscription ${subscription.id}`)

  } catch (error) {
    console.error('Error handling trial will end:', error)
  }
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  try {
    const customerId = setupIntent.customer as string
    if (!customerId) {
      console.error('No customer ID in setup intent')
      return
    }

    const customer = await stripe.customers.retrieve(customerId)
    
    if (customer.deleted) {
      console.error('Customer was deleted')
      return
    }

    const userId = customer.metadata?.userId
    if (!userId) {
      console.error('No userId in customer metadata')
      return
    }

    // Payment method setup succeeded - user can now subscribe
    console.log(`Setup intent succeeded for user ${userId}`)

  } catch (error) {
    console.error('Error handling setup intent succeeded:', error)
  }
}

function getPlanTypeFromPriceId(priceId: string | undefined): 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' {
  if (!priceId) return 'FREE'

  // Map your actual Stripe price IDs to plan types
  const priceToPlan: Record<string, 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'> = {
    'price_starter_monthly': 'STARTER',
    'price_starter_yearly': 'STARTER',
    'price_pro_monthly': 'PRO',
    'price_pro_yearly': 'PRO',
    'price_enterprise_monthly': 'ENTERPRISE',
    'price_enterprise_yearly': 'ENTERPRISE'
  }

  return priceToPlan[priceId] || 'FREE'
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    },
  })
}