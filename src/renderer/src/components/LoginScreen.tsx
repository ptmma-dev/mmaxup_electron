import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  User,
  ChevronRight,
  Minus,
  Square,
  X
} from 'lucide-react'
import { APP_LOGO } from '../constants'

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: any) => void
  backendUrl: string
}

interface SavedAccount {
  id: string
  username: string
  password?: string
  domain: string
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, backendUrl }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
  const [showManualForm, setShowManualForm] = useState(true)
  const [rememberMe, setRememberMe] = useState(true)

  const hostname = new URL(backendUrl).hostname

  useEffect(() => {
    // Fetch saved credentials for this domain
    const fetchSaved = async () => {
      try {
        // @ts-ignore
        if (window.myMMA && window.myMMA.getCredentials) {
          // @ts-ignore
          const creds = await window.myMMA.getCredentials(hostname)
          if (creds && creds.length > 0) {
            setSavedAccounts(creds)
            setShowManualForm(false) // Default to switcher if accounts exist
          }
        }
      } catch (err) {
        console.error('Failed to fetch saved credentials', err)
      }
    }
    fetchSaved()
  }, [hostname])

  const handleSubmit = async (
    e?: React.FormEvent,
    manualEmail?: string,
    manualPassword?: string
  ) => {
    if (e) {
      e.preventDefault()
    }
    setLoading(true)
    setError(null)

    const loginEmail = manualEmail || email
    const loginPassword = manualPassword || password
    // Only remember if explicitly checked or if it was a manual submission with rememberMe active
    const shouldRemember = manualEmail && manualPassword ? false : rememberMe

    try {
      const response = await axios.post(`${backendUrl}/api/auth/shell-login`, {
        email: loginEmail,
        password: loginPassword
      })

      if (response.data.token) {
        // Save credentials if Remember Me is checked
        // @ts-ignore
        if (shouldRemember && window.myMMA && window.myMMA.saveCredentials) {
          try {
            // @ts-ignore
            await window.myMMA.saveCredentials(hostname, loginEmail, loginPassword)
          } catch (saveErr) {
            console.error('Failed to auto-save credentials:', saveErr)
          }
        }

        onLoginSuccess(response.data.token, response.data.user)
      }
    } catch (err: any) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      if (err.response && err.response.status === 401) {
        setError('Email atau password salah.')
      } else {
        setError('Terjadi kesalahan koneksi. Silakan coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAccount = (account: SavedAccount) => {
    setEmail(account.username)
    if (account.password) {
      setPassword(account.password)
      handleSubmit(undefined, account.username, account.password)
    } else {
      setShowManualForm(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-blue-950 lg:bg-white lg:grid lg:grid-cols-2 overflow-hidden font-sans">
      {/* Visual Panel (Left - Desktop) */}
      <div className="relative hidden h-full flex-col justify-between bg-blue-950 p-12 text-white lg:flex lg:rounded-r-[3.5rem] overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-blue-950 to-blue-950" />

        {/* Animated Ambience */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-pulse absolute left-[-20%] top-[-20%] h-[40vw] w-[40vw] rounded-full bg-blue-600/20 blur-[100px] opacity-60" />
          <div className="animate-pulse absolute bottom-[-20%] right-[-20%] h-[40vw] w-[40vw] rounded-full bg-sky-600/20 blur-[100px] opacity-60" />
        </div>

        {/* Content */}
        <div className="relative z-20 flex h-full flex-col justify-between">
          <div className="flex items-center gap-3 w-fit">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-2">
              <img src={APP_LOGO} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white uppercase">MyMMA</span>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
                Empowering your <br />
                <span className="text-blue-400">Digital Workflow.</span>
              </h2>
              <p className="max-w-md text-lg text-blue-200/80">
                The complete platform for modern enterprises. Seamless, secure, and smart.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-blue-300/50">
              <p>© 2026 MMAXUP Inc.</p>
              <div className="flex gap-4">
                <span>Privacy Policy</span>
                <span>Terms of Service</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header (Top) */}
      <div className="relative flex h-[35vh] w-full flex-col justify-start overflow-hidden bg-blue-950 p-8 lg:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-blue-950 to-blue-950" />

        <div className="relative z-20 mt-4 flex items-center gap-3 w-fit">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-2">
            <img src={APP_LOGO} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white uppercase">MyMMA</span>
        </div>

        <div className="relative z-20 mt-8">
          <h2 className="text-2xl font-bold text-white">Welcome Back!</h2>
          <p className="text-blue-200/80 text-sm mt-1">Sign in to continue your workflow.</p>
        </div>
      </div>

      {/* Window Controls (Top Right) */}
      <div
        className="fixed top-0 right-0 z-[10000] flex gap-0.5 p-1 bg-transparent pointer-events-auto"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={() => window.windowControls?.minimize()}
          className="flex h-9 w-10 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 lg:text-slate-500 lg:hover:text-slate-900 lg:hover:bg-slate-100 transition-all"
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => window.windowControls?.maximize()}
          className="flex h-9 w-10 items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 lg:text-slate-500 lg:hover:text-slate-900 lg:hover:bg-slate-100 transition-all"
          title="Maximize"
        >
          <Square size={13} />
        </button>
        <button
          onClick={() => window.windowControls?.close()}
          className="flex h-9 w-10 items-center justify-center rounded-md text-white/70 lg:text-slate-500 hover:bg-red-600 hover:text-white lg:hover:bg-red-600 lg:hover:text-white transition-all"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Form Panel (Right/Bottom) */}
      <div
        className={`relative z-20 -mt-12 flex min-h-[calc(100vh-35vh+3rem)] w-full items-start justify-center bg-white rounded-tr-[3rem] px-6 pt-12 pb-16 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:px-12 lg:min-h-0 lg:flex-1 lg:p-16 lg:mt-0 lg:rounded-none lg:shadow-none lg:items-center ${shake ? 'animate-shake' : ''}`}
      >
        <div className="w-full max-w-[400px] space-y-8">
          {/* Account Switcher UI */}
          {!showManualForm && savedAccounts.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2 text-center lg:text-left">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pilih Akun</h1>
                <p className="text-slate-500">Gunakan akun yang tersimpan untuk masuk cepat</p>
              </div>

              <div className="grid gap-3 max-h-[380px] overflow-y-auto pr-2 pb-4 custom-scrollbar">
                {savedAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc)}
                    disabled={loading}
                    className="group relative flex items-center gap-4 w-full p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                      <User size={24} />
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="font-bold text-slate-900 truncate">{acc.username}</div>
                      <div className="text-xs text-slate-500">Tersimpan untuk {acc.domain}</div>
                    </div>
                    <ChevronRight
                      size={20}
                      className="text-slate-300 group-hover:text-blue-500 transition-colors"
                    />
                  </button>
                ))}

                <button
                  onClick={() => setShowManualForm(true)}
                  className="w-full py-4 text-sm font-medium text-blue-600 hover:text-blue-700 bg-transparent hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100"
                >
                  Gunakan akun lain
                </button>
              </div>
            </div>
          )}

          {/* Manual Login Form */}
          {showManualForm && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2 text-center lg:text-left mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Masuk ke akun Anda
                </h1>
                <p className="text-slate-500">Masukkan email dan kata sandi untuk masuk</p>
              </div>

              <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-6">
                <div className="grid gap-6">
                  {/* Email */}
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-900">Alamat email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="email@contoh.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-900">Kata sandi</label>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Kata sandi"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember-me"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label
                      htmlFor="remember-me"
                      className="text-sm font-medium text-slate-600 cursor-pointer select-none"
                    >
                      Ingat Saya
                    </label>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          Masuk <LogIn size={18} />
                        </>
                      )}
                    </button>

                    {savedAccounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManualForm(false)}
                        className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Kembali ke pilihan akun
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 uppercase tracking-widest mt-8">
            Powered by MyMMA Technology
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `
        }}
      />
    </div>
  )
}

export default LoginScreen
