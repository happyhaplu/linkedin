'use client'

interface FunnelProps {
  sent: number
  sent_pct: number
  accepted: number
  accepted_pct: number
  messaged: number
  messaged_pct: number
  replied: number
  replied_pct: number
}

interface FunnelStep {
  label: string
  icon: string
  value: number
  pct: number
  color: string
  bg: string
}

function rateColor(pct: number): string {
  if (pct >= 30) return 'text-green-600'
  if (pct >= 15) return 'text-yellow-600'
  return 'text-red-500'
}

export default function AnalyticsFunnelChart({
  sent, sent_pct, accepted, accepted_pct, messaged, messaged_pct, replied, replied_pct
}: FunnelProps) {
  const steps: FunnelStep[] = [
    { label: 'Sent', icon: '📤', value: sent, pct: sent_pct, color: 'border-blue-300', bg: 'bg-blue-50' },
    { label: 'Accepted', icon: '🤝', value: accepted, pct: accepted_pct, color: 'border-green-300', bg: 'bg-green-50' },
    { label: 'Messaged', icon: '💬', value: messaged, pct: messaged_pct, color: 'border-purple-300', bg: 'bg-purple-50' },
    { label: 'Replied', icon: '↩️', value: replied, pct: replied_pct, color: 'border-orange-300', bg: 'bg-orange-50' },
  ]

  return (
    <div className="flex items-stretch gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1">
          {/* Card */}
          <div className={`flex-1 rounded-xl border-2 ${step.color} ${step.bg} p-4 text-center`}>
            <div className="text-xl mb-1">{step.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{step.value.toLocaleString()}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{step.label}</div>
            <div className={`text-sm font-semibold mt-1 ${rateColor(step.pct)}`}>
              {step.pct}%
            </div>
          </div>
          {/* Arrow connector */}
          {i < steps.length - 1 && (
            <div className="flex flex-col items-center px-1 shrink-0">
              <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
