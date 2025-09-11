import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
      subscriptionStatus: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
    subscriptionStatus: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
    subscriptionStatus: string
  }
}