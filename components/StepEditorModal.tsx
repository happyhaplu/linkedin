'use client'

import { useState } from 'react'
import type { CreateSequenceInput, SequenceStepType, ConditionType, Lead } from '@/types/linkedin'
import TemplateEditor from './TemplateEditor'

const STEP_TYPES: { value: SequenceStepType; label: string; icon: string; hasMessage: boolean }[] = [
  { value: 'connection_request', label: 'Connect', icon: '👋', hasMessage: true },
  { value: 'message', label: 'Message', icon: '💬', hasMessage: true },
  { value: 'inmail', label: 'InMail', icon: '📨', hasMessage: true },
  { value: 'view_profile', label: 'View Profile', icon: '👁️', hasMessage: false },
  { value: 'follow', label: 'Follow', icon: '➕', hasMessage: false },
  { value: 'like_post', label: 'Like Post', icon: '❤️', hasMessage: false },
]

const CONDITIONS: { value: string; label: string }[] = [
  { value: '', label: 'No condition (always run)' },
  { value: 'accepted', label: 'If connection accepted' },
  { value: 'not_accepted', label: 'If connection not accepted' },
  { value: 'replied', label: 'If they replied' },
  { value: 'not_replied', label: 'If they did not reply' },
]

interface StepEditorModalProps {
  step: CreateSequenceInput
  isFirstStep: boolean
  sampleLead?: Lead | null
  onSave: (updated: CreateSequenceInput) => void
  onClose: () => void
}

export default function StepEditorModal({
  step, isFirstStep, sampleLead, onSave, onClose
}: StepEditorModalProps) {
  const [draft, setDraft] = useState<CreateSequenceInput>({ ...step })
  const selectedType = STEP_TYPES.find(t => t.value === draft.step_type)

  const updateDraft = (updates: Partial<CreateSequenceInput>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            Edit Step {step.step_number}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1 — Action Type */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Action Type</h3>
            <div className="grid grid-cols-4 gap-2">
              {STEP_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => updateDraft({ step_type: t.value })}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    draft.step_type === t.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="text-2xl mb-1">{t.icon}</span>
                  <span className="text-xs font-medium text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2 — Delay */}
          {!isFirstStep && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Wait / Delay</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Wait</span>
                <input
                  type="number"
                  min={0}
                  value={draft.delay_days ?? 0}
                  onChange={e => updateDraft({ delay_days: parseInt(e.target.value) || 0 })}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">days and</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.delay_hours ?? 0}
                  onChange={e => updateDraft({ delay_hours: parseInt(e.target.value) || 0 })}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">hours after previous step</span>
              </div>
            </div>
          )}

          {/* Section 3 — Condition */}
          {!isFirstStep && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Condition</h3>
              <select
                value={draft.condition_type || ''}
                onChange={e => updateDraft({ condition_type: (e.target.value || null) as ConditionType })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              >
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Section 4 — Message Template */}
          {selectedType?.hasMessage && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Message Template</h3>
              <TemplateEditor
                value={draft.message_template || ''}
                onChange={v => updateDraft({ message_template: v })}
                valueB={draft.message_template_b}
                onChangeB={v => updateDraft({ message_template_b: v })}
                abEnabled={draft.ab_test_enabled || false}
                onToggleAB={() => updateDraft({ ab_test_enabled: !draft.ab_test_enabled })}
                stepType={draft.step_type}
                sampleLead={sampleLead}
              />
            </div>
          )}

          {/* Section 5 — InMail Subject */}
          {draft.step_type === 'inmail' && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Subject Line</h3>
              <input
                type="text"
                value={draft.subject_template || ''}
                onChange={e => updateDraft({ subject_template: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., {{firstName}}, exciting opportunity at [Company]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onSave(draft); onClose() }}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Save Step
          </button>
        </div>
      </div>
    </div>
  )
}
