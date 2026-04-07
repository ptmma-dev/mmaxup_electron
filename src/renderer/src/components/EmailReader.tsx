import React, { useState, useEffect, useRef } from 'react'
import LoadingOverlay from './LoadingOverlay'
import RichTextEditor from './RichTextEditor'
import RecipientInput from './RecipientInput'
import { toast } from 'sonner'
import {
  Mail,
  RefreshCw,
  Search,
  Inbox,
  Send,
  Archive,
  Trash2,
  Star,
  FileText,
  Plus,
  Reply,
  X,
  Paperclip,
  Edit,
  Download
} from 'lucide-react'
import axios from 'axios'

interface EmailReaderProps {
  visible: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  apiToken: string
  backendUrl: string
}

interface EmailAccount {
  id: number
  provider: string
  type: string
  host: string
  username: string
  is_active: boolean
  password?: string
  port?: number
  signature?: string
}

const actionBtnStyle = (isLight: boolean): React.CSSProperties => ({
  padding: '8px',
  borderRadius: '10px',
  backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s'
})

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '700',
  opacity: 0.6,
  marginLeft: '4px'
}

const inputStyle = (isLight: boolean): React.CSSProperties => ({
  padding: '14px 18px',
  borderRadius: '16px',
  border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
  backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
  color: 'inherit',
  fontSize: '14px',
  outline: 'none',
  transition: 'all 0.2s',
  width: '100%',
  boxSizing: 'border-box'
})

interface Email {
  id: number
  email_account_id: number
  message_id: string
  sender: string
  recipient: string
  subject: string
  bodyPreview: string
  sent_at: string
  folder: string
  folder_path?: string
  is_read: boolean
  cc?: string
  bcc?: string
  uid?: number
  is_starred?: boolean
  has_attachments?: boolean
  attachments_info?: { filename: string; contentType: string; size: number }[]
}

const EmailReader: React.FC<EmailReaderProps> = ({
  visible,
  onClose,
  theme,
  apiToken,
  backendUrl
}) => {
  const [emails, setEmails] = useState<Email[]>([])
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [activeFolder, setActiveFolder] = useState('inbox')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showEditAccount, setShowEditAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeData, setComposeData] = useState<{ to: string; cc: string; bcc: string; subject: string; body: string }>({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  })
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)

  const isLight = theme === 'light'
  const [loading, setLoading] = useState(true)
  const [emailContentLoading, setEmailContentLoading] = useState(false)
  const [fullEmailContent, setFullEmailContent] = useState<{
    html?: string | boolean
    text?: string
    eml?: string
  } | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [viewRaw, setViewRaw] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${backendUrl}/api/email-accounts`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      if (response.data) {
        const fetchedAccounts = Array.isArray(response.data) ? response.data : response.data.data || []
        setAccounts(fetchedAccounts)

        if (fetchedAccounts && fetchedAccounts.length > 0) {
          setSelectedAccount(prev => {
            if (!prev) return fetchedAccounts[0]
            const stillExists = fetchedAccounts.find((a: EmailAccount) => a.id === prev.id)
            return stillExists ? prev : fetchedAccounts[0]
          })
        } else {
          setSelectedAccount(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setTimeout(() => setLoading(false), 800)
    }
  }

  const fetchEmails = async (accountId: number) => {
    try {
      const response = await axios.get(`${backendUrl}/api/emails?email_account_id=${accountId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      const emailList = Array.isArray(response.data) ? response.data : response.data.data || []

      const mappedEmails = emailList.map((e: any) => ({
        ...e,
        bodyPreview: e.subject
      }))
      setEmails(mappedEmails)
    } catch (err) {
      console.error('Failed to fetch emails:', err)
    }
  }

  const markAsRead = async (emailId: number) => {
    try {
      await axios.patch(
        `${backendUrl}/api/emails/${emailId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json'
          }
        }
      )
      if (selectedAccount) {
        fetchEmails(selectedAccount.id)
      }
    } catch (err) {
      console.error('Failed to mark email as read:', err)
    }
  }

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email)
    if (!email.is_read) {
      markAsRead(email.id)
    }
  }

  useEffect(() => {
    if (visible && apiToken) {
      fetchAccounts()
    }
  }, [visible, apiToken])

  useEffect(() => {
    if (selectedAccount) {
      fetchEmails(selectedAccount.id)

      setActiveFolder('inbox')
      setSelectedEmail(null)
      setFullEmailContent(null)

      // Auto-sync every 30 seconds (Pseudo Real-time)
      const interval = setInterval(() => {
        console.log('[EmailReader] Auto-sync triggered')
        handleSync()
      }, 30 * 1000)

      return () => clearInterval(interval)
    }
    return () => { }
  }, [selectedAccount, apiToken, backendUrl])

  const handleSync = async () => {
    console.log('[EmailReader] handleSync triggered')

    if (!navigator.onLine) {
      console.warn('[EmailReader] Sync skipped: Network is offline')
      toast.error('Koneksi internet tidak tersedia', {
        description: 'Silakan periksa jaringan Anda.'
      })
      return
    }

    setSyncing(true)
    try {
      // @ts-ignore
      const result = await window.myMMA.syncEmails(backendUrl, apiToken)
      if (result.success) {
        setLastSync(new Date())
        if (selectedAccount) {
          fetchEmails(selectedAccount.id)
        }
      } else {
        console.error('[EmailReader] Sync error from main process:', result.error)

        // Push to native notification
        // @ts-ignore
        if (window.myMMA.showNotification) {
          // @ts-ignore
          window.myMMA.showNotification('Gagal Sinkronisasi Email', {
            body: result.error
          })
        }

        // Show toast
        toast.error('Gagal Sinkronisasi Email', {
          description: result.error
        })
      }
    } catch (err: any) {
      console.error('[EmailReader] Sync exception in renderer:', err)
      const errorMsg = err.message || 'Terjadi kesalahan saat sinkronisasi.'

      // Push to native notification
      // @ts-ignore
      if (window.myMMA.showNotification) {
        // @ts-ignore
        window.myMMA.showNotification('Kesalahan Sinkronisasi', {
          body: errorMsg
        })
      }

      toast.error('Kesalahan Sinkronisasi', {
        description: errorMsg
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return
    setLoading(true)
    try {
      await axios.delete(`${backendUrl}/api/email-accounts/${id}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      fetchAccounts()
    } catch (err) {
      console.error('Failed to delete account:', err)
      alert('Gagal menghapus akun.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (data: {
    to: string
    cc: string
    bcc: string
    subject: string
    body: string
    attachments: any[]
    isHtml?: boolean
  }) => {
    if (!selectedAccount) return
    setLoading(true)
    try {
      // @ts-ignore
      const result = await window.myMMA.sendEmail(backendUrl, apiToken, selectedAccount.id, { ...data, isHtml: true })
      if (result.success) {
        setShowCompose(false)

        // If this was a draft, delete it from server and backend
        if (currentDraftId && selectedEmail) {
          try {
            // 1. Delete from Backend
            await axios.delete(`${backendUrl}/api/emails/${currentDraftId}`, {
              headers: { Authorization: `Bearer ${apiToken}` }
            })

            // 2. Delete from IMAP
            // @ts-ignore
            if (selectedEmail.uid && selectedEmail.folder_path) {
              await window.myMMA.deleteEmail(
                selectedAccount.id,
                selectedEmail.folder_path,
                selectedEmail.uid
              )
            }
          } catch (cleanupErr) {
            console.error('Failed to cleanup draft after send:', cleanupErr)
          }
        }

        setCurrentDraftId(null)
        handleSync()
      } else {
        alert('Gagal mengirim email: ' + result.error)
      }
    } catch (err) {
      console.error('Send failed:', err)
      alert('Terjadi kesalahan saat mengirim email')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = () => {
    if (!selectedEmail) return
    const signature = selectedAccount?.signature ? `<br><br>--<br>${selectedAccount.signature}` : ''
    const replyBody = `<p></p>${signature}<p>--- Pesan Asli ---</p><p><b>Dari:</b> ${selectedEmail.sender}</p><p><b>Subjek:</b> ${selectedEmail.subject}</p><div style="margin-top: 10px; border-left: 2px solid #ccc; padding-left: 10px;">${fullEmailContent?.html || fullEmailContent?.text || selectedEmail.bodyPreview}</div>`
    setComposeData({
      to: selectedEmail.sender,
      cc: '',
      bcc: '',
      subject: `Re: ${selectedEmail.subject}`,
      body: replyBody
    })
    setCurrentDraftId(null)
    setShowCompose(true)
  }

  const handleToggleStar = async (email: Email) => {
    try {
      // Optimistic UI update
      const newStarredStatus = !email.is_starred
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, is_starred: newStarredStatus } : e))
      )
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_starred: newStarredStatus })
      }

      // 1. Update Backend
      await axios.patch(
        `${backendUrl}/api/emails/${email.id}/star`,
        {},
        {
          headers: { Authorization: `Bearer ${apiToken}` }
        }
      )

      // 2. Update IMAP
      if (selectedAccount && email.uid) {
        // @ts-ignore
        await window.myMMA.updateEmailFlags(
          selectedAccount.id,
          email.folder_path || email.folder,
          email.uid,
          ['\\Starred'],
          newStarredStatus ? 'add' : 'remove'
        )
      }
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  const handleDeleteEmail = async (email: Email) => {
    const isTrash = activeFolder === 'trash'
    const confirmMessage = isTrash ? 'Hapus permanen email ini?' : 'Pindahkan email ini ke Sampah?'

    if (!confirm(confirmMessage)) return

    try {
      // Optimistic UI update
      setEmails((prev) => prev.filter((e) => e.id !== email.id))
      if (selectedEmail?.id === email.id) setSelectedEmail(null)

      if (isTrash) {
        // Permanent Delete from Backend
        await axios.delete(`${backendUrl}/api/emails/${email.id}`, {
          headers: { Authorization: `Bearer ${apiToken}` }
        })

        // Permanent Delete from IMAP
        if (selectedAccount && email.uid) {
          // @ts-ignore
          await window.myMMA.deleteEmail(
            selectedAccount.id,
            email.folder_path || email.folder,
            email.uid
          )
        }
      } else {
        // Move to Trash Backend
        await axios.patch(
          `${backendUrl}/api/emails/${email.id}/folder`,
          { folder: 'trash' },
          {
            headers: { Authorization: `Bearer ${apiToken}` }
          }
        )

        // Move to Trash IMAP
        if (selectedAccount && email.uid) {
          // @ts-ignore
          await window.myMMA.moveEmail(
            selectedAccount.id,
            email.folder_path || email.folder,
            email.uid,
            'trash'
          )
        }
      }
    } catch (err: any) {
      console.error('Failed to delete email:', err)
      const msg = err.response?.data?.message || err.message || 'Unknown error'
      alert(`Gagal menghapus email: ${msg}`)
    }
  }

  const handleArchiveEmail = async (email: Email) => {
    try {
      // Optimistic UI update
      setEmails((prev) => prev.filter((e) => e.id !== email.id))
      if (selectedEmail?.id === email.id) setSelectedEmail(null)

      // 1. Move in Backend
      await axios.patch(
        `${backendUrl}/api/emails/${email.id}/folder`,
        { folder: 'archive' },
        {
          headers: { Authorization: `Bearer ${apiToken}` }
        }
      )

      // 2. Move in IMAP
      if (selectedAccount && email.uid) {
        // @ts-ignore
        await window.myMMA.moveEmail(
          selectedAccount.id,
          email.folder_path || email.folder,
          email.uid,
          'archive'
        )
      }
    } catch (err: any) {
      console.error('Failed to archive email:', err)
      const msg = err.response?.data?.message || err.message || 'Unknown error'
      alert(`Gagal mengarsipkan email: ${msg}`)
    }
  }

  const handleMoveToInbox = async (email: Email) => {
    try {
      // Optimistic UI update
      setEmails((prev) => prev.filter((e) => e.id !== email.id))
      if (selectedEmail?.id === email.id) setSelectedEmail(null)

      // 1. Move in Backend
      await axios.patch(
        `${backendUrl}/api/emails/${email.id}/folder`,
        { folder: 'inbox' },
        {
          headers: { Authorization: `Bearer ${apiToken}` }
        }
      )

      // 2. Move in IMAP
      if (selectedAccount && email.uid) {
        // @ts-ignore
        await window.myMMA.moveEmail(
          selectedAccount.id,
          email.folder_path || email.folder,
          email.uid,
          'inbox'
        )
      }
    } catch (err: any) {
      console.error('Failed to move email to inbox:', err)
      const msg = err.response?.data?.message || err.message || 'Unknown error'
      alert(`Gagal memindahkan email ke Kotak Masuk: ${msg}`)
    }
  }

  const handleSaveDraft = async (data: { to: string; cc: string; bcc: string; subject: string; body: string; isHtml?: boolean }) => {
    if (!selectedAccount) return
    setLoading(true)
    try {
      // @ts-ignore
      const result = await window.myMMA.saveDraft(selectedAccount.id, { ...data, isHtml: true })
      if (result.success) {
        setShowCompose(false)
        handleSync()
      } else {
        alert('Gagal menyimpan draf: ' + result.error)
      }
    } catch (err) {
      console.error('Save draft failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmailContent = async (email: Email) => {
    if (!email) return
    setEmailContentLoading(true)
    setFullEmailContent(null)
    try {
      const response = await axios.get(`${backendUrl}/api/emails/${email.id}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })

      let content = response.data.content
      if (typeof content === 'string') {
        try {
          // Try to parse if it's JSON string (new format)
          const parsed = JSON.parse(content)
          if (parsed && (parsed.html || parsed.text || parsed.eml)) {
            setFullEmailContent(parsed)
          } else {
            // Fallback for old format (raw text/eml)
            setFullEmailContent({ text: content, html: false })
          }
        } catch (e) {
          // Not JSON, treat as raw text
          setFullEmailContent({ text: content, html: false })
        }
      } else {
        setFullEmailContent(content)
      }
    } catch (err) {
      console.error('Failed to fetch email content:', err)
      setFullEmailContent({ text: 'Gagal memuat konten email.', html: false })
    } finally {
      setEmailContentLoading(false)
    }
  }

  useEffect(() => {
    if (selectedEmail) {
      fetchEmailContent(selectedEmail)
      setViewRaw(false)
    }
  }, [selectedEmail])

  useEffect(() => {
    const handleResize = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          const body = iframeRef.current.contentWindow.document.body
          if (body) {
            iframeRef.current.style.height = '0px'
            iframeRef.current.style.height = body.scrollHeight + 50 + 'px'
          }
        } catch (e) {
          console.warn('Iframe resize failed (likely cross-origin):', e)
        }
      }
    }

    const iframe = iframeRef.current
    if (iframe) {
      iframe.addEventListener('load', handleResize)
      // Also attempt resize after a small delay for dynamic content
      setTimeout(handleResize, 500)
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleResize)
      }
    }
  }, [fullEmailContent, viewRaw])

  const handleDownloadAttachment = async (filename: string) => {
    if (!fullEmailContent || !fullEmailContent.eml) {
      alert('Konten asli email belum dimuat atau tidak tersedia.')
      return
    }

    try {
      // @ts-ignore
      const result = await window.myMMA.downloadAttachment(
        backendUrl,
        apiToken,
        fullEmailContent.eml,
        filename
      )
      if (result.success) {
        // @ts-ignore
        if (window.myMMA.showNotification) {
          // @ts-ignore
          window.myMMA.showNotification('Unduhan Berhasil', {
            body: `Berkas ${filename} telah disimpan di folder Downloads.`
          })
        }
        alert(`Berkas disimpan di: ${result.filePath}`)
      } else {
        alert('Gagal mengunduh lampiran: ' + result.error)
      }
    } catch (err) {
      console.error('Download failed:', err)
      alert('Terjadi kesalahan saat mengunduh lampiran.')
    }
  }

  const handleExportEmail = async (email: Email) => {
    if (!fullEmailContent || !fullEmailContent.eml) {
      alert('Konten asli email belum dimuat atau tidak tersedia.')
      return
    }

    try {
      setLoading(true)
      const filename = `${email.subject || 'Email'}`
      // @ts-ignore
      const result = await window.myMMA.exportEmail(
        backendUrl,
        apiToken,
        fullEmailContent.eml,
        filename
      )
      if (result.success) {
        toast.success('Email Berhasil Diekspor', {
          description: `Email telah disimpan di folder Downloads sebagai file .eml`
        })
        // @ts-ignore
        if (window.myMMA.showNotification) {
          // @ts-ignore
          window.myMMA.showNotification('Ekspor Berhasil', {
            body: `Email ${filename} telah disimpan di folder Downloads.`
          })
        }
      } else {
        toast.error('Gagal Mengekspor Email', {
          description: result.error
        })
      }
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Terjadi kesalahan saat mengekspor email')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (filteredEmails.length === 0) {
      toast.error('Tidak ada email untuk diekspor')
      return
    }

    if (!confirm(`Ekspor ${filteredEmails.length} email ke satu file (.mbox) di folder Downloads?`)) return

    setLoading(true)
    try {
      const folderDisplayName = folders.find((f) => f.id === activeFolder)?.name || activeFolder
      const exportData: { emlSource: string; sender: string; sentAt: string }[] = []

      toast.info('Menyiapkan Ekspor Bagian', {
        description: 'Mengambil konten email dari server...'
      })

      for (let i = 0; i < filteredEmails.length; i++) {
        const email = filteredEmails[i]
        try {
          const response = await axios.get(`${backendUrl}/api/emails/${email.id}`, {
            headers: { Authorization: `Bearer ${apiToken}` }
          })
          let content = response.data.content
          let eml = ''

          if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content)
              eml = parsed.eml || content
            } catch (e) {
              eml = content
            }
          } else {
            eml = content.eml || ''
          }

          if (eml) {
            exportData.push({
              emlSource: eml,
              sender: email.sender,
              sentAt: email.sent_at
            })
          }
        } catch (fetchErr) {
          console.error(`Failed to fetch content for email ${email.id}:`, fetchErr)
        }
      }

      if (exportData.length === 0) {
        throw new Error('Gagal mengambil konten email untuk diekspor.')
      }

      // @ts-ignore
      const result = await window.myMMA.exportToMbox(
        backendUrl,
        apiToken,
        exportData,
        folderDisplayName
      )

      if (result.success) {
        toast.success('Ekspor Berhasil', {
          description: `${result.count} email disimpan dalam satu file di folder Downloads.`
        })
        // @ts-ignore
        if (window.myMMA.showNotification) {
          // @ts-ignore
          window.myMMA.showNotification('Ekspor Berhasil', {
            body: `${result.count} email telah disimpan dalam satu file .mbox.`
          })
        }
      } else {
        toast.error('Gagal Ekspor', {
          description: result.error
        })
      }
    } catch (err: any) {
      console.error('Bulk export failed:', err)
      toast.error('Gagal Ekspor', {
        description: err.message || 'Terjadi kesalahan'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null


  const filteredEmails = emails.filter((e) => {
    const matchesSearch =
      (e.subject?.toLowerCase().includes(search.toLowerCase()) ||
        e.sender?.toLowerCase().includes(search.toLowerCase()))

    if (activeFolder === 'starred') {
      return matchesSearch && e.is_starred
    }

    return matchesSearch && e.folder === activeFolder
  })

  const folders = [
    {
      id: 'inbox',
      icon: Inbox,
      name: 'Kotak Masuk',
      count: emails.filter((e) => !e.is_read && e.folder === 'inbox').length
    },
    {
      id: 'sent',
      icon: Send,
      name: 'Terkirim',
      count: emails.filter((e) => !e.is_read && e.folder === 'sent').length
    },
    {
      id: 'drafts',
      icon: FileText,
      name: 'Draf',
      count: emails.filter((e) => !e.is_read && e.folder === 'drafts').length
    },
    {
      id: 'starred',
      icon: Star,
      name: 'Berbintang',
      count: emails.filter((e) => !e.is_read && e.is_starred).length
    },
    {
      id: 'archive',
      icon: Archive,
      name: 'Arsip',
      count: emails.filter((e) => !e.is_read && e.folder === 'archive').length
    },
    {
      id: 'trash',
      icon: Trash2,
      name: 'Sampah',
      count: emails.filter((e) => !e.is_read && e.folder === 'trash').length
    }
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isLight ? 'oklch(0.98 0 0)' : 'oklch(0.145 0 0)',
        zIndex: 10002,
        display: 'flex',
        flexDirection: 'row',
        animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: isLight ? 'oklch(0.145 0 0)' : 'white'
      }}
    >
      <LoadingOverlay visible={loading} message="Menyiapkan Email" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes fadeIn { from { opacity: 0; transform: scale(1.01); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideIn { from { transform: translateX(10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .email-item:hover { background-color: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'}; }
                .folder-item:hover { background-color: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}; }
                .active-folder { background-color: oklch(0.588 0.158 241.97 / 0.1) !important; color: oklch(0.588 0.158 241.97) !important; font-weight: 700; }
                .account-icon:hover { transform: scale(1.1); background-color: oklch(0.588 0.158 241.97 / 0.2) !important; }
                .active-account { border: 2px solid oklch(0.588 0.158 241.97) !important; background-color: oklch(0.588 0.158 241.97 / 0.2) !important; }
                img { max-width: 100%; height: auto; }
            `
        }}
      />

      {/* Pane 1: Account Sidebar (Far Left) */}
      <div
        style={{
          width: '72px',
          borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
          backgroundColor: isLight ? 'oklch(0.96 0 0)' : 'oklch(0.12 0 0)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          gap: '16px'
        }}
      >
        {accounts.map((acc) => {
          const isActive = selectedAccount?.id === acc.id
          const initial = acc.provider.charAt(0).toUpperCase()
          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccount(acc)}
              className={`account-icon ${isActive ? 'active-account' : ''}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: '800',
                lineHeight: '1',
                boxSizing: 'border-box',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative'
              }}
              title={acc.username}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initial}
              </div>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    right: '-12px',
                    width: '4px',
                    height: '24px',
                    borderRadius: '2px',
                    backgroundColor: 'oklch(0.588 0.158 241.97)',
                    animation: 'fadeIn 0.2s'
                  }}
                />
              )}
            </div>
          )
        })}


        <button
          onClick={() => setShowAddAccount(true)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: `2px dashed ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'none',
            color: 'inherit',
            opacity: 0.6,
            marginTop: 'auto'
          }}
          title="Tambah Akun"
        >
          <Plus size={20} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedAccount ? (
          <>
            {/* Header */}
            <div
              style={{
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                WebkitAppRegion: 'drag'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  WebkitAppRegion: 'no-drag'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={20} color="oklch(0.588 0.158 241.97)" />
                  <span style={{ fontWeight: '800', fontSize: '16px' }}>
                    {selectedAccount.username}
                  </span>
                </div>

                <div style={{ position: 'relative', width: '280px', marginLeft: '16px' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      opacity: 0.6
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Cari email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 40px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                      color: isLight ? 'black' : 'white',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  WebkitAppRegion: 'no-drag'
                }}
              >
                <button
                  onClick={() => {
                    const signature = selectedAccount?.signature ? `<br><br>--<br>${selectedAccount.signature}` : ''
                    setComposeData({ to: '', cc: '', bcc: '', subject: '', body: `<p></p>${signature}` })
                    setShowCompose(true)
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'oklch(0.588 0.158 241.97)',
                    color: 'white',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Tulis Pesan
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    style={{
                      backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: syncing ? 'gray' : 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      WebkitAppRegion: 'no-drag',
                      transition: 'all 0.2s'
                    }}
                    title="Sinkronisasi Email"
                  >
                    <RefreshCw
                      size={18}
                      style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}
                    />
                  </button>
                  {lastSync && (
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>
                      {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}

                  <button
                    onClick={onClose}
                    style={{
                      marginLeft: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      WebkitAppRegion: 'no-drag',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      opacity: 0.6
                    }}
                    title="Tutup Panel"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                      e.currentTarget.style.color = '#ef4444'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6'
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'inherit'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
              {/* Pane 2: Folders */}
              <div
                style={{
                  width: '240px',
                  borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                  padding: '16px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)'
                }}
              >

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {folders.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setActiveFolder(f.id)
                        setSelectedEmail(null)
                        setFullEmailContent(null)
                      }}
                      className={`folder-item ${activeFolder === f.id ? 'active-folder' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 16px',
                        margin: '2px 12px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <f.icon size={18} />
                      <span style={{ flex: 1 }}>{f.name}</span>
                      {f.count ? (
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: 'oklch(0.588 0.158 241.97)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: '800'
                          }}
                        >
                          {f.count}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'}`,
                    display: 'flex'
                  }}
                >
                  <button
                    onClick={() => {
                      setEditingAccount(selectedAccount)
                      setShowEditAccount(true)
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '12px',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                      color: 'inherit',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Edit size={14} />
                    Edit Akun
                  </button>
                </div>
              </div>

              {/* Pane 3: Email List */}
              <div
                style={{
                  width: '380px',
                  borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 0
                }}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'}`
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      opacity: 0.6,
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}
                  >
                    {folders.find((f) => f.id === activeFolder)?.name || activeFolder}
                  </span>
                  <span style={{ fontSize: '11px', opacity: 0.4 }}>
                    {filteredEmails.length} pesan
                  </span>
                  <button
                    onClick={handleBulkExport}
                    style={{
                      ...actionBtnStyle(isLight),
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: '800',
                      gap: '4px',
                      opacity: filteredEmails.length > 0 ? 0.7 : 0.2,
                      cursor: filteredEmails.length > 0 ? 'pointer' : 'default'
                    }}
                    disabled={filteredEmails.length === 0 || loading}
                    title="Ekspor Seluruh Email di Folder ini"
                  >
                    <Download size={12} />
                    Ekspor Semua
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredEmails.length === 0 ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.15
                      }}
                    >
                      <Inbox size={48} />
                      <span style={{ fontSize: '13px', marginTop: '12px' }}>Kosong</span>
                    </div>
                  ) : (
                    filteredEmails.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => handleEmailClick(e)}
                        className="email-item"
                        style={{
                          padding: '20px 24px',
                          cursor: 'pointer',
                          borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'}`,
                          borderLeft:
                            selectedEmail?.id === e.id
                              ? '4px solid oklch(0.588 0.158 241.97)'
                              : !e.is_read
                                ? '4px solid oklch(0.588 0.158 241.97 / 0.5)'
                                : '4px solid transparent',
                          backgroundColor:
                            selectedEmail?.id === e.id
                              ? isLight
                                ? 'rgba(0,0,0,0.02)'
                                : 'rgba(255,255,255,0.02)'
                              : !e.is_read
                                ? isLight
                                  ? 'rgba(59,130,246,0.04)'
                                  : 'rgba(59,130,246,0.06)'
                                : 'transparent',
                          animation: 'slideIn 0.2s ease-out',
                          position: 'relative'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: e.is_read ? '500' : '800',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '180px'
                            }}
                          >
                            {e.sender?.split('<')[0].replace(/"/g, '').trim()}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', opacity: 0.6 }}>
                              {new Date(e.sent_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {!e.is_read && (
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: 'oklch(0.588 0.158 241.97)',
                                  flexShrink: 0,
                                  boxShadow: '0 0 6px oklch(0.588 0.158 241.97 / 0.6)'
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: e.is_read ? '400' : '700',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {e.subject}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            opacity: 0.7,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {e.bodyPreview}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pane 4: Reader */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
                  minWidth: 0,
                  minHeight: 0
                }}
              >
                {selectedEmail ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      animation: 'fadeIn 0.2s ease-in',
                      minHeight: 0
                    }}
                  >
                    <div
                      style={{
                        padding: '32px',
                        borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`
                      }}
                    >
                      <h1
                        style={{
                          fontSize: '26px',
                          margin: '0 0 24px 0',
                          fontWeight: '900',
                          letterSpacing: '-0.5px'
                        }}
                      >
                        {selectedEmail.subject}
                      </h1>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        {(() => {
                          const senderStr = selectedEmail.sender || ''
                          const nameMatch = senderStr.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+)>?)$/)
                          const displayName =
                            (nameMatch ? nameMatch[1] : senderStr.split('<')[0])
                              ?.replace(/"/g, '')
                              .trim() || senderStr
                          const displayEmail = nameMatch
                            ? nameMatch[2]
                            : senderStr.includes('<')
                              ? senderStr.split('<')[1].replace('>', '')
                              : ''
                          const initial = displayName.charAt(0).toUpperCase()

                          return (
                            <>
                              <div
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '14px',
                                  backgroundColor: 'oklch(0.588 0.158 241.97)',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '20px',
                                  fontWeight: '800'
                                }}
                              >
                                {initial}
                              </div>
                              <div style={{ flex: 1, marginLeft: '16px' }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '4px'
                                  }}
                                >
                                  <span style={{ fontWeight: '700', fontSize: '15px' }}>
                                    {displayName}
                                  </span>
                                  {displayEmail && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: isLight
                                          ? 'rgba(0,0,0,0.05)'
                                          : 'rgba(255,255,255,0.1)',
                                        opacity: 0.8
                                      }}
                                    >
                                      {displayEmail}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', opacity: 0.5 }}>
                                  {new Date(selectedEmail.sent_at).toLocaleString()}
                                </div>
                              </div>
                            </>
                          )
                        })()}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleExportEmail(selectedEmail)}
                            style={actionBtnStyle(isLight)}
                            title="Ekspor ke .eml (Outlook)"
                            disabled={loading || emailContentLoading}
                          >
                            <Download size={18} />
                          </button>
                          {activeFolder === 'drafts' ? (
                            <button
                              onClick={() => {
                                setComposeData({
                                  to: selectedEmail.recipient || '',
                                  cc: selectedEmail.cc || '',
                                  bcc: selectedEmail.bcc || '',
                                  subject: selectedEmail.subject || '',
                                  body: (selectedEmail as any).content_html || fullEmailContent?.html || fullEmailContent?.text || selectedEmail.bodyPreview || ''
                                })
                                setCurrentDraftId(selectedEmail.id)
                                setShowCompose(true)
                              }}
                              disabled={emailContentLoading}
                              style={{
                                ...actionBtnStyle(isLight),
                                padding: '8px 16px',
                                backgroundColor: 'oklch(0.6 0.18 250)',
                                color: 'white',
                                opacity: emailContentLoading ? 0.6 : 1,
                                fontWeight: '600',
                                fontSize: '13px',
                                gap: '6px',
                                borderRadius: '30px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                border: 'none',
                                alignItems: 'center',
                                display: 'inline-flex',
                                justifyContent: 'center'
                              }}
                            >
                              <Edit size={16} />
                              {emailContentLoading ? 'Memuat...' : 'Lanjutkan Menulis'}
                            </button>
                          ) : (
                            <button
                              onClick={handleReply}
                              style={actionBtnStyle(isLight)}
                              title="Balas"
                            >
                              <Reply size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStar(selectedEmail)}
                            style={{
                              ...actionBtnStyle(isLight),
                              color: selectedEmail.is_starred
                                ? '#f59e0b'
                                : isLight
                                  ? 'black'
                                  : 'white',
                              opacity: selectedEmail.is_starred ? 1 : 0.6
                            }}
                            title={selectedEmail.is_starred ? 'Hapus Bintang' : 'Beri Bintang'}
                          >
                            <Star
                              size={18}
                              fill={selectedEmail.is_starred ? 'currentColor' : 'none'}
                            />
                          </button>
                          {activeFolder !== 'archive' && (
                            <button
                              onClick={() => handleArchiveEmail(selectedEmail)}
                              style={actionBtnStyle(isLight)}
                              title="Arsipkan"
                            >
                              <Archive size={18} />
                            </button>
                          )}
                          {(activeFolder === 'archive' || activeFolder === 'trash') && (
                            <button
                              onClick={() => handleMoveToInbox(selectedEmail)}
                              style={actionBtnStyle(isLight)}
                              title="Pindahkan ke Kotak Masuk"
                            >
                              <Inbox size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEmail(selectedEmail)}
                            style={actionBtnStyle(isLight)}
                            title={activeFolder === 'trash' ? 'Hapus Permanen' : 'Hapus (Sampah)'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: '40px',
                        overflowY: 'auto',
                        lineHeight: '1.7',
                        fontSize: '16px'
                      }}
                    >
                      {emailContentLoading ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '100px 0',
                            opacity: 0.5
                          }}
                        >
                          <RefreshCw
                            size={32}
                            style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }}
                          />
                          <span>Memuat konten email...</span>
                        </div>
                      ) : fullEmailContent ? (
                        <div style={{ position: 'relative' }}>
                          {/* Toggle View Mode */}
                          {fullEmailContent.html && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                marginBottom: '12px'
                              }}
                            >
                              <button
                                onClick={() => setViewRaw(!viewRaw)}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: isLight
                                    ? 'rgba(0,0,0,0.05)'
                                    : 'rgba(255,255,255,0.05)',
                                  border: 'none',
                                  cursor: 'pointer',
                                  opacity: 0.7,
                                  color: 'inherit'
                                }}
                              >
                                {viewRaw ? 'Lihat Teks Saja' : 'Lihat Tampilan Desain'}
                              </button>
                            </div>
                          )}

                          {fullEmailContent.html && !viewRaw ? (
                            <iframe
                              ref={iframeRef}
                              srcDoc={`
                                                           <html>
                                                               <head>
                                                                   <style>
                                                                       body { 
                                                                           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                                                           margin: 0; padding: 0; 
                                                                           color: ${isLight ? '#000' : '#fff'};
                                                                           line-height: 1.6;
                                                                       }
                                                                       img { max-width: 100%; height: auto; }
                                                                       * { box-sizing: border-box; }
                                                                   </style>
                                                               </head>
                                                               <body>${fullEmailContent.html}</body>
                                                           </html>
                                                       `}
                              style={{
                                width: '100%',
                                border: 'none',
                                display: 'block',
                                overflow: 'hidden'
                              }}
                              title="Email Content"
                            />
                          ) : (
                            <div
                              style={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                                padding: '24px',
                                borderRadius: '16px'
                              }}
                            >
                              {fullEmailContent.text || fullEmailContent.eml || 'Konten kosong'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{selectedEmail.bodyPreview}</div>
                      )}

                      {/* Attachments Section */}
                      {selectedEmail.attachments_info && selectedEmail.attachments_info.length > 0 && (
                        <div
                          style={{
                            marginTop: '40px',
                            paddingTop: '32px',
                            borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '20px',
                              opacity: 0.6
                            }}
                          >
                            <Paperclip size={18} />
                            <h3
                              style={{
                                fontSize: '15px',
                                fontWeight: '800',
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}
                            >
                              {selectedEmail.attachments_info.length} Lampiran
                            </h3>
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: '16px'
                            }}
                          >
                            {selectedEmail.attachments_info.map((att: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '16px',
                                  borderRadius: '16px',
                                  backgroundColor: isLight
                                    ? 'rgba(0,0,0,0.03)'
                                    : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div
                                    style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '10px',
                                      backgroundColor: isLight ? 'white' : 'rgba(255,255,255,0.05)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                    }}
                                  >
                                    <FileText size={20} style={{ opacity: 0.6 }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {att.filename}
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.4 }}>
                                      {(att.size / 1024).toFixed(1)} KB
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadAttachment(att.filename)}
                                  style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '10px',
                                    backgroundColor: isLight ? 'black' : 'white',
                                    color: isLight ? 'white' : 'black',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    opacity: 0.9,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  Unduh
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.2
                    }}
                  >
                    <Mail size={80} strokeWidth={1} />
                    <h2
                      style={{
                        marginTop: '24px',
                        fontSize: '20px',
                        fontWeight: '800',
                        letterSpacing: '-0.5px'
                      }}
                    >
                      Pilih email untuk dibaca
                    </h2>
                    <p style={{ marginTop: '8px', fontSize: '14px' }}>
                      Pilih pesan dari daftar di sebelah kiri
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              backgroundColor: isLight ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)',
              position: 'relative'
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                WebkitAppRegion: 'no-drag',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: 0.6
              }}
              title="Tutup Panel"
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = '#ef4444'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6'
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'inherit'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <X size={22} />
            </button>
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '40px',
                backgroundColor: 'oklch(0.588 0.158 241.97)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '32px',
                boxShadow: '0 20px 40px rgba(94, 92, 230, 0.2)',
                animation: 'float 6s ease-in-out infinite'
              }}
            >
              <Mail size={60} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '16px' }}>
              Selamat Datang
            </h2>
            <p
              style={{
                fontSize: '16px',
                opacity: 0.6,
                maxWidth: '400px',
                textAlign: 'center',
                lineHeight: '1.6',
                marginBottom: '40px'
              }}
            >
              Hubungkan akun email Anda untuk mulai mengelola pesan dengan cara yang lebih modern
              dan efisien.
            </p>
            <button
              onClick={() => setShowAddAccount(true)}
              style={{
                padding: '16px 32px',
                borderRadius: '20px',
                backgroundColor: 'oklch(0.588 0.158 241.97)',
                color: 'white',
                border: 'none',
                fontSize: '16px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 10px 20px rgba(94, 92, 230, 0.15)'
              }}
            >
              <Plus size={20} />
              Tambah Akun Baru
            </button>
          </div>
        )}
      </div>

      {/* Modals outside everything except the flex container */}
      {
        showAddAccount && (
          <AddAccountModal
            onClose={() => setShowAddAccount(false)}
            onSuccess={async () => {
              setShowAddAccount(false)
              await fetchAccounts()
            }}
            isLight={isLight}
            backendUrl={backendUrl}
            apiToken={apiToken}
          />
        )
      }

      {
        showEditAccount && editingAccount && (
          <EditAccountModal
            isLight={isLight}
            onClose={() => {
              setShowEditAccount(false)
              setEditingAccount(null)
            }}
            onSuccess={() => {
              setShowEditAccount(false)
              setEditingAccount(null)
              fetchAccounts() // Refresh list
            }}
            onDelete={(id: number) => {
              setShowEditAccount(false)
              setEditingAccount(null)
              handleDeleteAccount(id)
            }}
            account={editingAccount}
            backendUrl={backendUrl}
            apiToken={apiToken}
          />
        )
      }

      {
        showCompose && (
          <ComposeModal
            initialData={composeData}
            onClose={() => {
              setShowCompose(false)
              setCurrentDraftId(null)
            }}
            onSend={handleSendEmail}
            onSaveDraft={handleSaveDraft}
            loading={loading}
            isLight={isLight}
          />
        )
      }
    </div >
  )
}



const AddAccountModal = ({ isLight, onClose, onSuccess, backendUrl, apiToken }: any) => {
  const [formData, setFormData] = useState({
    provider: '',
    type: 'imap',
    host: '',
    port: 993,
    username: '',
    password: '',
    smtp_host: '',
    smtp_port: 465,
    smtp_encryption: 'ssl',
    signature: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post(`${backendUrl}/api/email-accounts`, formData, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      onSuccess()
    } catch (err) {
      console.error('Failed to add account:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(24px)',
        zIndex: 10004,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
        padding: '24px'
      }}
    >
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        style={{
          width: '540px',
          maxHeight: '90vh',
          backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
          borderRadius: '32px',
          padding: '32px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
          margin: 'auto'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'oklch(0.588 0.158 241.97 / 0.15)',
                color: 'oklch(0.588 0.158 241.97)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Mail size={22} strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.8px', margin: 0 }}>
              Tambah Akun Baru
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.4,
              color: 'inherit',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            paddingRight: '12px',
            flex: 1,
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth'
          }}
        >
          {/* Dummy inputs to trap autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Nama Akun / Label</label>
            <input
              type="text"
              name="account_label_unique"
              placeholder="Contoh: Gmail, Kerja, Email Kantor, dll"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              style={inputStyle(isLight)}
              required
              autoComplete="one-time-code"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Tipe Protokol</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const type = e.target.value
                setFormData({
                  ...formData,
                  type,
                  port: type === 'imap' ? 993 : 995
                })
              }}
              style={{
                ...inputStyle(isLight),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${isLight ? 'black' : 'white'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option
                value="imap"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                IMAP (Recommended)
              </option>
              <option
                value="pop3"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                POP3
              </option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Username / Alamat Email</label>
            <input
              type="email"
              name="user_email_unique"
              placeholder="nama@email.com"
              value={formData.username}
              onChange={(e) => {
                const email = e.target.value
                const domain = email.split('@')[1]
                let updates: any = { username: email }

                if (domain && domain.includes('.')) {
                  // Popular Providers
                  if (domain === 'gmail.com') {
                    updates.host = formData.type === 'imap' ? 'imap.gmail.com' : 'pop.gmail.com'
                    updates.smtp_host = 'smtp.gmail.com'
                  } else if (
                    domain === 'outlook.com' ||
                    domain === 'hotmail.com' ||
                    domain === 'live.com'
                  ) {
                    updates.host =
                      formData.type === 'imap' ? 'outlook.office365.com' : 'outlook.office365.com' // POP3 is also outlook.office365.com usually
                    updates.smtp_host = 'smtp.office365.com'
                  } else if (domain === 'yahoo.com') {
                    updates.host =
                      formData.type === 'imap' ? 'imap.mail.yahoo.com' : 'pop.mail.yahoo.com'
                    updates.smtp_host = 'smtp.mail.yahoo.com'
                  } else {
                    // Default to protocol prefix
                    updates.host = `${formData.type === 'imap' ? 'imap' : 'pop'}.${domain}`
                    updates.smtp_host = `smtp.${domain}`
                  }
                }

                setFormData({ ...formData, ...updates })
              }}
              style={inputStyle(isLight)}
              required
              autoComplete="one-time-code"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Password / App Password</label>
            <input
              type="password"
              name="user_pass_unique"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={inputStyle(isLight)}
              required
              autoComplete="new-password"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 140px',
              gap: '20px',
              alignItems: 'end'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Host POP3/IMAP</label>
              <input
                type="text"
                placeholder="pop.gmail.com"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                style={inputStyle(isLight)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                style={inputStyle(isLight)}
                required
              />
            </div>
          </div>

          <div
            style={{
              height: '1px',
              backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
              margin: '4px 0',
              flexShrink: 0
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Enkripsi SMTP</label>
            <select
              value={formData.smtp_encryption}
              onChange={(e) => {
                const encryption = e.target.value
                setFormData({
                  ...formData,
                  smtp_encryption: encryption,
                  smtp_port: encryption === 'ssl' ? 465 : 587
                })
              }}
              style={{
                ...inputStyle(isLight),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${isLight ? 'black' : 'white'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px',
                color: isLight ? 'black' : 'white',
                backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)'
              }}
            >
              <option
                value="ssl"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                SSL (Port 465)
              </option>
              <option
                value="tls"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                TLS (Port 587)
              </option>
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 140px',
              gap: '20px',
              alignItems: 'end'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Host SMTP (Kirim)</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                style={inputStyle(isLight)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>SMTP Port</label>
              <input
                type="number"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                style={inputStyle(isLight)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Tanda Tangan (Signature)</label>
            <RichTextEditor
              content={formData.signature}
              onChange={(content) => setFormData({ ...formData, signature: content })}
              isLight={isLight}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
              color: 'inherit',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '13px'
            }}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1.5,
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'oklch(0.588 0.158 241.97)',
              color: 'white',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px oklch(0.588 0.158 241.97 / 0.15)'
            }}
          >
            {loading ? 'Menyambungkan...' : 'Simpan Akun'}
          </button>
        </div>
      </form>
    </div>
  )
}

const EditAccountModal = ({
  isLight,
  onClose,
  onSuccess,
  onDelete,
  backendUrl,
  apiToken,
  account
}: any) => {
  const [formData, setFormData] = useState({
    provider: account?.provider || '',
    type: account?.type || 'imap',
    host: account?.host || '',
    port: account?.port || 993,
    username: account?.username || '',
    password: account?.password || '',
    smtp_host: account?.smtp_host || '',
    smtp_port: account?.smtp_port || 465,
    smtp_encryption: account?.smtp_encryption || 'ssl',
    signature: account?.signature || ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.put(`${backendUrl}/api/email-accounts/${account.id}`, formData, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      onSuccess()
    } catch (err) {
      console.error('Failed to update account:', err)
      alert('Gagal memperbarui akun. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(24px)',
        zIndex: 10004,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
        padding: '24px'
      }}
    >
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        style={{
          width: '540px',
          maxHeight: '90vh',
          backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
          borderRadius: '32px',
          padding: '32px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
          margin: 'auto'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'oklch(0.588 0.158 241.97 / 0.15)',
                color: 'oklch(0.588 0.158 241.97)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Edit size={22} strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.8px', margin: 0 }}>
              Edit Akun
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.4,
              color: 'inherit',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            paddingRight: '12px',
            flex: 1,
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Nama Akun / Label</label>
            <input
              type="text"
              placeholder="Contoh: Gmail, Kerja, Email Kantor, dll"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              style={inputStyle(isLight)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Tipe Protokol</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const type = e.target.value
                setFormData({
                  ...formData,
                  type,
                  port: type === 'imap' ? 993 : 995
                })
              }}
              style={{
                ...inputStyle(isLight),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${isLight ? 'black' : 'white'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option
                value="imap"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                IMAP (Recommended)
              </option>
              <option
                value="pop3"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                POP3
              </option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Username / Alamat Email</label>
            <input
              type="email"
              placeholder="nama@email.com"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              style={inputStyle(isLight)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Tanda Tangan (Signature)</label>
            <RichTextEditor
              content={formData.signature}
              onChange={(content) => setFormData({ ...formData, signature: content })}
              isLight={isLight}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Password / App Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={inputStyle(isLight)}
              required
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 140px',
              gap: '20px',
              alignItems: 'end'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Host {formData.type.toUpperCase()}</label>
              <input
                type="text"
                placeholder={formData.type === 'imap' ? 'imap.gmail.com' : 'pop.gmail.com'}
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                style={inputStyle(isLight)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                style={inputStyle(isLight)}
                required
              />
            </div>
          </div>

          <div
            style={{
              height: '1px',
              backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
              margin: '4px 0',
              flexShrink: 0
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>Enkripsi SMTP</label>
            <select
              value={formData.smtp_encryption}
              onChange={(e) => {
                const encryption = e.target.value
                setFormData({
                  ...formData,
                  smtp_encryption: encryption,
                  smtp_port: encryption === 'ssl' ? 465 : 587
                })
              }}
              style={{
                ...inputStyle(isLight),
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${isLight ? 'black' : 'white'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px'
              }}
            >
              <option
                value="ssl"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                SSL (Port 465)
              </option>
              <option
                value="tls"
                style={{
                  backgroundColor: isLight ? 'white' : '#2d2d2d',
                  color: isLight ? 'black' : 'white'
                }}
              >
                TLS (Port 587)
              </option>
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 140px',
              gap: '20px',
              alignItems: 'end'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>Host SMTP (Kirim)</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                style={inputStyle(isLight)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={labelStyle}>SMTP Port</label>
              <input
                type="number"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                style={inputStyle(isLight)}
                required
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm('Apakah Anda yakin ingin menghapus akun ini beserta semua datanya?')
              ) {
                onDelete(account.id)
              }
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Trash2 size={16} />
            Hapus
          </button>
          <div style={{ flex: 2, display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)',
                color: 'inherit',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px'
              }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1.5,
                padding: '14px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: 'oklch(0.588 0.158 241.97)',
                color: 'white',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 8px 16px oklch(0.588 0.158 241.97 / 0.25)'
              }}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

const ComposeModal = ({ isLight, initialData, onClose, onSend, onSaveDraft, loading }: any) => {
  const [data, setData] = useState(initialData)
  const [showCc, setShowCc] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; size: number; data: string }[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1]
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            data: base64
          }
        ])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(24px)',
        zIndex: 10004,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '700px',
          backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxSizing: 'border-box',
          maxHeight: '90vh'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.8px', margin: 0 }}>
            Tulis Email
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.4,
              color: 'inherit'
            }}
          >
            <X size={26} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flex: 1,
            overflowY: 'auto',
            paddingRight: '12px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
              paddingBottom: '12px'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '700', width: '60px', opacity: 0.5 }}>
              Ke:
            </span>
            <RecipientInput
              value={data.to}
              onChange={(val) => setData({ ...data, to: val })}
              placeholder="penerima@email.com"
              isLight={isLight}
            />
            <button
              onClick={() => setShowCc(!showCc)}
              style={{
                background: 'none',
                border: 'none',
                color: 'oklch(0.588 0.158 241.97)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                opacity: 0.8
              }}
            >
              {showCc ? 'Sembunyikan' : 'Cc/Bcc'}
            </button>
          </div>

          {showCc && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                  paddingBottom: '12px'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '700', width: '60px', opacity: 0.5 }}>
                  Cc:
                </span>
                <RecipientInput
                  value={data.cc}
                  onChange={(val) => setData({ ...data, cc: val })}
                  placeholder="cc@email.com"
                  isLight={isLight}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                  paddingBottom: '12px'
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '700', width: '60px', opacity: 0.5 }}>
                  Bcc:
                </span>
                <RecipientInput
                  value={data.bcc}
                  onChange={(val) => setData({ ...data, bcc: val })}
                  placeholder="bcc@email.com"
                  isLight={isLight}
                />
              </div>
            </>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
              paddingBottom: '12px'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '700', width: '60px', opacity: 0.5 }}>
              Subjek:
            </span>
            <input
              type="text"
              placeholder="Subjek email"
              value={data.subject}
              onChange={(e) => setData({ ...data, subject: e.target.value })}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: 'inherit',
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px 0' }}>
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  <Paperclip size={14} />
                  <span
                    style={{
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {file.name}
                  </span>
                  <span style={{ opacity: 0.4, fontWeight: '400' }}>
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0.5,
                      color: '#ef4444',
                      marginLeft: '4px'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <RichTextEditor
              content={data.body}
              onChange={(html) => setData({ ...data, body: html })}
              isLight={isLight}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                color: 'inherit',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'
              }}
            >
              <Paperclip size={18} />
              Lampirkan File
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'inherit',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Batal
            </button>
            <button
              onClick={() => onSaveDraft(data)}
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: 'transparent',
                color: 'inherit',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Menyimpan...' : 'Simpan Draf'}
            </button>
            <button
              onClick={() => onSend({ ...data, attachments })}
              disabled={loading}
              style={{
                padding: '10px 32px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'oklch(0.588 0.158 241.97)',
                color: 'white',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Send size={16} />
              {loading ? 'Mengirim...' : 'Kirim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailReader
