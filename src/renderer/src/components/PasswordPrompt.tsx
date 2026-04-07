import React, { useState } from 'react'
import axios from 'axios'
import { X, Lock, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'

interface PasswordPromptProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  userEmail: string
  backendUrl: string
  theme?: 'light' | 'dark'
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  visible,
  onClose,
  onSuccess,
  userEmail,
  backendUrl,
  theme = 'dark'
}) => {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${backendUrl}/api/auth/shell-login`, {
        email: userEmail,
        password: password
      })

      if (response.data.token) {
        onSuccess()
      }
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        setError('Password salah. Silakan coba lagi.')
      } else {
        setError('Gagal memverifikasi. Periksa koneksi Anda.')
      }
    } finally {
      setLoading(false)
    }
  }

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
        zIndex: 11000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '400px',
          backgroundColor: isLight ? '#fff' : 'oklch(0.25 0 0)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: `1px solid ${borderColor}`,
          overflow: 'hidden',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-20px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: textColor,
              opacity: 0.5,
              padding: '8px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px'
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              backgroundColor: 'oklch(0.588 0.158 241.97 / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'oklch(0.588 0.158 241.97)',
              boxShadow: '0 8px 16px -4px oklch(0.588 0.158 241.97 / 0.1)'
            }}
          >
            <ShieldCheck size={32} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: textColor }}>
              Verifikasi Keamanan
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.6, color: textColor }}>
              Masukkan kata sandi login Anda untuk melanjutkan
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '12px', opacity: 0.5, color: textColor }}
              />
              <input
                type="password"
                placeholder="Kata Sandi Login"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  borderRadius: '12px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                  color: textColor,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                color: '#ef4444',
                fontSize: '12px'
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'oklch(0.588 0.158 241.97)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: loading || !password ? 'default' : 'pointer',
              opacity: loading || !password ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Buka Kunci'}
          </button>
        </form>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `
        }}
      />
    </div>
  )
}

export default PasswordPrompt
