import React, { useState, useEffect } from 'react'
import { X, Lock, Info, Bell } from 'lucide-react'

interface AppInfoPopupProps {
  isOpen: boolean
  onClose: () => void
  activeTab: { title: string; url: string; theme?: 'light' | 'dark' } | undefined
  isLight: boolean
}

const AppInfoPopup: React.FC<AppInfoPopupProps> = ({ isOpen, onClose, activeTab, isLight }) => {
  const [permissions, setPermissions] = useState<{ notifications: boolean }>({
    notifications: true
  })
  const [loadingSettings, setLoadingSettings] = useState(false)

  // Fetch settings when popup opens
  useEffect(() => {
    if (isOpen && activeTab) {
      setLoadingSettings(true)
      try {
        const urlObj = new URL(activeTab.url)
        const origin = urlObj.origin
        // @ts-ignore
        if (window.electron && window.electron.ipcRenderer) {
          // @ts-ignore
          window.electron.ipcRenderer
            .invoke('site-settings:get', { origin })
            .then((settings: any) => {
              setPermissions(settings)
            })
            .catch((err: any) => console.error('[AppInfo] Failed to load settings:', err))
            .finally(() => setLoadingSettings(false))
        }
      } catch (e) {
        console.error('[AppInfo] Invalid URL:', e)
        setLoadingSettings(false)
      }
    }
  }, [isOpen, activeTab])

  const handleTogglePermission = async (key: 'notifications') => {
    if (!activeTab) return
    const newValue = !permissions[key]
    const newPermissions = { ...permissions, [key]: newValue }
    setPermissions(newPermissions)

    try {
      const urlObj = new URL(activeTab.url)
      const origin = urlObj.origin
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        await window.electron.ipcRenderer.invoke('site-settings:set', {
          origin,
          settings: { [key]: newValue }
        })
        console.log(`[AppInfo] Permission ${key} set to ${newValue} for ${origin}`)
      }
    } catch (err) {
      console.error('[AppInfo] Failed to save settings:', err)
      // Revert on error
      setPermissions((prev) => ({ ...prev, [key]: !newValue }))
    }
  }

  if (!isOpen || !activeTab) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          backgroundColor: 'transparent'
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'absolute',
          top: '48px', // Below the header
          left: '12px',
          width: '320px',
          backgroundColor: isLight ? 'white' : '#2d2d2d',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          color: isLight ? 'black' : 'white',
          zIndex: 9999,
          animation: 'dropdownFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Header: App Name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{activeTab.title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Connection Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 0',
            fontSize: '13px',
            color: isLight ? '#16a34a' : '#22c55e', // Green
            fontWeight: '500'
          }}
        >
          <Lock size={14} />
          <span>Connection is secure</span>
        </div>

        {/* Permissions List */}
        <div
          style={{
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Notification Toggle (Existing) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={14} />
              <span>Notifications</span>
            </div>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '32px',
                height: '18px'
              }}
            >
              <input
                type="checkbox"
                checked={permissions.notifications}
                disabled={loadingSettings}
                onChange={() => handleTogglePermission('notifications')}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                  cursor: loadingSettings ? 'not-allowed' : 'pointer'
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: permissions.notifications
                    ? isLight
                      ? '#2563eb'
                      : '#3b82f6'
                    : isLight
                      ? '#ccc'
                      : '#4b5563',
                  transition: '.4s',
                  borderRadius: '34px'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '14px',
                    width: '14px',
                    left: permissions.notifications ? '16px' : '2px', // 32 - 14 - 2 = 16
                    bottom: '2px',
                    backgroundColor: 'white',
                    transition: '.4s',
                    borderRadius: '50%'
                  }}
                ></span>
              </span>
            </label>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            fontSize: '13px',
            borderTop: isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
            marginTop: '4px',
            paddingTop: '12px',
            color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={14} />
            <span>About this page</span>
          </div>
        </div>
      </div>
    </>
  )
}

export default AppInfoPopup
