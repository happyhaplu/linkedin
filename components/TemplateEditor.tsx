'use client'

import { useRef, useState, useCallback } from 'react'
import type { SequenceStepType, Lead } from '@/types/linkedin'
import { processTemplate } from '@/lib/template-engine'

const CHAR_LIMITS: Record<string, number> = {
  connection_request: 300,
  inmail: 1900,
  message: 8000,
  email: 10000
}

const VARIABLES = [
  { label: '{{firstName}}', value: '{{firstName}}' },
  { label: '{{lastName}}', value: '{{lastName}}' },
  { label: '{{company}}', value: '{{company}}' },
  { label: '{{position}}', value: '{{position}}' },
  { label: '{{location}}', value: '{{location}}' },
  { label: '✨ {{aiIcebreaker}}', value: '{{aiIcebreaker}}' },
]

interface TemplateEditorProps {
  value: string
  onChange: (v: string) => void
  valueB?: string
  onChangeB?: (v: string) => void
  abEnabled: boolean
  onToggleAB: () => void
  stepType: SequenceStepType
  sampleLead?: Lead | null
  label?: string
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  value: string,
  onChange: (v: string) => void
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const newValue = value.slice(0, start) + text + value.slice(end)
  onChange(newValue)
  // Restore cursor after insertion
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + text.length, start + text.length)
  })
}

function countSpintaxVariations(template: string): number {
  const matches = template.match(/\{[^}]+\}/g)
  if (!matches) return 1
  return matches.reduce((total, match) => {
    const options = match.slice(1, -1).split('|').length
    return total * options
  }, 1)
}

interface CharCounterProps {
  value: string
  limit: number
}
function CharCounter({ value, limit }: CharCounterProps) {
  const len = value.length
  const over = len - limit
  const hasSpintax = /\{[^}]+\}/.test(value)
  const variations = hasSpintax ? countSpintaxVariations(value) : 0
  return (
    <div className="flex items-center justify-between mt-1">
      <div>
        {hasSpintax && (
          <span className="text-xs text-purple-600 font-medium">
            ⚡ Spintax active — up to {variations} variation{variations !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <span className={`text-xs font-medium ${over > 0 ? 'text-red-600' : 'text-gray-400'}`}>
        {len} / {limit}{over > 0 ? ` — ⚠️ ${over} over limit` : ''}
      </span>
    </div>
  )
}

interface SpintaxPopoverProps {
  onInsert: (text: string) => void
  onClose: () => void
}
function SpintaxPopover({ onInsert, onClose }: SpintaxPopoverProps) {
  const [input, setInput] = useState('')
  const handleInsert = () => {
    if (input.trim()) {
      onInsert(`{${input}}`)
      onClose()
    }
  }
  return (
    <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72">
      <div className="text-sm font-semibold text-gray-800 mb-2">⚡ Add Spintax</div>
      <p className="text-xs text-gray-500 mb-2">Type options separated by |</p>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="option1 | option2 | option3"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        onKeyDown={e => e.key === 'Enter' && handleInsert()}
        autoFocus
      />
      <div className="mt-2 text-xs text-gray-400">
        Will insert: <code className="bg-gray-100 px-1 rounded">{`{${input || 'opt1|opt2'}}`}</code>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleInsert} className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Insert</button>
        <button onClick={onClose} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
      </div>
    </div>
  )
}

interface PreviewModalProps {
  templateA: string
  templateB?: string
  abEnabled: boolean
  sampleLead: Lead | null
  onClose: () => void
}
function PreviewModal({ templateA, templateB, abEnabled, sampleLead, onClose }: PreviewModalProps) {
  const lead = sampleLead || {
    first_name: 'John', last_name: 'Doe', full_name: 'John Doe',
    company: 'Acme Corp', position: 'Head of Marketing', location: 'New York',
    ai_icebreaker: 'Your work scaling demand generation at Acme really stands out.'
  }
  const previewA = processTemplate(templateA, lead as any)
  const previewB = templateB ? processTemplate(templateB, lead as any) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">👁️ Message Preview</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-500 mb-2">
            Preview using: <span className="font-medium text-gray-700">{lead.full_name}</span> at <span className="font-medium text-gray-700">{lead.company}</span>
          </div>
          <div className={abEnabled ? 'grid grid-cols-2 gap-4' : ''}>
            <div>
              {abEnabled && <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">Variant A</div>}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">
                {previewA || <span className="text-gray-400 italic">Empty template</span>}
              </div>
            </div>
            {abEnabled && previewB && (
              <div>
                <div className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wider">Variant B</div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap">
                  {previewB}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function TemplateEditor({
  value, onChange, valueB, onChangeB, abEnabled, onToggleAB, stepType, sampleLead, label = 'Message'
}: TemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaBRef = useRef<HTMLTextAreaElement>(null)
  const [showSpintax, setShowSpintax] = useState(false)
  const [spintaxTarget, setSpintaxTarget] = useState<'A' | 'B'>('A')
  const [showPreview, setShowPreview] = useState(false)
  const limit = CHAR_LIMITS[stepType] || 8000

  const handleChipClick = useCallback((varText: string, variant: 'A' | 'B' = 'A') => {
    const ref = variant === 'A' ? textareaRef : textareaBRef
    if (ref.current) {
      insertAtCursor(ref.current, varText, variant === 'A' ? value : (valueB || ''), variant === 'A' ? onChange : (onChangeB || onChange))
    }
  }, [value, valueB, onChange, onChangeB])

  const handleSpintaxInsert = (text: string) => {
    const ref = spintaxTarget === 'A' ? textareaRef : textareaBRef
    const val = spintaxTarget === 'A' ? value : (valueB || '')
    const cb = spintaxTarget === 'A' ? onChange : (onChangeB || onChange)
    if (ref.current) {
      insertAtCursor(ref.current, text, val, cb)
    }
  }

  return (
    <div className="space-y-3">
      {/* Variable Chips */}
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map(v => (
          <button
            key={v.value}
            type="button"
            onClick={() => handleChipClick(v.value, 'A')}
            className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors"
          >
            {v.label}
          </button>
        ))}
        {/* Dedicated AI Icebreaker button */}
        <div className="relative group">
          <button
            type="button"
            onClick={() => handleChipClick('{{aiIcebreaker}}', 'A')}
            className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full hover:bg-purple-100 transition-colors flex items-center gap-1"
          >
            ✨ AI Icebreaker
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed">
              AI icebreakers are generated per-lead when you launch the campaign. They appear as{' '}
              <span className="font-mono bg-gray-700 px-1 rounded">{'{{aiIcebreaker}}'}</span>{' '}
              in your message. Click to insert.
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        </div>
      </div>

      {/* Variant A */}
      <div>
        {abEnabled && (
          <div className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">Variant A</div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={5}
            className={`w-full px-4 py-3 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              value.length > limit ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder={`Write your ${label.toLowerCase()} here…`}
          />
        </div>
        <CharCounter value={value} limit={limit} />
      </div>

      {/* A/B Test Variant B */}
      {abEnabled && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">Variant B</div>
            <div className="flex gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => handleChipClick(v.value, 'B')}
                  className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            ref={textareaBRef}
            value={valueB || ''}
            onChange={e => onChangeB?.(e.target.value)}
            rows={5}
            className={`w-full px-4 py-3 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
              (valueB || '').length > limit ? 'border-red-300 bg-red-50' : 'border-green-200'
            }`}
            placeholder="Write your Variant B message here…"
          />
          <CharCounter value={valueB || ''} limit={limit} />
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Spintax button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setSpintaxTarget('A'); setShowSpintax(v => !v) }}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              ⚡ Spintax
            </button>
            {showSpintax && (
              <SpintaxPopover
                onInsert={handleSpintaxInsert}
                onClose={() => setShowSpintax(false)}
              />
            )}
          </div>

          {/* Preview button */}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            👁️ Preview
          </button>
        </div>

        {/* A/B Toggle */}
        <button
          type="button"
          onClick={onToggleAB}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            abEnabled
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <div className={`w-8 h-4 rounded-full transition-colors relative ${abEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${abEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          A/B Test: {abEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          templateA={value}
          templateB={valueB}
          abEnabled={abEnabled}
          sampleLead={sampleLead || null}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
