import React, { useEffect, useState } from 'react'
import { X, Trash2, Eye, EyeOff, KeyRound, Search, ShieldAlert } from 'lucide-react'

interface Credential {
  id: string
  domain: string
  username: string
  password?: string
}

interface CredentialsManagerProps {
  visible: boolean
  onClose: () => void
  theme?: 'light' | 'dark'
}

const CredentialsManager: React.FC<CredentialsManagerProps> = ({
  visible,
  onClose,
  theme = 'dark'
}) => {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({})

  // Fetch credentials when opened
  useEffect(() => {
    if (visible) {
      fetchCredentials()
    }
  }, [visible])

  const fetchCredentials = async () => {
    setLoading(true)
    try {
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        const data = await window.electron.ipcRenderer.invoke('credentials:get')
        setCredentials(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (cred: Credential) => {
    if (!confirm(`Hapus penyimpanan sandi untuk ${cred.username} di ${cred.domain}?`)) return

    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('credentials:delete', {
        domain: cred.domain,
        username: cred.username
      })

      if (result.success) {
        setCredentials((prev) => prev.filter((c) => c.id !== cred.id))
      }
    } catch (error) {
      console.error('Failed to delete credential:', error)
    }
  }

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredCredentials = credentials.filter(
    (c) =>
      c.domain.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase())
  )

  if (!visible) return null

  const isLight = theme === 'light'
  const textColor = isLight ? 'black' : 'white'
  const borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(5px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '600px',
          height: '500px',
          backgroundColor: isLight ? '#fff' : 'oklch(0.25 0 0)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: `1px solid ${borderColor}`,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLight ? '#000' : '#fff'
              }}
            >
              <KeyRound size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: textColor }}>
                Sandi Tersimpan
              </h2>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.6, color: textColor }}>
                Kelola akun login aplikasi Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: textColor,
              opacity: 0.5,
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderColor}` }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', opacity: 0.5, color: textColor }}
            />
            <input
              type="text"
              placeholder="Cari domain atau username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 40px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                color: textColor,
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5, color: textColor }}>
              Memuat data...
            </div>
          ) : filteredCredentials.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                opacity: 0.5,
                color: textColor,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <ShieldAlert size={48} opacity={0.3} />
              <div>Belum ada sandi yang tersimpan</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredCredentials.map((cred) => (
                <div
                  key={cred.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'background-color 0.2s'
                  }}
                  className="credential-item"
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: `oklch(0.6 0.15 ${stringToColor(cred.domain)} / 0.2)`,
                      color: `oklch(0.7 0.15 ${stringToColor(cred.domain)})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}
                  >
                    {cred.domain.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: textColor }}>
                      {cred.domain}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7, color: textColor }}>
                      {cred.username}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: textColor,
                        minWidth: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span>{visiblePasswords[cred.id] ? cred.password : '••••••••'}</span>
                      <button
                        onClick={() => togglePassword(cred.id)}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          opacity: 0.6,
                          color: textColor
                        }}
                      >
                        {visiblePasswords[cred.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(cred)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8
                      }}
                      title="Hapus Sandi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .credential-item:hover {
                    background-color: ${isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'};
                }
            `
        }}
      />
    </div>
  )
}

// Helper to generate consistent colors from strings
function stringToColor(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export default CredentialsManager
