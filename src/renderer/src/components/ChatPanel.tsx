import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle,
  X,
  Send,
  Plus,
  Search,
  ChevronLeft,
  Hash,
  UserCircle,
  RotateCcw,
  Check,
  Info,
  Calendar,
  LogOut,
  Edit2,
  User,
  UserMinus,
  Users
} from 'lucide-react'
import { createEcho } from '../lib/echo'
import Echo from 'laravel-echo'

interface ChatRoom {
  id: number
  name: string
  type: string
  description?: string
  unread_count: number
  latest_message?: {
    message: string
    user_name: string
    created_at: string
    relative_time?: string
    display_time?: string
  }
  participants_count: number
  created_at: string
}

interface ChatMessage {
  id: number
  message: string
  message_type: string
  metadata?: any
  user: {
    id: number
    name: string
    avatar?: string
  }
  reply_to?: {
    id: number
    message: string
    user_name: string
  }
  is_edited: boolean
  edited_at?: string
  created_at: string
  timestamp: string
  display_time?: string
  relative_time?: string
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  currentUserId?: number
  apiToken?: string
  backendUrl: string
  theme?: 'light' | 'dark'
  playNotificationSound?: (type: 'general' | 'messenger') => void
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  currentUserId,
  apiToken,
  backendUrl,
  theme = 'dark',
  playNotificationSound
}) => {
  const isLight = theme === 'light'

  // Helper to safely format time
  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [typingUsers, setTypingUsers] = useState<{ [key: number]: string }>({})
  const [searchFilter, setSearchFilter] = useState<'all' | 'group' | 'dm'>('all')

  // New chat
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatTab, setNewChatTab] = useState<'dm' | 'group'>('dm')
  const [availableUsers, setAvailableUsers] = useState<
    { id: number; name: string; email: string }[]
  >([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [groupName, setGroupName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | 'owner'>('member')
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showManageParticipants, setShowManageParticipants] = useState(false)
  const [manageParticipantsTab, setManageParticipantsTab] = useState<'add' | 'manage'>('add')
  const [participantsSearch, setParticipantsSearch] = useState('')
  const [availableUsersForAdd, setAvailableUsersForAdd] = useState<any[]>([])
  const [isSearchingAvailable, setIsSearchingAvailable] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const echoRef = useRef<Echo<any> | null>(null)

  // Auto-expand textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px'
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = Math.min(Math.max(36, scrollHeight), 150) + 'px'
    }
  }, [newMessage])

  const loadChatRooms = useCallback(async () => {
    if (!apiToken) return
    try {
      setIsLoading(true)
      const response = await fetch(`${backendUrl}/api/chat-desktop/rooms`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json'
        }
      })
      const data = await response.json()
      if (data.success) {
        setChatRooms(data.data)
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally {
      setIsLoading(false)
    }
  }, [apiToken, backendUrl])

  const loadAvailableUsers = useCallback(async () => {
    if (!apiToken) return
    try {
      const response = await fetch(`${backendUrl}/api/chat-desktop/available-users`, {
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        setAvailableUsers(data.data)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }, [apiToken, backendUrl])

  const loadParticipants = useCallback(async () => {
    if (!apiToken || !selectedRoom) return
    try {
      const response = await fetch(
        `${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/participants`,
        {
          headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }
        }
      )
      const data = await response.json()
      if (data.success) {
        setParticipants(data.data || [])
        // Find current user's role
        const me = data.data.find((p: any) => Number(p.user_id) === Number(currentUserId))
        if (me) setCurrentUserRole(me.role)
      }
    } catch (error) {
      console.error('Error loading participants:', error)
    }
  }, [apiToken, backendUrl, selectedRoom, currentUserId])

  const loadAvailableUsersForAdd = useCallback(async () => {
    if (!apiToken || !selectedRoom) return
    try {
      setIsSearchingAvailable(true)
      const response = await fetch(
        `${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/available-users`,
        {
          headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' }
        }
      )
      const data = await response.json()
      if (data.success) {
        setAvailableUsersForAdd(data.data || [])
      }
    } catch (error) {
      console.error('Error loading available users for add:', error)
    } finally {
      setIsSearchingAvailable(false)
    }
  }, [apiToken, backendUrl, selectedRoom])

  const handleAddMember = async (userId: number) => {
    if (!apiToken || !selectedRoom) return
    try {
      const response = await fetch(
        `${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/add-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          },
          body: JSON.stringify({ user_id: userId, role: 'member' })
        }
      )
      const data = await response.json()
      if (data.success) {
        // Reload participants and available users
        loadParticipants()
        loadAvailableUsersForAdd()
      } else {
        alert(data.error || 'Gagal menambahkan anggota')
      }
    } catch (error) {
      console.error('Error adding member:', error)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!apiToken || !selectedRoom) return
    if (!window.confirm('Apakah Anda yakin ingin menghapus anggota ini?')) return

    try {
      const response = await fetch(
        `${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/remove-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        }
      )
      const data = await response.json()
      if (data.success) {
        // Reload participants
        loadParticipants()
      } else {
        alert(data.error || 'Gagal menghapus anggota')
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleUpdateRoom = async (name: string, description: string) => {
    if (!apiToken || !selectedRoom) return
    try {
      setIsCreating(true)
      const response = await fetch(`${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json'
        },
        body: JSON.stringify({ name, description })
      })
      const data = await response.json()
      if (data.success) {
        // Update local state
        const updated = { ...selectedRoom, name, description }
        setSelectedRoom(updated)
        setChatRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      }
    } catch (error) {
      console.error('Error updating room:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!apiToken || !selectedRoom) return
    if (!window.confirm('Apakah Anda yakin ingin meninggalkan chat ini?')) return

    try {
      setIsLoading(true)
      const response = await fetch(`${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json'
        }
      })
      const data = await response.json()
      if (data.success) {
        const roomId = selectedRoom.id
        setSelectedRoom(null)
        setChatRooms((prev) => prev.filter((r) => r.id !== roomId))
      }
    } catch (error) {
      console.error('Error leaving room:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenNewChat = useCallback(() => {
    setShowNewChat(true)
    setNewChatTab('dm')
    setUserSearch('')
    setSelectedUserIds([])
    setGroupName('')
    loadAvailableUsers()
  }, [loadAvailableUsers])

  const handleCreateDm = useCallback(
    async (userId: number) => {
      if (!apiToken || isCreating) return
      setIsCreating(true)
      try {
        const response = await fetch(`${backendUrl}/api/chat-desktop/dm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        })
        const data = await response.json()
        if (data.success) {
          setShowNewChat(false)
          await loadChatRooms()
          // Find & open the new room
          setSelectedRoom({
            id: data.data.id,
            name: data.data.name,
            type: data.data.type,
            unread_count: 0,
            participants_count: 2,
            created_at: ''
          })
        }
      } catch (error) {
        console.error('Error creating DM:', error)
      } finally {
        setIsCreating(false)
      }
    },
    [apiToken, backendUrl, isCreating, loadChatRooms]
  )

  const handleCreateGroup = useCallback(async () => {
    if (!apiToken || isCreating || !groupName.trim() || selectedUserIds.length === 0) return
    setIsCreating(true)
    try {
      const response = await fetch(`${backendUrl}/api/chat-desktop/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json'
        },
        body: JSON.stringify({ name: groupName.trim(), user_ids: selectedUserIds })
      })
      const data = await response.json()
      if (data.success) {
        setShowNewChat(false)
        await loadChatRooms()
        setSelectedRoom({
          id: data.data.id,
          name: data.data.name,
          type: data.data.type,
          unread_count: 0,
          participants_count: selectedUserIds.length + 1,
          created_at: ''
        })
      }
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setIsCreating(false)
    }
  }, [apiToken, backendUrl, groupName, isCreating, loadChatRooms, selectedUserIds])

  const loadMessages = useCallback(
    async (roomId: number) => {
      if (!apiToken) return
      try {
        const response = await fetch(`${backendUrl}/api/chat-desktop/rooms/${roomId}/messages`, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          }
        })
        const data = await response.json()
        if (data.success) {
          // newest first from API usually, but we want oldest first for display
          const sorted = [...data.data].sort((a, b) => a.id - b.id)
          setMessages(sorted)
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    },
    [apiToken, backendUrl]
  )

  const handleTyping = useCallback(
    async (isTyping: boolean) => {
      if (!selectedRoom || !apiToken) return

      try {
        const endpoint = isTyping ? 'typing/start' : 'typing/stop'
        await fetch(`${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          }
        })
      } catch (error) {
        console.error('Error sending typing indicator:', error)
      }
    },
    [selectedRoom, apiToken, backendUrl]
  )

  const handleInputChange = (val: string) => {
    setNewMessage(val)

    if (!selectedRoom) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (val.trim()) {
      handleTyping(true)
      typingTimeoutRef.current = setTimeout(() => {
        handleTyping(false)
        typingTimeoutRef.current = null
      }, 2000)
    } else {
      handleTyping(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !apiToken) return

    try {
      const response = await fetch(
        `${backendUrl}/api/chat-desktop/rooms/${selectedRoom.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          },
          body: JSON.stringify({
            message: newMessage.trim(),
            message_type: 'text'
          })
        }
      )

      const data = await response.json()
      if (data.success) {
        setNewMessage('')
        if (data.data) {
          setMessages((prev) => [...prev, data.data])
        } else {
          loadMessages(selectedRoom.id)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  useEffect(() => {
    if (isOpen && apiToken) {
      loadChatRooms()
    }
  }, [isOpen, apiToken, loadChatRooms])

  useEffect(() => {
    setShowInfo(false)
    setShowManageParticipants(false)
    setIsEditingInfo(false)
    if (selectedRoom) {
      loadMessages(selectedRoom.id)
      loadParticipants()
    }
  }, [selectedRoom, loadMessages, loadParticipants])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isOpen || !apiToken || !selectedRoom) {
      if (echoRef.current && selectedRoom) {
        console.log(`🔌 Echo: Leaving channel chat-room.${selectedRoom.id}`)
        echoRef.current.leave(`chat-room.${selectedRoom.id}`)
      }
      setTypingUsers({})
      return
    }

    // Always use a fresh Echo if token/url changes to avoid auth issues
    // or if no echo exists yet.
    let echo = echoRef.current

    // If apiToken or backendUrl changed since creation, we need to re-create
    // We can track this in a separate ref if needed, but for now let's just
    // rely on the dependency array re-running this and check if we should disconnect old one.
    if (echo && echo.options.auth.headers.Authorization !== `Bearer ${apiToken}`) {
      console.log('🔌 Echo: apiToken changed, disconnecting old instance')
      echo.disconnect()
      echo = null
      echoRef.current = null
    }

    if (!echo) {
      console.log('🔌 Echo: Creating new instance')
      echo = createEcho(apiToken, backendUrl)
      echoRef.current = echo

      // Connection logging
      // @ts-ignore
      echo.connector.pusher.connection.bind('connected', () => {
        console.log('✅ Echo: Connected to Pusher')
      })
      // @ts-ignore
      echo.connector.pusher.connection.bind('error', (err: any) => {
        console.error('❌ Echo: Connection error', err)
      })
      // @ts-ignore
      echo.connector.pusher.connection.bind('disconnected', () => {
        console.log('🔌 Echo: Disconnected')
      })
    }
    if (!echo) return

    console.log(`🔌 Echo: Joining channel chat-room.${selectedRoom.id}`)
    const channel = echo.private(`chat-room.${selectedRoom.id}`)

    channel.on('pusher:subscription_succeeded', () => {
      console.log(`✅ Echo: Subscribed to chat-room.${selectedRoom.id}`)
    })

    channel.on('pusher:subscription_error', (status: any) => {
      console.error(`❌ Echo: Subscription error for chat-room.${selectedRoom.id}`, status)
    })

    channel.listen('.user.typing', (e: any) => {
      console.log('⌨️ Echo: user.typing event received', e)
      const { user, is_typing, chat_room_id } = e

      if (
        Number(user.id) === Number(currentUserId) ||
        Number(chat_room_id) !== Number(selectedRoom.id)
      ) {
        return
      }

      setTypingUsers((prev) => {
        const updated = { ...prev }
        if (is_typing) {
          updated[user.id] = user.name
        } else {
          delete updated[user.id]
        }
        return updated
      })
    })

    channel.listen('.message.sent', (e: any) => {
      console.log('📩 Echo: message.sent event received', e)
      const msg = e.message
      if (
        Number(msg.user.id) !== Number(currentUserId) &&
        Number(msg.chat_room_id) === Number(selectedRoom.id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => Number(m.id) === Number(msg.id))) {
            console.log('📩 Echo: Skipping duplicate message', msg.id)
            return prev
          }
          // Play sound for incoming message from others
          if (playNotificationSound) {
            playNotificationSound('messenger')
          }
          return [...prev, msg]
        })

        setChatRooms((prev) =>
          prev.map((room) =>
            Number(room.id) === Number(msg.chat_room_id)
              ? {
                ...room,
                latest_message: {
                  message: msg.message,
                  user_name: msg.user.name,
                  created_at: msg.display_time || msg.relative_time || msg.created_at
                }
              }
              : room
          )
        )
      }
    })

    return () => {
      if (echoRef.current && selectedRoom) {
        console.log(`🔌 Echo: Cleanup leaving chat-room.${selectedRoom.id}`)
        echoRef.current.leave(`chat-room.${selectedRoom.id}`)
      }
      setTypingUsers({})
    }
  }, [isOpen, apiToken, selectedRoom, currentUserId, backendUrl])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (echoRef.current) {
        echoRef.current.disconnect()
        echoRef.current = null
      }
    }
  }, [])

  if (!isOpen) return null

  return (
    <div
      style={{
        height: '100%',
        backgroundColor: isLight ? 'white' : 'oklch(0.205 0 0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: isLight ? 'black' : 'white'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        {selectedRoom ? (
          <button
            onClick={() => setSelectedRoom(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          <MessageCircle size={20} style={{ color: 'oklch(0.588 0.158 241.97)' }} />
        )}

        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
            {selectedRoom ? selectedRoom.name : 'Pesan'}
          </h3>
          {!selectedRoom && (
            <span style={{ fontSize: '12px', opacity: 0.6 }}>{chatRooms.length} Percakapan</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {selectedRoom && (
            <button
              onClick={() => {
                const next = !showInfo
                setShowInfo(next)
                if (!next) setShowManageParticipants(false)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: showInfo ? 'oklch(0.588 0.158 241.97)' : 'inherit',
                cursor: 'pointer',
                padding: '4px',
                opacity: showInfo ? 1 : 0.6,
                transition: 'all 0.2s'
              }}
            >
              <Info size={18} />
            </button>
          )}
          {!selectedRoom && (
            <button
              onClick={handleOpenNewChat}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px',
                opacity: 0.6
              }}
            >
              <Plus size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px',
              opacity: 0.6
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', flexDirection: 'column' }}>
        {/* Sliding Info Panel */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            backgroundColor: isLight ? 'white' : 'oklch(0.205 0 0)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            transform: showInfo ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            borderLeft: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)'
          }}
        >
          {/* Info Panel Header */}
          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Info {selectedRoom?.type === 'dm' ? 'Kontak' : 'Grup'}</h4>
            <button
              onClick={() => {
                setShowInfo(false)
                setShowManageParticipants(false)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                opacity: 0.5
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {selectedRoom && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {/* Large Avatar */}
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(0,0,0,0.05)'
                  }}
                >
                  <UserCircle size={48} style={{ opacity: 0.4 }} />
                </div>

                <div style={{ textAlign: 'center', width: '100%' }}>
                  {isEditingInfo ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'transparent',
                        color: 'inherit',
                        fontSize: '16px',
                        fontWeight: '700',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>{selectedRoom.name}</h4>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.5 }}>
                    {selectedRoom.type === 'dm' ? 'Personal Chat' : `${selectedRoom.participants_count} Peserta`}
                  </p>
                </div>

                <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />

                {/* About Section */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.4, textTransform: 'uppercase' }}>Tentang</span>
                    {selectedRoom.type !== 'dm' && (currentUserRole === 'admin' || currentUserRole === 'owner') && (
                      <button
                        onClick={() => {
                          if (isEditingInfo) {
                            handleUpdateRoom(editName, editDescription)
                            setIsEditingInfo(false)
                          } else {
                            setEditName(selectedRoom.name)
                            setEditDescription(selectedRoom.description || '')
                            setIsEditingInfo(true)
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'oklch(0.588 0.158 241.97)',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isEditingInfo ? (
                          <>
                            <Check size={12} /> Simpan
                          </>
                        ) : (
                          <>
                            <Edit2 size={12} /> Edit
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {isEditingInfo ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        borderRadius: '12px',
                        backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'inherit',
                        outline: 'none',
                        resize: 'none'
                      }}
                    />
                  ) : (
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      {selectedRoom.description || (selectedRoom.type === 'dm' ? 'Tidak ada bio' : 'Tidak ada deskripsi')}
                    </div>
                  )}
                </div>

                {/* Date Section */}
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
                  <Calendar size={12} />
                  <span style={{ fontSize: '11px' }}>
                    Dibuat pada {new Date(selectedRoom.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {/* Participants List */}
                {selectedRoom.type !== 'dm' && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.4, textTransform: 'uppercase' }}>Peserta ({participants.length})</span>
                      {(currentUserRole === 'admin' || currentUserRole === 'owner') && (
                        <button
                          onClick={() => {
                            setShowManageParticipants(true)
                            setManageParticipantsTab('add')
                            setParticipantsSearch('')
                            loadAvailableUsersForAdd()
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'oklch(0.588 0.158 241.97)',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={12} /> Kelola
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {participants.map((p) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={16} style={{ opacity: 0.5 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.user_name}</span>
                              {Number(p.user_id) === Number(currentUserId) && (
                                <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', opacity: 0.6 }}>Anda</span>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', opacity: 0.4 }}>{p.user_email}</span>
                          </div>
                          <div style={{
                            fontSize: '9px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            backgroundColor: p.role === 'member' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                            color: p.role === 'member' ? 'inherit' : 'oklch(0.588 0.158 241.97)',
                            border: p.role === 'member' ? '1px solid transparent' : '1px solid rgba(88, 137, 241, 0.2)'
                          }}>
                            {p.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={handleLeaveRoom}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'rgb(239, 68, 68)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <LogOut size={16} />
                    {selectedRoom.type === 'dm' ? 'Hapus Chat' : 'Keluar Grup'}
                  </button>
                  <p style={{ fontSize: '10px', opacity: 0.4, textAlign: 'center', padding: '0 12px' }}>
                    {selectedRoom.type === 'dm'
                      ? 'Chat ini akan dihapus dari daftar chat Anda.'
                      : 'Anda tidak akan lagi menerima pesan dari grup ini.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manage Participants Overlay */}
        {showManageParticipants && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
            onClick={() => setShowManageParticipants(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '450px',
                height: '500px',
                maxHeight: '100%',
                backgroundColor: isLight ? '#fff' : '#1a1a1a',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                animation: 'modalFadeIn 0.3s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Overlay Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Users size={20} style={{ color: 'oklch(0.588 0.158 241.97)' }} />
                  Kelola Participants
                </h3>
                <button
                  onClick={() => setShowManageParticipants(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '8px',
                    opacity: 0.5,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="dropdown-item-hover"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '16px 24px 8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                  <input
                    type="text"
                    placeholder="Search users or participants..."
                    value={participantsSearch}
                    onChange={(e) => setParticipantsSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '12px',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      color: 'inherit',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', padding: '12px 24px', gap: '8px' }}>
                <button
                  onClick={() => setManageParticipantsTab('add')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: manageParticipantsTab === 'add' ? 'oklch(0.588 0.158 241.97)' : 'rgba(255,255,255,0.05)',
                    color: manageParticipantsTab === 'add' ? '#fff' : 'inherit',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Plus size={16} /> Tambah
                </button>
                <button
                  onClick={() => setManageParticipantsTab('manage')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: manageParticipantsTab === 'manage' ? 'oklch(0.588 0.158 241.97)' : 'rgba(255,255,255,0.05)',
                    color: manageParticipantsTab === 'manage' ? '#fff' : 'inherit',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Users size={16} /> Kelola ({participants.length})
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
                {manageParticipantsTab === 'add' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {isSearchingAvailable ? (
                      <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
                        <div className="animate-spin" style={{ display: 'inline-block' }}><RotateCcw size={24} /></div>
                        <p style={{ marginTop: '8px', fontSize: '13px' }}>Memuat users...</p>
                      </div>
                    ) : availableUsersForAdd.filter(u =>
                      u.name.toLowerCase().includes(participantsSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(participantsSearch.toLowerCase())
                    ).length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
                        Tidak ada user tambahan yang tersedia
                      </div>
                    ) : (
                      availableUsersForAdd
                        .filter(u =>
                          u.name.toLowerCase().includes(participantsSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(participantsSearch.toLowerCase())
                        )
                        .map(u => (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }} className="dropdown-item-hover">
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={20} style={{ opacity: 0.5 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                              <div style={{ fontSize: '11px', opacity: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                            <button
                              onClick={() => handleAddMember(u.id)}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                backgroundColor: 'oklch(0.588 0.158 241.97)',
                                color: '#fff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              className="btn-hover"
                            >
                              Tambah
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {participants.filter(p =>
                      p.user_name.toLowerCase().includes(participantsSearch.toLowerCase()) ||
                      p.user_email.toLowerCase().includes(participantsSearch.toLowerCase())
                    ).length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}>
                        Tidak ada participant yang cocok
                      </div>
                    ) : (
                      participants
                        .filter(p =>
                          p.user_name.toLowerCase().includes(participantsSearch.toLowerCase()) ||
                          p.user_email.toLowerCase().includes(participantsSearch.toLowerCase())
                        )
                        .map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }} className="dropdown-item-hover">
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={20} style={{ opacity: 0.5 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.user_name}</span>
                                {Number(p.user_id) === Number(currentUserId) && (
                                  <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', opacity: 0.6 }}>Anda</span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', opacity: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.user_email}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                fontSize: '9px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                backgroundColor: p.role === 'member' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                                color: p.role === 'member' ? 'inherit' : 'oklch(0.588 0.158 241.97)',
                                border: p.role === 'member' ? '1px solid transparent' : '1px solid rgba(88, 137, 241, 0.2)'
                              }}>
                                {p.role}
                              </div>
                              {(currentUserRole === 'admin' || currentUserRole === 'owner') && Number(p.user_id) !== Number(currentUserId) && p.role !== 'owner' && (
                                <button
                                  onClick={() => handleRemoveMember(p.user_id)}
                                  style={{
                                    padding: '8px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: 'rgb(239, 68, 68)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                  className="btn-destructive-hover"
                                >
                                  <UserMinus size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showNewChat && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
            onClick={() => setShowNewChat(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '360px',
                maxHeight: '80%',
                backgroundColor: isLight ? 'white' : 'oklch(0.205 0 0)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* New Chat Header/Tabs */}
              <div
                style={{
                  padding: '16px',
                  borderBottom: isLight
                    ? '1px solid rgba(0,0,0,0.05)'
                    : '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Pesan Baru</h4>
                  <button
                    onClick={() => setShowNewChat(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      opacity: 0.5
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {(['dm', 'group'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setNewChatTab(t)
                        setSelectedUserIds([])
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: newChatTab === t ? '600' : '400',
                        backgroundColor:
                          newChatTab === t
                            ? 'oklch(0.588 0.158 241.97)'
                            : isLight
                              ? 'rgba(0,0,0,0.04)'
                              : 'rgba(255,255,255,0.05)',
                        color: newChatTab === t ? 'white' : 'inherit',
                        transition: 'all 0.2s'
                      }}
                    >
                      {t === 'dm' ? 'Pesan Langsung' : 'Grup Baru'}
                    </button>
                  ))}
                </div>

                {newChatTab === 'group' && (
                  <input
                    type="text"
                    placeholder="Nama Grup"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isLight
                        ? '1px solid rgba(0,0,0,0.1)'
                        : '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: 'transparent',
                      color: 'inherit',
                      fontSize: '13px',
                      outline: 'none',
                      marginBottom: '8px'
                    }}
                  />
                )}

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', opacity: 0.4 }} />
                  <input
                    type="text"
                    placeholder="Cari nama atau email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      border: isLight
                        ? '1px solid rgba(0,0,0,0.05)'
                        : '1px solid rgba(255,255,255,0.05)',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      color: 'inherit',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* User List */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
                {availableUsers
                  .filter(
                    (u) =>
                      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .map((user) => {
                    const isSelected = selectedUserIds.includes(user.id)
                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (newChatTab === 'dm') {
                            handleCreateDm(user.id)
                          } else {
                            setSelectedUserIds((prev) =>
                              isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                            )
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        className="dropdown-item-hover"
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0
                          }}
                        >
                          <UserCircle size={20} style={{ margin: 'auto', opacity: 0.5 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.name}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              opacity: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.email}
                          </div>
                        </div>
                        {newChatTab === 'group' && (
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              border: isSelected
                                ? 'none'
                                : isLight
                                  ? '1px solid rgba(0,0,0,0.2)'
                                  : '1px solid rgba(255,255,255,0.2)',
                              backgroundColor: isSelected
                                ? 'oklch(0.588 0.158 241.97)'
                                : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {isSelected && <Check size={12} color="white" />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                {availableUsers.length === 0 && !isLoading && (
                  <div
                    style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '13px' }}
                  >
                    Tidak ada pengguna ditemukan.
                  </div>
                )}
              </div>

              {/* New Chat Footer */}
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  gap: '8px',
                  borderTop: isLight
                    ? '1px solid rgba(0,0,0,0.05)'
                    : '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <button
                  onClick={() => setShowNewChat(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    color: 'inherit',
                    fontWeight: '500'
                  }}
                >
                  Batal
                </button>
                {newChatTab === 'group' && (
                  <button
                    disabled={isCreating || !groupName.trim() || selectedUserIds.length === 0}
                    onClick={handleCreateGroup}
                    style={{
                      flex: 2,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor:
                        isCreating || !groupName.trim() || selectedUserIds.length === 0
                          ? 'default'
                          : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      backgroundColor:
                        isCreating || !groupName.trim() || selectedUserIds.length === 0
                          ? isLight
                            ? 'rgba(0,0,0,0.1)'
                            : 'rgba(255,255,255,0.1)'
                          : 'oklch(0.588 0.158 241.97)',
                      color:
                        isCreating || !groupName.trim() || selectedUserIds.length === 0
                          ? isLight
                            ? 'rgba(0,0,0,0.4)'
                            : 'rgba(255,255,255,0.4)'
                          : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isCreating ? 'Membuat...' : `Buat Grup (${selectedUserIds.length})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        {selectedRoom ? (
          // Messages View
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {messages.map((msg) => {
                const isMe = msg.user.id === currentUserId
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {!isMe && (
                      <div style={{ fontSize: '11px', opacity: 0.5, marginLeft: '4px' }}>
                        {msg.user.name}
                      </div>
                    )}
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '12px',
                        backgroundColor: isMe
                          ? 'oklch(0.588 0.158 241.97)'
                          : isLight
                            ? 'rgba(0,0,0,0.05)'
                            : 'rgba(255,255,255,0.05)',
                        color: isMe ? 'white' : 'inherit',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        borderBottomRightRadius: isMe ? '2px' : '12px',
                        borderBottomLeftRadius: isMe ? '12px' : '2px'
                      }}
                    >
                      {msg.message}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        opacity: 0.4,
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        margin: '0 4px'
                      }}
                    >
                      {msg.display_time || formatTime(msg.created_at) || msg.relative_time || ''}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {Object.keys(typingUsers).length > 0 && (
              <div
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  opacity: 0.7,
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                  borderTop: isLight
                    ? '1px solid rgba(0,0,0,0.03)'
                    : '1px solid rgba(255,255,255,0.03)'
                }}
              >
                <div className="flex gap-1">
                  <span
                    className="w-1 h-1 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></span>
                  <span
                    className="w-1 h-1 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                  <span
                    className="w-1 h-1 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></span>
                </div>
                <span>{Object.values(typingUsers).join(', ')} sedang mengetik...</span>
              </div>
            )}

            {/* Input Area */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: isLight
                  ? '1px solid rgba(0,0,0,0.05)'
                  : '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <textarea
                  ref={textareaRef}
                  placeholder="Ketik pesan..."
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  style={{
                    flex: 1,
                    height: '36px',
                    minHeight: '36px',
                    maxHeight: '150px',
                    backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                    border: 'none',
                    borderRadius: '18px',
                    padding: '8px 16px',
                    color: 'inherit',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                    overflowY: 'auto',
                    lineHeight: '1.4'
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: newMessage.trim() ? 'oklch(0.588 0.158 241.97)' : 'transparent',
                  color: newMessage.trim() ? 'white' : 'inherit',
                  border: 'none',
                  cursor: newMessage.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  opacity: newMessage.trim() ? 1 : 0.3,
                  marginBottom: '2px'
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          // Rooms List View
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {/* Search input with clear button */}
              <div
                style={{
                  position: 'relative',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  border: chatSearch
                    ? isLight
                      ? '1px solid rgba(0,0,0,0.12)'
                      : '1px solid rgba(255,255,255,0.15)'
                    : '1px solid transparent',
                  transition: 'border-color 0.2s'
                }}
              >
                <Search size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Cari percakapan..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  style={{
                    flex: 1,
                    height: '34px',
                    background: 'none',
                    border: 'none',
                    padding: '0 8px',
                    color: 'inherit',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {chatSearch && (
                  <button
                    onClick={() => setChatSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      opacity: 0.4,
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '50%',
                      flexShrink: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Advanced filter tabs */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'group', 'dm'] as const).map((f) => {
                  const labels = { all: 'Semua', group: 'Grup', dm: 'Pesan Langsung' }
                  const isActive = searchFilter === f
                  return (
                    <button
                      key={f}
                      onClick={() => setSearchFilter(f)}
                      style={{
                        flex: f === 'dm' ? 1.5 : 1,
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: isActive ? '600' : '400',
                        backgroundColor: isActive
                          ? 'oklch(0.588 0.158 241.97)'
                          : isLight
                            ? 'rgba(0,0,0,0.04)'
                            : 'rgba(255,255,255,0.05)',
                        color: isActive ? 'white' : 'inherit',
                        opacity: isActive ? 1 : 0.6,
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {labels[f]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
                  <div className="animate-spin" style={{ marginBottom: '12px' }}>
                    <RotateCcw size={24} />
                  </div>
                  <div style={{ fontSize: '13px' }}>Memuat pesan...</div>
                </div>
              ) : chatRooms.length > 0 ? (
                chatRooms
                  .filter((r) => {
                    const matchesSearch = r.name.toLowerCase().includes(chatSearch.toLowerCase())
                    const matchesFilter =
                      searchFilter === 'all' ||
                      (searchFilter === 'dm' && r.type === 'dm') ||
                      (searchFilter === 'group' && r.type !== 'dm')
                    return matchesSearch && matchesFilter
                  })
                  .map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      className="dropdown-item-hover"
                    >
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {room.type === 'dm' ? (
                          <UserCircle size={24} style={{ opacity: 0.6 }} />
                        ) : (
                          <Hash size={24} style={{ opacity: 0.6 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '2px'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {room.name}
                          </span>
                          {room.latest_message && (
                            <span style={{ fontSize: '11px', opacity: 0.4 }}>
                              {room.latest_message.display_time || formatTime(room.latest_message.created_at)}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              opacity: 0.6,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}
                          >
                            {room.latest_message
                              ? `${room.latest_message.user_name}: ${room.latest_message.message}`
                              : 'Belum ada pesan'}
                          </div>
                          {room.unread_count > 0 && (
                            <div
                              style={{
                                backgroundColor: 'oklch(0.588 0.158 241.97)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                marginLeft: '8px'
                              }}
                            >
                              {room.unread_count}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.5 }}>
                  <MessageCircle size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
                  <div style={{ fontSize: '14px' }}>Tidak ada percakapan</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes RotateCcw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                .animate-spin { animation: RotateCcw 1s linear infinite; display: inline-block; }
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
                .animate-bounce { animation: bounce 0.6s infinite; }
                @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `
        }}
      />
    </div>
  )
}

export default ChatPanel
