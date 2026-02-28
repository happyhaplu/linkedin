'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'
import ProfileDropdown from '@/components/ProfileDropdown'
import { createCampaign, getCampaignTemplates } from '@/app/actions/campaigns'
import { getLists } from '@/app/actions/leads'
import { getLinkedInAccounts } from '@/app/actions/linkedin-accounts'
import VisualSequenceBuilder from '@/components/VisualSequenceBuilder'
import type { CreateCampaignInput, CreateSequenceInput, SequenceStepType, ConditionType } from '@/types/linkedin'

type WizardStep = 'basic' | 'senders' | 'sequence' | 'review'

const STEP_TYPES: { value: SequenceStepType; label: string; icon: string }[] = [
  { value: 'connection_request', label: 'Connection Request', icon: '👋' },
  { value: 'message', label: 'Send Message', icon: '💬' },
  { value: 'inmail', label: 'Send InMail', icon: '📨' },
  { value: 'follow', label: 'Follow Profile', icon: '➕' },
  { value: 'like_post', label: 'Like Post', icon: '❤️' },
  { value: 'view_profile', label: 'View Profile', icon: '👁️' },
  { value: 'email', label: 'Send Email', icon: '📧' }
]

const CONDITION_TYPES: { value: string; label: string }[] = [
  { value: 'accepted', label: 'If connection accepted' },
  { value: 'not_accepted', label: 'If connection not accepted' },
  { value: 'replied', label: 'If they replied' },
  { value: 'not_replied', label: 'If they did not reply' }
]

function NewCampaignPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic')
  const [loading, setLoading] = useState(false)
  const [lists, setLists] = useState<any[]>([])
  const [linkedInAccounts, setLinkedInAccounts] = useState<any[]>([])
  const [showSafetySettings, setShowSafetySettings] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateCampaignInput>({
    name: '',
    description: '',
    lead_list_id: '',
    daily_limit: 50,
    timezone: 'UTC',
    sender_ids: [],
    sequences: [],
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    delay_min_seconds: 30,
    delay_max_seconds: 120,
    warm_up_enabled: false,
    warm_up_days: 14,
    auto_pause_below_acceptance: 10,
    skip_already_contacted: true,
    stop_on_reply: true
  })

  // Sequence builder state
  const [sequences, setSequences] = useState<CreateSequenceInput[]>([
    {
      step_number: 1,
      step_type: 'connection_request',
      message_template: '',
      delay_days: 0,
      delay_hours: 0
    }
  ])

  useEffect(() => {
    loadData()
    const templateId = searchParams.get('template')
    if (templateId) {
      getCampaignTemplates().then(templates => {
        const tpl = templates.find(t => t.id === templateId)
        if (tpl?.steps) {
          setSequences(tpl.steps.map((s, i) => ({
            step_number: i + 1,
            step_type: s.step_type as SequenceStepType,
            message_template: s.message_template || '',
            delay_days: Math.floor((s.delay_hours || 0) / 24),
            delay_hours: (s.delay_hours || 0) % 24,
            condition_type: s.condition_type || undefined
          })))
          if (tpl.name) setFormData(fd => ({ ...fd, name: tpl.name + ' (Copy)' }))
        }
      }).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      const [listsData, accountsData] = await Promise.all([
        getLists(),
        getLinkedInAccounts()
      ])
      setLists(listsData)
      setLinkedInAccounts(accountsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const campaignData = {
        ...formData,
        sequences
      }
      const campaign = await createCampaign(campaignData)
      router.push(`/campaigns/${campaign.id}`)
    } catch (error: any) {
      console.error('Failed to create campaign:', error)
      alert('Failed to create campaign: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const addSequenceStep = () => {
    setSequences([
      ...sequences,
      {
        step_number: sequences.length + 1,
        step_type: 'message',
        message_template: '',
        delay_days: 1,
        delay_hours: 0
      }
    ])
  }

  const removeSequenceStep = (index: number) => {
    const newSequences = sequences.filter((_, i) => i !== index)
    // Renumber steps
    newSequences.forEach((seq, i) => {
      seq.step_number = i + 1
    })
    setSequences(newSequences)
  }

  const updateSequenceStep = (index: number, updates: Partial<CreateSequenceInput>) => {
    const newSequences = [...sequences]
    newSequences[index] = { ...newSequences[index], ...updates }
    setSequences(newSequences)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'basic':
        return formData.name.trim().length > 0
      case 'senders':
        return formData.sender_ids.length > 0
      case 'sequence':
        // connection_request note is optional on LinkedIn; only message/inmail MUST have content
        return sequences.length > 0 && sequences.every(seq => {
          if (seq.step_type === 'message' || seq.step_type === 'inmail') {
            return seq.message_template && seq.message_template.trim().length > 0
          }
          return true
        })
      case 'review':
        return true
      default:
        return false
    }
  }

  const renderStepIndicator = () => {
    const steps: { id: WizardStep; label: string; number: number }[] = [
      { id: 'basic', label: 'Basic Info', number: 1 },
      { id: 'senders', label: 'Senders', number: 2 },
      { id: 'sequence', label: 'Workflow', number: 3 },
      { id: 'review', label: 'Review', number: 4 }
    ]

    const currentIndex = steps.findIndex(s => s.id === currentStep)

    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  index <= currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {step.number}
              </div>
              <span className={`mt-2 text-sm ${index <= currentIndex ? 'text-blue-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-24 h-1 mx-4 mb-6 ${
                  index < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Campaign Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Q1 Outreach Campaign"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          placeholder="Describe your campaign goals and target audience"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lead List
        </label>
        <select
          value={formData.lead_list_id}
          onChange={(e) => setFormData({ ...formData, lead_list_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a lead list (optional)</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name} ({list.lead_count || 0} leads)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Limit
          </label>
          <input
            type="number"
            value={formData.daily_limit}
            onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={1}
            max={200}
          />
          <p className="mt-1 text-xs text-gray-500">Actions per day per sender</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="Europe/London">London</option>
            <option value="Europe/Paris">Paris</option>
            <option value="Asia/Kolkata">India</option>
          </select>
        </div>
      </div>

      {/* Advanced Safety Settings */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSafetySettings(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span className="text-sm font-semibold text-gray-700">Advanced Safety Settings</span>
            <span className="text-xs text-gray-400">(warm-up, delays, working hours)</span>
          </div>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${showSafetySettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSafetySettings && (
          <div className="p-4 space-y-5">
            {/* Working Hours */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⏰ Working Hours</label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Start time</label>
                  <input
                    type="time"
                    value={formData.working_hours_start ?? '09:00'}
                    onChange={e => setFormData({ ...formData, working_hours_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-gray-400 mt-5">→</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">End time</label>
                  <input
                    type="time"
                    value={formData.working_hours_end ?? '18:00'}
                    onChange={e => setFormData({ ...formData, working_hours_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Working Days */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Working Days</label>
              <div className="flex gap-2">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => (
                  <label key={i} className="flex flex-col items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(formData.working_days ?? ['1','2','3','4','5']).includes(String(i))}
                      onChange={e => {
                        const days = formData.working_days ?? ['1','2','3','4','5']
                        setFormData({
                          ...formData,
                          working_days: e.target.checked ? [...days, String(i)].sort() : days.filter(d => d !== String(i))
                        })
                      }}
                      className="sr-only"
                    />
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                      (formData.working_days ?? ['1','2','3','4','5']).includes(String(i))
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>
                      {day[0]}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Delay Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⏱️ Random Delay Between Actions</label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Min seconds</label>
                  <input
                    type="number"
                    min={5} max={300}
                    value={formData.delay_min_seconds ?? 30}
                    onChange={e => setFormData({ ...formData, delay_min_seconds: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-gray-400 mt-5">–</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Max seconds</label>
                  <input
                    type="number"
                    min={5} max={600}
                    value={formData.delay_max_seconds ?? 120}
                    onChange={e => setFormData({ ...formData, delay_max_seconds: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Humanizes timing to avoid LinkedIn rate limits</p>
            </div>

            {/* Warm-up */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">🔥 Account Warm-up</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, warm_up_enabled: !formData.warm_up_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.warm_up_enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    formData.warm_up_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {formData.warm_up_enabled && (
                <div className="flex items-center gap-3 mt-2">
                  <label className="text-xs text-gray-500">Ramp up over</label>
                  <input
                    type="number"
                    min={3} max={30}
                    value={formData.warm_up_days ?? 14}
                    onChange={e => setFormData({ ...formData, warm_up_days: parseInt(e.target.value) })}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="text-xs text-gray-500">days to full daily limit</label>
                </div>
              )}
            </div>

            {/* Circuit Breaker */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⚡ Auto-pause Circuit Breaker</label>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Pause if acceptance rate drops below</label>
                <input
                  type="number"
                  min={0} max={100}
                  value={formData.auto_pause_below_acceptance ?? 10}
                  onChange={e => setFormData({ ...formData, auto_pause_below_acceptance: parseInt(e.target.value) })}
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Protects your account from getting flagged</p>
            </div>

            {/* Skip / Stop flags */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.skip_already_contacted ?? true}
                  onChange={e => setFormData({ ...formData, skip_already_contacted: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Skip already-contacted leads</p>
                  <p className="text-xs text-gray-400">Avoid reaching out to leads contacted in other campaigns</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.stop_on_reply ?? true}
                  onChange={e => setFormData({ ...formData, stop_on_reply: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Stop sequence on reply</p>
                  <p className="text-xs text-gray-400">Automatically stop follow-ups when a lead replies</p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderSenders = () => (
    <div className="space-y-4">
      <p className="text-gray-600">
        Select LinkedIn accounts that will send connection requests and messages
      </p>

      {linkedInAccounts.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No LinkedIn accounts found. Please add LinkedIn accounts first.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {linkedInAccounts.map((account) => (
            <label
              key={account.id}
              className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.sender_ids.includes(account.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.sender_ids.includes(account.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      sender_ids: [...formData.sender_ids, account.id]
                    })
                  } else {
                    setFormData({
                      ...formData,
                      sender_ids: formData.sender_ids.filter(id => id !== account.id)
                    })
                  }
                }}
                className="w-5 h-5 text-blue-600"
              />
              <div className="ml-4 flex-1">
                <div className="flex items-center gap-3">
                  {account.profile_picture_url && (
                    <Image
                      src={account.profile_picture_url}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {account.profile_name || account.email}
                    </div>
                    <div className="text-sm text-gray-500">{account.email}</div>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                account.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {account.status}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )

  const renderSequence = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Campaign Workflow</h3>
        <p className="text-gray-500 text-sm">Drag steps to reorder · click + to insert a step · click ✏️ to edit</p>
      </div>

      <VisualSequenceBuilder
        sequences={sequences}
        onChange={setSequences}
      />
    </div>
  )

  const renderReview = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Summary</h3>
        
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Campaign Name:</span>
            <p className="text-gray-900">{formData.name}</p>
          </div>

          {formData.description && (
            <div>
              <span className="text-sm font-medium text-gray-500">Description:</span>
              <p className="text-gray-900">{formData.description}</p>
            </div>
          )}

          <div>
            <span className="text-sm font-medium text-gray-500">Daily Limit:</span>
            <p className="text-gray-900">{formData.daily_limit} actions per sender</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Senders:</span>
            <p className="text-gray-900">{formData.sender_ids.length} LinkedIn account(s)</p>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Workflow Steps:</span>
            <p className="text-gray-900">{sequences.length} step(s)</p>
          </div>
        </div>
      </div>

      {/* Safety Summary */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
          <span>🛡️</span> Safety Settings Active
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-green-500">✓</span>
            <span>Working hours: {formData.working_hours_start} – {formData.working_hours_end}</span>
          </div>
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-green-500">✓</span>
            <span>Random delay: {formData.delay_min_seconds}–{formData.delay_max_seconds}s</span>
          </div>
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-green-500">✓</span>
            <span>{formData.warm_up_enabled ? `Warm-up: ${formData.warm_up_days} days` : 'Warm-up: off'}</span>
          </div>
          <div className="flex items-center gap-2 text-green-700">
            <span className="text-green-500">✓</span>
            <span>Auto-pause below {formData.auto_pause_below_acceptance}% acceptance</span>
          </div>
          {formData.skip_already_contacted && (
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-green-500">✓</span>
              <span>Skip already-contacted leads</span>
            </div>
          )}
          {formData.stop_on_reply && (
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-green-500">✓</span>
              <span>Stop sequence on reply</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Campaign will be created in draft status</p>
            <p>You&apos;ll need to add leads and start the campaign manually from the campaign detail page.</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
              <p className="text-sm text-gray-500 mt-1">Set up your automated outreach workflow</p>
            </div>
            <ProfileDropdown userEmail="" />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {currentStep === 'basic' && renderBasicInfo()}
              {currentStep === 'senders' && renderSenders()}
              {currentStep === 'sequence' && renderSequence()}
              {currentStep === 'review' && renderReview()}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (currentStep === 'basic') router.push('/campaigns')
                    else if (currentStep === 'senders') setCurrentStep('basic')
                    else if (currentStep === 'sequence') setCurrentStep('senders')
                    else if (currentStep === 'review') setCurrentStep('sequence')
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {currentStep === 'basic' ? 'Cancel' : 'Back'}
                </button>

                <button
                  onClick={() => {
                    if (currentStep === 'basic') setCurrentStep('senders')
                    else if (currentStep === 'senders') setCurrentStep('sequence')
                    else if (currentStep === 'sequence') setCurrentStep('review')
                    else if (currentStep === 'review') handleSubmit()
                  }}
                  disabled={!canProceed() || loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </>
                  ) : currentStep === 'review' ? (
                    'Create Campaign'
                  ) : (
                    'Next'
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" /></div>}>
      <NewCampaignPageInner />
    </Suspense>
  )
}
