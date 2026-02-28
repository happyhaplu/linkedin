'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CreateSequenceInput, SequenceStepType, Lead } from '@/types/linkedin'
import StepEditorModal from './StepEditorModal'

const STEP_ICONS: Record<SequenceStepType, string> = {
  connection_request: '👋',
  message: '💬',
  inmail: '📨',
  view_profile: '👁️',
  follow: '➕',
  like_post: '❤️',
  email: '📧'
}

const STEP_LABELS: Record<SequenceStepType, string> = {
  connection_request: 'Connect',
  message: 'Message',
  inmail: 'InMail',
  view_profile: 'View Profile',
  follow: 'Follow',
  like_post: 'Like Post',
  email: 'Email'
}

const CONDITION_LABELS: Record<string, string> = {
  accepted: '↳ if accepted',
  not_accepted: '↳ if not accepted',
  replied: '↳ if replied',
  not_replied: '↳ if not replied'
}

interface StepCardProps {
  seq: CreateSequenceInput
  index: number
  total: number
  readOnly: boolean
  leadCount?: number
  onEdit: () => void
  onRemove: () => void
}

function SortableStepCard({ seq, index, total, readOnly, leadCount, onEdit, onRemove }: StepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `step-${index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const preview = seq.message_template?.slice(0, 60) + (
    (seq.message_template?.length || 0) > 60 ? '…' : ''
  )

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Delay connector */}
      {index > 0 && (seq.delay_days || 0) + (seq.delay_hours || 0) > 0 && (
        <div className="flex items-center gap-2 my-1 ml-11">
          <div className="w-px h-4 bg-gray-300" />
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            Wait {seq.delay_days ? `${seq.delay_days}d` : ''}{seq.delay_hours ? ` ${seq.delay_hours}h` : ''}
          </span>
          <div className="w-px h-4 bg-gray-300" />
        </div>
      )}

      <div className={`flex items-start gap-3 p-4 bg-white border-2 rounded-2xl shadow-sm transition-all ${
        isDragging ? 'border-blue-400 shadow-lg' : 'border-gray-200 hover:border-gray-300'
      }`}>
        {/* Drag handle */}
        {!readOnly && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </button>
        )}

        {/* Step number */}
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
          {seq.step_number}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{STEP_ICONS[seq.step_type]}</span>
            <span className="font-semibold text-gray-900 text-sm">{STEP_LABELS[seq.step_type]}</span>
            {seq.ab_test_enabled && (
              <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full border border-green-200">A/B</span>
            )}
            {seq.condition_type && (
              <span className="text-xs text-purple-600 font-medium">{CONDITION_LABELS[seq.condition_type] || ''}</span>
            )}
            {leadCount !== undefined && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{leadCount} leads here</span>
            )}
          </div>
          {preview && (
            <p className="text-xs text-gray-500 mt-1 truncate">{preview}</p>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Edit
            </button>
            {total > 1 && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                title="Remove step"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface AddStepButtonProps {
  onClick: () => void
  label?: string
}
function AddStepButton({ onClick, label = 'Add Step' }: AddStepButtonProps) {
  return (
    <div className="flex items-center gap-3 my-1 ml-11">
      <div className="w-px h-4 bg-gray-200" />
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {label}
      </button>
    </div>
  )
}

interface VisualSequenceBuilderProps {
  sequences: CreateSequenceInput[]
  onChange: (sequences: CreateSequenceInput[]) => void
  readOnly?: boolean
  campaignLeadCounts?: Record<string, number>
  sampleLead?: Lead | null
}

export default function VisualSequenceBuilder({
  sequences, onChange, readOnly = false, campaignLeadCounts, sampleLead
}: VisualSequenceBuilderProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const fromIndex = sequences.findIndex((_, i) => `step-${i}` === active.id)
    const toIndex = sequences.findIndex((_, i) => `step-${i}` === over.id)
    if (fromIndex === -1 || toIndex === -1) return

    const reordered = arrayMove(sequences, fromIndex, toIndex).map((s, i) => ({
      ...s,
      step_number: i + 1
    }))
    onChange(reordered)
  }

  const addStepAt = (afterIndex: number) => {
    const newStep: CreateSequenceInput = {
      step_number: afterIndex + 2,
      step_type: 'message',
      message_template: '',
      delay_days: 1,
      delay_hours: 0
    }
    const updated = [
      ...sequences.slice(0, afterIndex + 1),
      newStep,
      ...sequences.slice(afterIndex + 1)
    ].map((s, i) => ({ ...s, step_number: i + 1 }))
    onChange(updated)
    setEditingIndex(afterIndex + 1)
  }

  const removeStep = (index: number) => {
    const updated = sequences
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step_number: i + 1 }))
    onChange(updated)
  }

  const saveStep = (index: number, updated: CreateSequenceInput) => {
    const newSeqs = [...sequences]
    newSeqs[index] = updated
    onChange(newSeqs)
  }

  const items = sequences.map((_, i) => `step-${i}`)

  return (
    <div className="space-y-0">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {sequences.map((seq, i) => (
            <div key={i}>
              <SortableStepCard
                seq={seq}
                index={i}
                total={sequences.length}
                readOnly={readOnly}
                leadCount={campaignLeadCounts?.[String(i)]}
                onEdit={() => setEditingIndex(i)}
                onRemove={() => removeStep(i)}
              />
              {!readOnly && (
                <AddStepButton onClick={() => addStepAt(i)} />
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {!readOnly && sequences.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-2xl">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-gray-500 text-sm mb-4">No steps yet. Add your first step to get started.</p>
          <AddStepButton onClick={() => addStepAt(-1)} label="Add First Step" />
        </div>
      )}

      {/* Step Editor Modal */}
      {editingIndex !== null && sequences[editingIndex] && (
        <StepEditorModal
          step={sequences[editingIndex]}
          isFirstStep={editingIndex === 0}
          sampleLead={sampleLead}
          onSave={(updated) => saveStep(editingIndex, updated)}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  )
}
