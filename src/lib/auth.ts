import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { UserModel } from "@/models/user"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    error: "/auth/error",
  },
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        }
      },
    }),

    // Magic Link Email
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        // In a real app, you'd use a proper email service like SendGrid
        // For now, just log the verification URL
        console.log(`Magic link for ${identifier}: ${url}`)
      },
    }),

    // Email/Password Credentials
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { 
          label: "Email", 
          type: "email",
          placeholder: "your-email@example.com"
        },
        password: { 
          label: "Password", 
          type: "password",
          placeholder: "Enter your password"
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email as string,
            },
          })

          if (!user || !user.password) {
            throw new Error("Invalid credentials")
          }

          // Verify password
          const isPasswordValid = await compare(
            credentials.password as string,
            user.password
          )

          if (!isPasswordValid) {
            throw new Error("Invalid credentials")
          }

          // Return user object (without password)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            planType: user.planType,
            subscriptionStatus: user.subscriptionStatus,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // For OAuth providers, create or update user
        if (account?.provider === "google") {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          })

          if (!existingUser) {
            // Create new user with default settings
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "",
                image: user.image,
                planType: "FREE",
                subscriptionStatus: "inactive",
                emailVerified: new Date(),
                // Create default alert settings
                alertSettings: {
                  create: [
                    {
                      alertType: "MATERIAL_CHANGE",
                      method: "EMAIL",
                      isEnabled: true,
                      frequency: "IMMEDIATE",
                      threshold: 0.7,
                    },
                  ],
                },
              },
            })
          }
        }

        return true
      } catch (error) {
        console.error("Sign in callback error:", error)
        return false
      }
    },

    async jwt({ token, user, account }) {
      // Persist user info to token
      if (user) {
        token.id = user.id
        token.planType = user.planType
        token.subscriptionStatus = user.subscriptionStatus
      }

      // Refresh user data from database on each request
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            planType: true,
            subscriptionStatus: true,
          },
        })

        if (dbUser) {
          token.id = dbUser.id
          token.name = dbUser.name
          token.planType = dbUser.planType
          token.subscriptionStatus = dbUser.subscriptionStatus
        }
      }

      return token
    },

    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.id as string
        session.user.planType = token.planType as any
        session.user.subscriptionStatus = token.subscriptionStatus as any
      }

      return session
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser) {
        console.log(`New user signed up: ${user.email}`)
        
        // Track new user signup (could send to analytics)
        // await analytics.track('user_signup', {
        //   userId: user.id,
        //   email: user.email,
        //   provider: account?.provider,
        // })
      }
    },

    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)
    },
  },

  // Security options
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  debug: process.env.NODE_ENV === "development",
})

// Helper functions for server-side auth checks
export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Authentication required")
  }
  return user
}

// Plan-based access control
export function hasAccess(user: any, feature: string): boolean {
  const { planType } = user

  const planFeatures = {
    FREE: ["basic_alerts", "5_watchlist_items"],
    STARTER: ["basic_alerts", "advanced_alerts", "50_watchlist_items"],
    PRO: ["basic_alerts", "advanced_alerts", "unlimited_watchlist", "api_access"],
    ENTERPRISE: ["all_features", "priority_support", "custom_integrations"],
  }

  return planFeatures[planType as keyof typeof planFeatures]?.includes(feature) ?? false
}

// Middleware helper for API route protection
export function withAuth(handler: any) {
  return async (req: any, res: any) => {
    try {
      const session = await auth()
      
      if (!session?.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      // Add user to request object
      req.user = session.user
      
      return handler(req, res)
    } catch (error) {
      console.error("Auth middleware error:", error)
      return res.status(500).json({ error: "Authentication error" })
    }
  }
}