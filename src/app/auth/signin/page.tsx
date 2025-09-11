'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  Mail, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  FileText
} from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [formError, setFormError] = useState('')

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      setFormError('Please enter both email and password')
      return
    }

    setIsLoading(true)
    setFormError('')

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setFormError('Invalid email or password')
      } else {
        // Refresh session and redirect
        await getSession()
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setFormError('An error occurred during sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl })
    } catch (error) {
      console.error('Google sign in error:', error)
      setFormError('Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!formData.email) {
      setFormError('Please enter your email address')
      return
    }

    setIsLoading(true)
    setFormError('')

    try {
      const result = await signIn('email', {
        email: formData.email,
        redirect: false,
        callbackUrl,
      })

      if (result?.ok) {
        alert('Check your email for a magic link!')
      } else {
        setFormError('Failed to send magic link')
      }
    } catch (error) {
      console.error('Magic link error:', error)
      setFormError('Failed to send magic link')
    } finally {
      setIsLoading(false)
    }
  }

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password'
      case 'EmailSignin':
        return 'Failed to send email. Please try again.'
      case 'OAuthSignin':
      case 'OAuthCallback':
        return 'Error with OAuth provider. Please try again.'
      case 'AccessDenied':
        return 'Access denied. Please contact support.'
      default:
        return 'An error occurred during sign in'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">WhatChanged</h1>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
          <p className="text-gray-600">Sign in to your account to continue monitoring SEC filings</p>
        </div>

        {/* Error Message */}
        {(error || formError) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-sm text-red-700">
                  {formError || getErrorMessage(error)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in to your account</CardTitle>
            <CardDescription>
              Choose your preferred sign in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign In */}
            <Button
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <Separator />

            {/* Email/Password Form */}
            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your-email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <Separator />

            {/* Magic Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Or sign in with a magic link</p>
              <Button
                variant="outline"
                onClick={handleMagicLink}
                disabled={isLoading || !formData.email}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Magic Link
              </Button>
              {!formData.email && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter your email above first
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sign Up Link */}
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-700">
                Sign up for free
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Demo Access */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="text-center">
              <Badge variant="secondary" className="mb-2">Demo Access</Badge>
              <p className="text-sm text-blue-700 mb-3">
                Want to explore without signing up?
              </p>
              <Link href="/stocks/AAPL">
                <Button variant="outline" size="sm">
                  View Demo (AAPL)
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}