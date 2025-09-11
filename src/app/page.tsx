import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Bell, FileText, TrendingUp, Eye, Search, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <section className="relative px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6">
            <Zap className="w-4 h-4 mr-2" />
            SEC Filing Intelligence
          </Badge>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Never Miss a{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Material Change
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Track SEC filings, detect material changes, and get instant alerts when companies you follow 
            make significant updates to their disclosures.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/dashboard">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Start Tracking <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/stocks/AAPL">
              <Button variant="outline" size="lg">
                <Eye className="mr-2 h-4 w-4" />
                View Demo (AAPL)
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Intelligent SEC Filing Analysis
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform analyzes every filing to identify what really matters to investors.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Real-time Monitoring */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Real-time Alerts</CardTitle>
                <CardDescription>
                  Get notified instantly when companies file new documents or make material changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Email and SMS notifications</li>
                  <li>• Custom alert thresholds</li>
                  <li>• Multi-company watchlists</li>
                  <li>• Quiet hours support</li>
                </ul>
              </CardContent>
            </Card>

            {/* AI Analysis */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>AI-Powered Analysis</CardTitle>
                <CardDescription>
                  Advanced diff detection and materiality scoring using OpenAI technology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Automatic change detection</li>
                  <li>• Materiality scoring (0-1)</li>
                  <li>• Executive summaries</li>
                  <li>• Investor implications</li>
                </ul>
              </CardContent>
            </Card>

            {/* Price Integration */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Price Integration</CardTitle>
                <CardDescription>
                  Real-time stock prices and charts alongside filing data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Multi-provider price data</li>
                  <li>• Interactive charts</li>
                  <li>• Filing impact analysis</li>
                  <li>• Historical correlations</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How WhatChanged Works
            </h2>
            <p className="text-lg text-gray-600">
              Three simple steps to stay informed about your investments
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-4">Add Companies</h3>
              <p className="text-gray-600">
                Build your watchlist by adding ticker symbols for companies you want to monitor
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-4">AI Analysis</h3>
              <p className="text-gray-600">
                Our AI automatically analyzes new filings and identifies material changes using advanced NLP
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-4">Get Alerted</h3>
              <p className="text-gray-600">
                Receive instant notifications when material changes are detected in your watched companies
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Companies */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Popular Companies
            </h2>
            <p className="text-lg text-gray-600">
              Start by exploring these frequently monitored stocks
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { ticker: 'AAPL', name: 'Apple Inc.' },
              { ticker: 'MSFT', name: 'Microsoft Corp.' },
              { ticker: 'GOOGL', name: 'Alphabet Inc.' },
              { ticker: 'AMZN', name: 'Amazon.com Inc.' },
              { ticker: 'TSLA', name: 'Tesla Inc.' },
              { ticker: 'META', name: 'Meta Platforms Inc.' },
              { ticker: 'NVDA', name: 'NVIDIA Corp.' },
              { ticker: 'JPM', name: 'JPMorgan Chase' },
              { ticker: 'JNJ', name: 'Johnson & Johnson' },
              { ticker: 'V', name: 'Visa Inc.' },
              { ticker: 'WMT', name: 'Walmart Inc.' },
              { ticker: 'PG', name: 'Procter & Gamble' }
            ].map((company) => (
              <Link
                key={company.ticker}
                href={`/stocks/${company.ticker}`}
                className="group"
              >
                <Card className="border hover:border-blue-200 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4 text-center">
                    <div className="font-bold text-blue-600 group-hover:text-blue-700">
                      {company.ticker}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {company.name}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Stay Ahead of Material Changes?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of investors who trust WhatChanged to monitor their portfolios
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">
                <Search className="mr-2 h-4 w-4" />
                Start Free Trial
              </Button>
            </Link>
            
            <Link href="/stocks/AAPL">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                View Live Demo
              </Button>
            </Link>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20 text-sm opacity-75">
            <p>
              Trusted by portfolio managers, analysts, and individual investors worldwide
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}