import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Home,
  RotateCcw,
  X,
  Minus,
  Square,
  Download,
  Key,
  Mail,
  Settings,
  LogOut,
  Info,
  MessageCircle,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { version } from '../../../../package.json'
import { APP_LOGO } from '../constants'

declare global {
  interface Window {
    windowControls: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

// Extend CSSProperties to include Electron-specific properties
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

interface Tab {
  id: string
  url: string
  title: string
  icon?: string
  loading?: boolean
  theme?: 'light' | 'dark'
}

interface FloatingMenuProps {
  tabs: Tab[]
  activeTabId: string
  onSwitchTab: (id: string) => void
  onCloseTab: (id: string) => void
  onBack: () => void
  onForward: () => void
  onHome: () => void
  onRefresh: () => void
  onToggleDownloads: () => void
  onToggleCredentials: () => void
  onToggleEmail: () => void
  onToggleChat: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onOpenDesktopSettings: () => void
  onToggleTheme: () => void
  showChatDot?: boolean
  showEmailDot?: boolean
  currentUser?: any
  theme?: 'light' | 'dark'
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onBack,
  onForward,
  onHome,
  onRefresh,
  onToggleDownloads,
  onToggleCredentials,
  onToggleEmail,
  onToggleChat,
  onLogout,
  onOpenSettings,
  onOpenDesktopSettings,
  onToggleTheme,
  showChatDot = false,
  showEmailDot = false,
  currentUser,
  theme = 'dark'
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [showUserDropdown, setShowUserDropdown] = React.useState(false)

  const [showAbout, setShowAbout] = React.useState(false)
  const isLight = theme === 'light'
  const activeDownloads = React.useRef(new Set<string>())

  const btnStyle = (t: 'light' | 'dark'): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    color: t === 'light' ? 'rgba(0,0,0,0.7)' : 'white',
    padding: '6px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    WebkitAppRegion: 'no-drag',
    opacity: 0.8
  })

  const windowBtnStyle = (t: 'light' | 'dark'): React.CSSProperties => ({
    ...btnStyle(t),
    padding: '8px',
    borderRadius: '4px',
    opacity: 0.6
  })

  const closeBtnStyle = (t: 'light' | 'dark'): React.CSSProperties => ({
    ...windowBtnStyle(t)
  })

  React.useEffect(() => {
    // @ts-ignore
    if (window.myMMA) {
      // @ts-ignore
      const removeStart = window.myMMA.onDownloadStarted((data: any) => {
        activeDownloads.current.add(data.id)
        setIsDownloading(activeDownloads.current.size > 0)
      })

      // @ts-ignore
      const removeComplete = window.myMMA.onDownloadCompleted((data: any) => {
        activeDownloads.current.delete(data.id)
        setIsDownloading(activeDownloads.current.size > 0)
      })

      // @ts-ignore
      const removeFail = window.myMMA.onDownloadFailed((data: any) => {
        activeDownloads.current.delete(data.id)
        setIsDownloading(activeDownloads.current.size > 0)
      })

      return () => { }
    }
    return () => { }
  }, [])

  const handleMinimize = () => window.windowControls?.minimize()
  const handleMaximize = () => window.windowControls?.maximize()
  const handleClose = () => window.windowControls?.close()

  return (
    <>
      <div
        style={{
          width: '100%',
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'oklch(0.205 0 0)',
          padding: '4px 12px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          zIndex: 9999,
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
          color: isLight ? 'rgba(0,0,0,0.8)' : 'white',
          backdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
          WebkitAppRegion: 'drag'
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
                .nav-btn:hover { opacity: 1; background-color: ${theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)'}; }
                .close-btn:hover { background-color: #e81123 !important; opacity: 1 !important; color: white !important; }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes dropdownFadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .dropdown-item-hover:hover { background-color: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'}; }
                .dropdown-separator { height: 1px; background-color: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}; margin: 4px 8px; }
                @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `
          }}
        />

        {/* Left: Navigation Controls */}
        <div
          style={{
            display: 'flex',
            gap: '2px',
            borderRight: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
            paddingRight: '12px',
            WebkitAppRegion: 'no-drag'
          }}
        >
          <button onClick={onBack} title="Back" style={btnStyle(theme)} className="nav-btn">
            <ChevronLeft size={18} />
          </button>
          <button onClick={onHome} title="Home" style={btnStyle(theme)} className="nav-btn">
            <Home size={18} />
          </button>
          <button onClick={onRefresh} title="Refresh" style={btnStyle(theme)} className="nav-btn">
            <RotateCcw size={18} />
          </button>
          <button onClick={onForward} title="Forward" style={btnStyle(theme)} className="nav-btn">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Center: Dynamic Tab Bar */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            padding: '4px 0',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            alignItems: 'center',
            flex: 1,
            WebkitAppRegion: 'no-drag'
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id
            return (
              <div
                key={tab.id}
                onClick={() => onSwitchTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: isActive
                    ? isLight
                      ? 'rgba(0,0,0,0.05)'
                      : 'oklch(0.3 0 0)'
                    : 'transparent',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isActive
                    ? isLight
                      ? '1px solid rgba(0,0,0,0.1)'
                      : '1px solid rgba(255,255,255,0.15)'
                    : '1px solid transparent',
                  minWidth: isActive ? '120px' : '40px',
                  maxWidth: '180px',
                  position: 'relative',
                  flexShrink: 0
                }}
              >
                {tab.icon ? (
                  <img
                    src={tab.icon}
                    style={{ width: '16px', height: '16px', borderRadius: '3px' }}
                    alt=""
                  />
                ) : (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px'
                    }}
                  />
                )}

                {(isActive || tabs.length < 5) && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive ? '700' : '400',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: isActive ? 1 : 0.7
                    }}
                  >
                    {tab.title}
                  </span>
                )}

                {isActive && tab.id !== 'main' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCloseTab(tab.id)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isLight ? 'black' : 'white',
                      padding: '1px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.5,
                      marginLeft: '4px'
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: Home, Refresh & Window Controls */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            WebkitAppRegion: 'no-drag'
          }}
        >

          <div
            style={{
              display: 'flex',
              gap: '2px',
              borderLeft: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
              paddingLeft: '12px'
            }}
          >
            <button
              onClick={onToggleChat}
              title="Chat"
              style={{ ...btnStyle(theme), position: 'relative' }}
              className="nav-btn"
            >
              <MessageCircle size={18} />
              {showChatDot && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    border: isLight ? '1.5px solid white' : '1.5px solid oklch(0.205 0 0)',
                    boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                  }}
                />
              )}
            </button>
            <button
              onClick={onToggleEmail}
              title="Email"
              style={{ ...btnStyle(theme), position: 'relative' }}
              className="nav-btn"
            >
              <Mail size={18} />
              {showEmailDot && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    border: isLight ? '1.5px solid white' : '1.5px solid oklch(0.205 0 0)',
                    boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                  }}
                />
              )}
            </button>
            <button
              onClick={onToggleDownloads}
              title="Downloads"
              style={btnStyle(theme)}
              className="nav-btn"
            >
              <Download
                size={18}
                style={{ animation: isDownloading ? 'bounce 1s infinite' : 'none' }}
              />
            </button>
            <button
              onClick={onToggleCredentials}
              title="Passwords"
              style={btnStyle(theme)}
              className="nav-btn"
            >
              <Key size={18} />
            </button>
            <button
              onClick={onToggleTheme}
              title={isLight ? 'Ganti ke Mode Gelap' : 'Ganti ke Mode Terang'}
              style={btnStyle(theme)}
              className="nav-btn"
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>

          {/* Vertical Separator */}
          <div
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
              margin: '0 4px'
            }}
          />

          {currentUser && (
            <div style={{ position: 'relative', WebkitAppRegion: 'no-drag' }}>
              <div
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '3px 16px 3px 3.5px',
                  borderRadius: '24px',
                  backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: 'fit-content'
                }}
                className="dropdown-item-hover"
                title={currentUser.name}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: currentUser.avatar ? 'transparent' : 'oklch(0.588 0.158 241.97)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '700',
                    boxShadow: isLight ? '0 2px 4px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.3)',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}
                >
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        // Fallback if image fails to load
                        ; (e.target as HTMLImageElement).style.display = 'none'
                          ; (e.target as HTMLImageElement).parentElement!.style.backgroundColor =
                            'oklch(0.588 0.158 241.97)'
                          ; (e.target as HTMLImageElement).parentElement!.innerText =
                            currentUser.name?.charAt(0).toUpperCase() || ''
                      }}
                    />
                  ) : (
                    currentUser.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    lineHeight: '1.1'
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: isLight ? 'rgba(0,0,0,0.8)' : 'white',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {currentUser.name}
                  </div>
                  {currentUser.role_display && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: '500',
                        color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '-1px'
                      }}
                    >
                      {currentUser.role_display}
                    </div>
                  )}
                </div>
              </div>

              {showUserDropdown && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 999
                    }}
                    onClick={() => setShowUserDropdown(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '120%',
                      right: 0,
                      width: '200px',
                      backgroundColor: isLight ? 'white' : 'oklch(0.18 0 0)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                      border: isLight
                        ? '1px solid rgba(0,0,0,0.05)'
                        : '1px solid rgba(255,255,255,0.05)',
                      padding: '6px',
                      zIndex: 1000,
                      animation: 'dropdownFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowUserDropdown(false)
                        onOpenDesktopSettings()
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'none',
                        color: 'inherit',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      className="dropdown-item-hover"
                    >
                      <Monitor size={15} style={{ opacity: 0.7 }} /> Pengaturan Aplikasi
                    </button>
                    <div className="dropdown-separator" />
                    <button
                      onClick={() => {
                        setShowUserDropdown(false)
                        onOpenSettings()
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'none',
                        color: 'inherit',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      className="dropdown-item-hover"
                    >
                      <Settings size={15} style={{ opacity: 0.7 }} /> Profil & Keamanan
                    </button>
                    <button
                      onClick={() => {
                        setShowUserDropdown(false)
                        setShowAbout(true)
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'none',
                        color: 'inherit',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      className="dropdown-item-hover"
                    >
                      <Info size={15} style={{ opacity: 0.7 }} /> Tentang Aplikasi
                    </button>
                    <div className="dropdown-separator" />
                    <button
                      onClick={() => {
                        setShowUserDropdown(false)
                        onLogout()
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'none',
                        color: '#ef4444',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      className="dropdown-item-hover"
                    >
                      <LogOut size={15} /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Window Control Buttons */}
          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              onClick={handleMinimize}
              title="Minimize"
              style={windowBtnStyle(theme)}
              className="nav-btn"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={handleMaximize}
              title="Maximize"
              style={windowBtnStyle(theme)}
              className="nav-btn"
            >
              <Square size={12} />
            </button>
            <button
              onClick={handleClose}
              title="Close"
              style={closeBtnStyle(theme)}
              className="close-btn"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div >

      {showAbout && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            WebkitAppRegion: 'no-drag'
          }}
          onClick={() => setShowAbout(false)}
        >
          <div
            style={{
              backgroundColor: isLight ? 'white' : 'oklch(0.25 0 0)',
              width: '400px',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
              animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              position: 'relative',
              color: isLight ? 'black' : 'white'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAbout(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <img
              src={APP_LOGO}
              alt="MyMMA"
              style={{ width: '80px', height: '80px', marginBottom: '8px' }}
            />

            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
                MyMMA Desktop
              </h2>
              <div
                style={{
                  fontSize: '14px',
                  color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                  fontWeight: '500'
                }}
              >
                Versi {version}
              </div>
            </div>

            <div
              style={{
                width: '100%',
                height: '1px',
                backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                margin: '8px 0'
              }}
            />

            <div
              style={{
                fontSize: '13px',
                textAlign: 'center',
                lineHeight: '1.6',
                color: isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'
              }}
            >
              Aplikasi desktop resmi untuk platform Manajemen MyMMA.
              <br />
              &copy; {new Date().getFullYear()} PT. MMA. All rights reserved.
            </div>
          </div>
        </div>
      )
      }
    </>
  )
}

export default FloatingMenu
