'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Mail,
  Smartphone,
  Clock,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react'

interface AlertSetting {
  id?: string
  alertType: 'MATERIAL_CHANGE' | 'NEW_FILING' | 'PRICE_CHANGE' | 'EARNINGS_RELEASE'
  method: 'EMAIL' | 'SMS' | 'PUSH'
  isEnabled: boolean
  threshold?: number
  frequency: 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY'
  quietHours?: {
    enabled: boolean
    startTime: string
    endTime: string
  }
  metadata?: Record<string, any>
}

interface GlobalSettings {
  email?: string
  phone?: string
  timezone: string
  defaultFrequency: 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY'
}

interface AlertSettingsResponse {
  settings: AlertSetting[]
  globalSettings: GlobalSettings
}

export function AlertSettingsForm() {
  const [settings, setSettings] = useState<AlertSetting[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    timezone: 'UTC',
    defaultFrequency: 'IMMEDIATE'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/settings/alerts', {
        headers: {
          'x-user-id': 'demo-user' // In real app, get from auth
        }
      })

      if (response.ok) {
        const data: AlertSettingsResponse = await response.json()
        setSettings(data.settings || [])
        setGlobalSettings(data.globalSettings || {
          timezone: 'UTC',
          defaultFrequency: 'IMMEDIATE'
        })
      } else {
        throw new Error('Failed to load settings')
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError('Failed to load alert settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await fetch('/api/settings/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user'
        },
        body: JSON.stringify({
          settings,
          globalSettings
        })
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addNewSetting = () => {
    const newSetting: AlertSetting = {
      alertType: 'MATERIAL_CHANGE',
      method: 'EMAIL',
      isEnabled: true,
      frequency: globalSettings.defaultFrequency,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    }
    setSettings([...settings, newSetting])
  }

  const updateSetting = (index: number, updates: Partial<AlertSetting>) => {
    const newSettings = [...settings]
    newSettings[index] = { ...newSettings[index], ...updates }
    setSettings(newSettings)
  }

  const deleteSetting = (index: number) => {
    setSettings(settings.filter((_, i) => i !== index))
  }

  const alertTypeLabels = {
    MATERIAL_CHANGE: 'Material Changes',
    NEW_FILING: 'New Filings',
    PRICE_CHANGE: 'Price Changes',
    EARNINGS_RELEASE: 'Earnings Releases'
  }

  const methodIcons = {
    EMAIL: Mail,
    SMS: Smartphone,
    PUSH: Bell
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading alert settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-green-500" />
            <div>
              <p className="font-medium text-green-900">Settings Saved</p>
              <p className="text-sm text-green-700">Your alert preferences have been updated successfully.</p>
            </div>
          </div>
        </div>
      )}

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>
            Configure your contact information and default preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={globalSettings.email || ''}
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your-email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={globalSettings.phone || ''}
                onChange={(e) => setGlobalSettings(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={globalSettings.timezone} 
                onValueChange={(value) => setGlobalSettings(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Asia/Hong_Kong">Hong Kong</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="defaultFrequency">Default Frequency</Label>
              <Select 
                value={globalSettings.defaultFrequency} 
                onValueChange={(value: any) => setGlobalSettings(prev => ({ ...prev, defaultFrequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>
                Configure how and when you receive different types of notifications
              </CardDescription>
            </div>
            <Button onClick={addNewSetting} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Alert Rules</h3>
              <p className="text-gray-600 mb-4">
                Add your first alert rule to start receiving notifications
              </p>
              <Button onClick={addNewSetting}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Rule
              </Button>
            </div>
          ) : (
            settings.map((setting, index) => (
              <Card key={index} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={setting.isEnabled}
                        onCheckedChange={(enabled) => updateSetting(index, { isEnabled: enabled })}
                      />
                      <Badge variant="outline">
                        {alertTypeLabels[setting.alertType]}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {React.createElement(methodIcons[setting.method], { className: "w-3 h-3" })}
                        {setting.method}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSetting(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Alert Type</Label>
                      <Select 
                        value={setting.alertType}
                        onValueChange={(value: any) => updateSetting(index, { alertType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MATERIAL_CHANGE">Material Changes</SelectItem>
                          <SelectItem value="NEW_FILING">New Filings</SelectItem>
                          <SelectItem value="PRICE_CHANGE">Price Changes</SelectItem>
                          <SelectItem value="EARNINGS_RELEASE">Earnings Releases</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Method</Label>
                      <Select 
                        value={setting.method}
                        onValueChange={(value: any) => updateSetting(index, { method: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="SMS">SMS</SelectItem>
                          <SelectItem value="PUSH">Push Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Frequency</Label>
                      <Select 
                        value={setting.frequency}
                        onValueChange={(value: any) => updateSetting(index, { frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Threshold for material changes and price changes */}
                  {(setting.alertType === 'MATERIAL_CHANGE' || setting.alertType === 'PRICE_CHANGE') && (
                    <div>
                      <Label>
                        {setting.alertType === 'MATERIAL_CHANGE' ? 'Materiality Threshold' : 'Price Change Threshold (%)'}
                      </Label>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={setting.alertType === 'MATERIAL_CHANGE' ? "0" : "1"}
                          max={setting.alertType === 'MATERIAL_CHANGE' ? "1" : "20"}
                          step={setting.alertType === 'MATERIAL_CHANGE' ? "0.1" : "1"}
                          value={setting.threshold || (setting.alertType === 'MATERIAL_CHANGE' ? 0.7 : 5)}
                          onChange={(e) => updateSetting(index, { threshold: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="min-w-16 text-sm font-medium">
                          {setting.threshold || (setting.alertType === 'MATERIAL_CHANGE' ? 0.7 : 5)}
                          {setting.alertType === 'PRICE_CHANGE' ? '%' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quiet Hours */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={setting.quietHours?.enabled || false}
                        onCheckedChange={(enabled) => updateSetting(index, {
                          quietHours: { ...setting.quietHours, enabled } as any
                        })}
                      />
                      <Label className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Quiet Hours
                      </Label>
                    </div>

                    {setting.quietHours?.enabled && (
                      <div className="grid grid-cols-2 gap-4 pl-8">
                        <div>
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={setting.quietHours.startTime}
                            onChange={(e) => updateSetting(index, {
                              quietHours: { ...setting.quietHours, startTime: e.target.value } as any
                            })}
                          />
                        </div>
                        <div>
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={setting.quietHours.endTime}
                            onChange={(e) => updateSetting(index, {
                              quietHours: { ...setting.quietHours, endTime: e.target.value } as any
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveSettings} 
          disabled={saving}
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Import React for createElement
import React from 'react'