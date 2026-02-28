'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  Conversation, Message,
  getConversations, getConversationMessages,
  sendMessage, markConversationAsRead,
  archiveConversation, setConversationLabel,
  triggerSync, getCampaignContext,
} from './actions'
import {
  MagnifyingGlassIcon, ArchiveBoxIcon, PaperAirplaneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { EnvelopeOpenIcon } from '@heroicons/react/24/solid'

// ─── Label config (simple, not overwhelming) ─────────────────────────────────

const LABELS: Record<string, { emoji: string; color: string; bg: string }> = {
  interested:     { emoji: '🟢', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  maybe:          { emoji: '🟡', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  not_interested:  { emoji: '🔴', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  meeting_booked: { emoji: '📅', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
}

interface UniboxContentProps {
  initialConversations: Conversation[]
  linkedinAccounts: { id: string; email: string; status: string }[]
}

export default function UniboxContent({ initialConversations, linkedinAccounts }: UniboxContentProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'needs_reply' | 'archived'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [campaignContext, setCampaignContext] = useState<any>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-refresh conversations every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getConversations()
        setConversations(fresh)
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // ─── Filters ─────────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(conv => {
    if (filter === 'unread' && conv.unread_count === 0) return false
    if (filter === 'archived' && !conv.is_archived) return false
    if (filter === 'all' && conv.is_archived) return false
    if (filter === 'needs_reply') {
      // Show conversations where last message is NOT from me
      if (conv.is_archived) return false
      const preview = conv.last_message_preview?.toLowerCase() || ''
      // A simple heuristic: if there's an unread count, it needs a reply
      if (conv.unread_count === 0) return false
    }
    if (selectedAccount !== 'all' && conv.linkedin_account_id !== selectedAccount) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        conv.participant_name.toLowerCase().includes(q) ||
        conv.last_message_preview?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setIsLoadingMessages(true)
    setCampaignContext(null)

    try {
      const msgs = await getConversationMessages(conversation.id)
      setMessages(msgs)

      if (conversation.unread_count > 0) {
        await markConversationAsRead(conversation.id)
        setConversations(prev =>
          prev.map(c => c.id === conversation.id ? { ...c, unread_count: 0 } : c)
        )
      }

      // Load campaign context in background
      getCampaignContext(conversation.participant_name, conversation.linkedin_account_id)
        .then(ctx => setCampaignContext(ctx))
        .catch(() => {})
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation || isSending) return

    setIsSending(true)
    try {
      const newMessage = await sendMessage(
        selectedConversation.id,
        selectedConversation.linkedin_account_id,
        replyText,
      )
      setMessages(prev => [...prev, newMessage])
      setReplyText('')
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversation.id
            ? { ...c, last_message_at: newMessage.sent_at, last_message_preview: newMessage.content }
            : c,
        ),
      )
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleArchive = async (conversationId: string) => {
    try {
      await archiveConversation(conversationId, true)
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, is_archived: true } : c))
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to archive:', error)
    }
  }

  const handleLabel = async (conversationId: string, label: string | null) => {
    try {
      await setConversationLabel(conversationId, label)
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, label } : c),
      )
    } catch (error) {
      console.error('Failed to set label:', error)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await triggerSync()
      // Wait a moment then refresh
      setTimeout(async () => {
        const fresh = await getConversations()
        setConversations(fresh)
        setIsSyncing(false)
      }, 3000)
    } catch {
      setIsSyncing(false)
    }
  }

  const totalUnread = conversations.filter(c => c.unread_count > 0 && !c.is_archived).length

  return (
    <div className="flex h-full">
      {/* ─── Left Panel: Conversations ─── */}
      <div className="w-[380px] bg-white border-r border-gray-200 flex flex-col">

        {/* Header + Sync */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {totalUnread > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
            title="Sync messages from LinkedIn"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Account Filter (only show if multiple accounts) */}
        {linkedinAccounts.length > 1 && (
          <div className="px-4 pb-2">
            <select
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50"
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
            >
              <option value="all">All Accounts</option>
              {linkedinAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.email}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 pb-3">
          <div className="flex space-x-1 bg-gray-100 p-0.5 rounded-lg">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread${totalUnread > 0 ? ` (${totalUnread})` : ''}` },
              { key: 'needs_reply', label: 'Needs Reply' },
              { key: 'archived', label: 'Archived' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
              <EnvelopeOpenIcon className="h-10 w-10 mb-2" />
              <p className="text-sm">
                {conversations.length === 0
                  ? 'No conversations yet — click Sync to pull from LinkedIn'
                  : 'No conversations match this filter'
                }
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
                  selectedConversation?.id === conv.id
                    ? 'bg-blue-50 border-l-3 border-l-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 relative">
                    {conv.participant_avatar_url ? (
                      <Image
                        src={conv.participant_avatar_url}
                        alt={conv.participant_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {conv.participant_name[0]?.toUpperCase()}
                      </div>
                    )}
                    {conv.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {conv.participant_name}
                      </h3>
                      <span className="text-[11px] text-gray-400 ml-2 flex-shrink-0">
                        {formatRelativeTime(conv.last_message_at)}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                      {conv.last_message_preview || 'No messages'}
                    </p>

                    {/* Label pill */}
                    {conv.label && LABELS[conv.label] && (
                      <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${LABELS[conv.label].bg} ${LABELS[conv.label].color}`}>
                        {LABELS[conv.label].emoji} {conv.label.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Right Panel: Thread ─── */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedConversation ? (
          <>
            {/* Thread Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {selectedConversation.participant_avatar_url ? (
                    <Image
                      src={selectedConversation.participant_avatar_url}
                      alt={selectedConversation.participant_name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {selectedConversation.participant_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      {selectedConversation.participant_name}
                    </h2>
                    {selectedConversation.participant_headline && (
                      <p className="text-xs text-gray-500 truncate max-w-md">
                        {selectedConversation.participant_headline}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {/* Label selector */}
                  <select
                    value={selectedConversation.label || ''}
                    onChange={e => handleLabel(selectedConversation.id, e.target.value || null)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
                  >
                    <option value="">No label</option>
                    {Object.entries(LABELS).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.emoji} {key.replace('_', ' ')}</option>
                    ))}
                  </select>

                  {selectedConversation.participant_profile_url && (
                    <a
                      href={selectedConversation.participant_profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Profile ↗
                    </a>
                  )}
                  <button
                    onClick={() => handleArchive(selectedConversation.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Archive"
                  >
                    <ArchiveBoxIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Campaign context banner (if this person is in a campaign) */}
              {campaignContext && (
                <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-1.5">
                  <span>📋 Campaign: <span className="font-medium text-gray-700">{campaignContext.campaignName}</span></span>
                  {campaignContext.company && <span>🏢 {campaignContext.company}</span>}
                  {campaignContext.leadStatus && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                      {campaignContext.leadStatus}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                  No messages yet
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-md ${
                        msg.is_from_me
                          ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100'
                      } px-4 py-2.5`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.is_from_me ? 'text-blue-200' : 'text-gray-400'}`}>
                        {formatMessageTime(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Composer */}
            <div className="bg-white border-t border-gray-200 p-3">
              <div className="flex items-end space-x-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendReply()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                  className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Send (Enter)"
                >
                  {isSending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <PaperAirplaneIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 ml-1">
                Enter to send · Shift+Enter for new line · Messages are sent via LinkedIn
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <EnvelopeOpenIcon className="h-14 w-14 mb-3" />
            <p className="text-base font-medium text-gray-500">Select a conversation</p>
            <p className="text-sm mt-1">
              {conversations.length === 0
                ? 'Click "Sync" to pull conversations from LinkedIn'
                : 'Choose a conversation from the left'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
