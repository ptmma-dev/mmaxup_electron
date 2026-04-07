import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createEcho } from '../lib/echo'
import Echo from 'laravel-echo'
import axios from 'axios'
import FloatingMenu from './FloatingMenu'
import DownloadManager from './DownloadManager'
import CredentialsManager from './CredentialsManager'
import EmailReader from './EmailReader'
import ChatPanel from './ChatPanel'
import LoginScreen from './LoginScreen'
import PasswordPrompt from './PasswordPrompt'
import DesktopSettingsModal from './DesktopSettingsModal'
import { APP_LOGO } from '../constants'
import { Toaster } from 'sonner'
import soundGeneral from '../assets/sounds/general.mp3'
import soundMessenger from '../assets/sounds/messenger.mp3'
import LoadingOverlay from './LoadingOverlay'

interface WebviewTag extends React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> {
  src: string
  allowpopups?: string
  preload?: string
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebviewTag
    }
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

const DEFAULT_URL = import.meta.env.DEV
  ? import.meta.env.VITE_URL_DEV
  : import.meta.env.VITE_URL_PROD

type SidebarType = 'none' | 'chat' | 'downloads'

const BrowserShell: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState('main')
  const [preloadPath, setPreloadPath] = useState<string>('')
  const [activeSidebar, setActiveSidebar] = useState<SidebarType>('none')
  const [showCredentials, setShowCredentials] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [isCredentialsUnlocked, setIsCredentialsUnlocked] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [hasUnreadEmails, setHasUnreadEmails] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  const [apiToken, setApiToken] = useState<string>((window as any).apiToken || '')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)
  const [masterToken, setMasterToken] = useState<string>('')
  const [showDesktopSettings, setShowDesktopSettings] = useState(false)
  const webviewRefs = useRef<{ [key: string]: any }>({})
  const lastLoginTime = useRef<number>(0)

  const backendUrl = import.meta.env.DEV
    ? import.meta.env.VITE_URL_DEV
    : import.meta.env.VITE_URL_PROD

  const echoRef = useRef<Echo<any> | null>(null)
  const audioGeneral = useRef<HTMLAudioElement | null>(null)
  const audioMessenger = useRef<HTMLAudioElement | null>(null)

  // Preload audio
  useEffect(() => {
    audioGeneral.current = new Audio(soundGeneral)
    audioMessenger.current = new Audio(soundMessenger)
  }, [])

  const playNotificationSound = useCallback((type: 'general' | 'messenger') => {
    console.log(`[BrowserShell] Attempting to play sound: ${type}`)
    const audio = type === 'messenger' ? audioMessenger.current : audioGeneral.current
    if (audio) {
      audio.currentTime = 0
      audio.play()
        .then(() => console.log(`[BrowserShell] Audio played successfully: ${type}`))
        .catch((err) => {
          console.error(`[BrowserShell] Audio play failed for ${type}:`, err)
          // Fallback check: maybe need interaction
          if (err.name === 'NotAllowedError') {
            console.warn('[BrowserShell] Audio blocked by browser policy. Interaction needed?')
          }
        })
    } else {
      console.error(`[BrowserShell] Audio object not found for ${type}`)
    }
  }, [])

  // Global Echo instance for notifications
  useEffect(() => {
    if (!isAuthenticated || !apiToken || !currentUser) {
      if (echoRef.current) {
        echoRef.current.disconnect()
        echoRef.current = null
      }
      return
    }

    let echo = echoRef.current
    if (echo && echo.options.auth.headers.Authorization !== `Bearer ${apiToken}`) {
      echo.disconnect()
      echo = null
      echoRef.current = null
    }

    if (!echo) {
      echo = createEcho(apiToken, backendUrl)
      echoRef.current = echo
    }

    if (!echo) return

    const userChannelName = `App.Models.User.${currentUser.id}`
    const userChannel = echo.private(userChannelName)

    userChannel.listen('.ChatRoomUpdated', (e: any) => {
      console.log('📬 Shell: ChatRoomUpdated received', e)
      // Only show dot if chat panel is closed
      if (activeSidebar !== 'chat') {
        setHasUnreadMessages(true)
        playNotificationSound('messenger')

        // Trigger a native notification for the internal chat
        // @ts-ignore
        if (window.myMMA && window.myMMA.showNotification) {
          const roomName = e.chat_room?.name || 'Pesan Baru'
          const messageSnippet = e.latest_message?.message || 'Anda menerima pesan baru'

          // @ts-ignore
          window.myMMA.showNotification(roomName, {
            body: messageSnippet,
            data: { tabId: 'internal-chat' }
          })
        }
      }
    })

    return () => {
      if (echoRef.current) {
        echoRef.current.leave(userChannelName)
      }
    }
  }, [isAuthenticated, apiToken, currentUser, backendUrl, activeSidebar])

  // Reset unread state when opening chat
  useEffect(() => {
    if (activeSidebar === 'chat') {
      setHasUnreadMessages(false)
    }
  }, [activeSidebar])

  useEffect(() => {
    if (showEmail) {
      setHasUnreadEmails(false)
    }
  }, [showEmail])

  const handleLoginSuccess = useCallback(
    (token: string, user: any) => {
      setMasterToken(token)
      setCurrentUser(user)
      setApiToken(token)
        ; (window as any).apiToken = token
      setIsAuthenticated(true)
      lastLoginTime.current = Date.now()

      // Initial navigation to bridge session
      // Try passing both commonly used query params for Passport/Guard detection
      const bridgeUrl = `${backendUrl}/api/auth/shell-bridge?token=${token}&api_token=${token}`

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === 'main') {
            return { ...t, url: bridgeUrl, loading: true }
          }
          return t
        })
      )

      // Store token securely, e.g., in Electron's secure storage
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore
        window.electron.ipcRenderer.send('set-master-token', token)
      }
    },
    [backendUrl]
  )

  const handleLogout = useCallback(() => {
    console.log('[BrowserShell] Logging out...')
    setIsAuthenticated(false)
    setIsCredentialsUnlocked(false)
    setMasterToken('')
    setApiToken('')
    setCurrentUser(null)
      ; (window as any).apiToken = ''

    // Clear in Main
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore
      window.electron.ipcRenderer.send('set-master-token', '')
      // @ts-ignore
      window.electron.ipcRenderer.invoke('session:clear').catch((err) => {
        console.error('[BrowserShell] Failed to clear session:', err)
      })
    }

    // Reset tabs to default state
    setTabs([{ id: 'main', title: 'Dashboard', url: backendUrl, loading: true, icon: undefined }])
    setActiveTabId('main')
  }, [backendUrl])

  const fetchCurrentUserInfo = useCallback(async () => {
    if (!apiToken) return

    try {
      const response = await axios.get(`${backendUrl}/api/me`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })

      if (response.data.success) {
        setCurrentUser(response.data.data.user)
      }
    } catch (err) {
      console.error('[BrowserShell] Failed to fetch user info:', err)
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleLogout()
      }
    }
  }, [apiToken, backendUrl, handleLogout])

  // Check for existing master token on startup
  useEffect(() => {
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore
      window.electron.ipcRenderer.invoke('get-master-token').then(async (token: string) => {
        if (token) {
          setMasterToken(token)
          setApiToken(token)
            ; (window as any).apiToken = token
          setIsAuthenticated(true)
          // We don't need to call fetchCurrentUserInfo here as the apiToken change 
          // will be handled by our other effect or manual call if needed.
          // Actually, let's just call it directly since we have the token now.
          try {
            const response = await axios.get(`${backendUrl}/api/me`, {
              headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data.success) {
              setCurrentUser(response.data.data.user)
            }
          } catch (err) {
            console.error('[BrowserShell] Failed to re-hydrate session:', err)
            handleLogout()
          }
        }
      })
    }
  }, [backendUrl, handleLogout])

  // Refresh user info when apiToken changes (if not already authenticated)
  useEffect(() => {
    if (isAuthenticated && apiToken && !currentUser) {
      fetchCurrentUserInfo()
    }
  }, [isAuthenticated, apiToken, currentUser, fetchCurrentUserInfo])

  // Sync with system theme (only if user hasn't manually overridden)
  const [isThemeManual, setIsThemeManual] = useState(false)
  const themeRef = useRef<'light' | 'dark'>(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    if (isThemeManual) {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    console.log('[Theme] Initial system theme dark match:', mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      console.log('[Theme] System theme change detected! matches dark:', e.matches)
      setTheme(e.matches ? 'dark' : 'light')
    }

    // Standard event listener
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [isThemeManual])

  // Auto-open downloads sidebar when a download starts
  useEffect(() => {
    // @ts-ignore
    if (window.myMMA && window.myMMA.onDownloadStarted) {
      // @ts-ignore
      window.myMMA.onDownloadStarted(() => {
        setActiveSidebar('downloads')
      })
    }
    return () => { }
  }, [])

  const injectThemeIntoWebview = useCallback((webview: any, targetTheme: 'light' | 'dark') => {
    if (!webview) {
      return
    }

    const script =
      targetTheme === 'dark'
        ? `document.documentElement.classList.add('dark'); document.documentElement.classList.remove('light');`
        : `document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light');`

    webview.executeJavaScript(script).catch(() => {
      // Silently ignore if webview is not ready yet
    })
  }, [])

  // Inject theme into all webviews whenever theme changes
  useEffect(() => {
    Object.values(webviewRefs.current).forEach((webview) => {
      injectThemeIntoWebview(webview, theme)
    })
  }, [theme, injectThemeIntoWebview])

  const handleToggleTheme = useCallback(() => {
    setIsThemeManual(true)
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const handleOpenTab = useCallback((id: string, name: string, url: string, icon?: string) => {
    setTabs((prev) => {
      const existingTab = prev.find((t) => t.id === id || t.url === url)
      if (existingTab) {
        return prev
      }

      // Construct high-quality icon URL if missing and it's a MyMMA sub-app
      let finalIcon = icon
      const isSubApp = /https?:\/\/[^\/]+\.(reytechz\.my\.id|mmaxup\.com)/.test(url)

      if (!finalIcon && isSubApp) {
        try {
          const urlObj = new URL(url)
          finalIcon = `${urlObj.protocol}//${urlObj.hostname}/favicon.svg`
        } catch (e) {
          // Fallback to null if URL parsing fails
        }
      }

      return [...prev, { id, title: name, icon: finalIcon, url, loading: true }]
    })
    setActiveTabId(id)
  }, [])

  useEffect(() => {
    // Fetch preload path from main process
    const fetchPreload = async () => {
      // @ts-ignore
      if (window.electron && window.electron.ipcRenderer) {
        const path = await window.electron.ipcRenderer.invoke('get-preload-path')
        setPreloadPath(path)

        // Initialize first tab only after preload path is available
        setTabs((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: 'main',
                url: DEFAULT_URL,
                title: 'MyMMA',
                loading: true,
                icon: APP_LOGO
              }
            ]
          }
          return prev
        })
      }
    }
    fetchPreload()

    // REAL-TIME EMAIL WATCH & NOTIFICATIONS
    if (isAuthenticated && apiToken && backendUrl) {
      console.log('[BrowserShell] Starting real-time email watch...')

      // @ts-ignore
      if (window.myMMA && window.myMMA.startEmailWatch) {
        // @ts-ignore
        window.myMMA.startEmailWatch(backendUrl, apiToken).then((res: any) => {
          if (res.success) {
            console.log('[BrowserShell] Real-time email watch active.')
          } else {
            console.error('[BrowserShell] Failed to start real-time watch:', res.error)
          }
        })
      }
    }

    // Listen for tab opening requests from main process
    // @ts-ignore
    if (window.electron && window.electron.ipcRenderer) {
      const removeOpenListener = window.electron.ipcRenderer.on(
        'open-app-tab-from-main',
        (_event, { id, name, url }) => {
          handleOpenTab(id, name, url)
        }
      )

      const removeFocusListener = window.electron.ipcRenderer.on(
        'focus-tab',
        (_event, { tabId }) => {
          setActiveTabId(tabId)
          // Also focus the window if it's not focused
          window.focus()
        }
      )

      // Listen for master token requests from webviews
      const removeMasterTokenRequestListener = window.electron.ipcRenderer.on(
        'request-master-token',
        (event) => {
          // @ts-ignore
          event.sender.send('master-token-response', masterToken)
        }
      )

      // LISTEN FOR REAL-TIME EMAIL EVENTS
      const removeEmailArrivalListener = window.electron.ipcRenderer.on(
        'email:new-arrival',
        (_event, email) => {
          console.log('[BrowserShell] Real-time email detected:', email)

          if (!showEmail) {
            setHasUnreadEmails(true)
          }

          // @ts-ignore
          if (window.myMMA.showNotification) {
            // @ts-ignore
            window.myMMA.showNotification(`Email Baru (Realtime): ${email.subject}`, {
              body: `Dari: ${email.sender}\nAkun: ${email.account}`,
              data: { tabId: 'email-reader' }
            })
            playNotificationSound('general')
          }
        }
      )

      return () => {
        removeOpenListener()
        removeFocusListener()
        removeMasterTokenRequestListener()
        removeEmailArrivalListener()
        // @ts-ignore
        if (window.myMMA && window.myMMA.stopEmailWatch) {
          // @ts-ignore
          window.myMMA.stopEmailWatch()
        }
      }
    }
    return () => { }
  }, [handleOpenTab, masterToken, isAuthenticated, apiToken, backendUrl])

  const handleNewWindow = (e: any) => {
    e.preventDefault()
    const url = e.url

    // Robust check for sub-app URLs (e.g. *.reytechz.my.id or *.mmaxup.com)
    const isSubApp = /https?:\/\/[^\/]+\.(reytechz\.my\.id|mmaxup\.com)/.test(url)

    if (isSubApp) {
      try {
        const urlObj = new URL(url)
        const hostParts = urlObj.hostname.split('.')
        const id = hostParts[0] // Usually the subdomain
        const name = id.charAt(0).toUpperCase() + id.slice(1)
        handleOpenTab(id, name, url)
      } catch (err) {
        // Fallback if URL parsing fails
        handleOpenTab('app-' + Date.now(), 'Sub App', url)
      }
    } else {
      // For external links, open in the active tab context or block
      const activeWebview = webviewRefs.current[activeTabId]
      if (activeWebview) {
        activeWebview.loadURL(url)
      }
    }
  }

  const handleTitleUpdate = (id: string, e: any) => {
    const title = e.title
    const parts = title.split('-')
    const parsedTitle = parts.length > 1 ? parts[parts.length - 1].trim() : title

    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title: parsedTitle } : t)))
  }

  const handleFaviconUpdate = (id: string, e: any) => {
    const favicons = e.favicons
    if (favicons && favicons.length > 0) {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            // Don't override if we already have a high-quality SVG icon assigned
            if (t.icon && t.icon.endsWith('.svg')) {
              return t
            }
            return { ...t, icon: favicons[0] }
          }
          return t
        })
      )
    }
  }

  const activeWebview = webviewRefs.current[activeTabId]

  const goBack = () => {
    if (activeWebview && activeWebview.canGoBack()) {
      activeWebview.goBack()
    }
  }

  const goHome = () => {
    if (activeWebview) {
      activeWebview.loadURL(DEFAULT_URL)
      setActiveTabId('main')
    }
  }

  const goForward = () => {
    if (activeWebview && activeWebview.canGoForward()) {
      activeWebview.goForward()
    }
  }

  const refresh = () => {
    if (activeWebview) {
      activeWebview.reload()
    }
  }

  const handleCloseTab = (tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== tabId))
    delete webviewRefs.current[tabId]
    if (activeTabId === tabId) {
      setActiveTabId('main')
    }
  }

  const handleOpenSettings = useCallback(() => {
    const settingsUrl = `${backendUrl}/settings/profile`

    // Navigate the main tab to settings instead of creating a new tab
    const mainTab = webviewRefs.current['main']
    if (mainTab) {
      mainTab.loadURL(settingsUrl)
      setActiveTabId('main')
    }
  }, [backendUrl])

  if (!isAuthenticated) {
    return <LoginScreen backendUrl={backendUrl} onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden font-sans select-none">
      {/* Save Password Prompt Removed as per user request (Auto-save via 'Remember Me') */}
      {/* Top Navigation Bar */}
      <FloatingMenu
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onBack={goBack}
        onForward={goForward}
        onHome={goHome}
        onRefresh={refresh}
        onToggleDownloads={() =>
          setActiveSidebar((prev) => (prev === 'downloads' ? 'none' : 'downloads'))
        }
        onToggleCredentials={() => {
          if (isCredentialsUnlocked) {
            setShowCredentials(!showCredentials)
          } else {
            setShowPasswordPrompt(true)
          }
        }}
        onToggleEmail={() => setShowEmail(!showEmail)}
        onToggleChat={() => setActiveSidebar((prev) => (prev === 'chat' ? 'none' : 'chat'))}
        onLogout={handleLogout}
        onOpenSettings={handleOpenSettings}
        onOpenDesktopSettings={() => setShowDesktopSettings(true)}
        onToggleTheme={handleToggleTheme}
        showChatDot={hasUnreadMessages}
        showEmailDot={hasUnreadEmails}
        currentUser={currentUser}
        theme={theme}
      />

      <DesktopSettingsModal
        isOpen={showDesktopSettings}
        onClose={() => setShowDesktopSettings(false)}
        theme={theme}
      />

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <LoadingOverlay visible={!preloadPath} message="Menyiapkan Sistem MyMMA..." />

          {preloadPath &&
            tabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  display: activeTabId === tab.id ? 'block' : 'none',
                  width: '100%',
                  height: '100%'
                }}
              >
                <LoadingOverlay
                  visible={!!tab.loading}
                  style={{ pointerEvents: 'none' }} // Ensure it never blocks interaction if stuck
                />

                <webview
                  ref={(el: any) => {
                    if (el) {
                      webviewRefs.current[tab.id] = el

                      if (!el.dataset.ready) {
                        el.addEventListener('new-window', handleNewWindow)
                        el.addEventListener('page-title-updated', (e: any) =>
                          handleTitleUpdate(tab.id, e)
                        )
                        el.addEventListener('page-favicon-updated', (e: any) =>
                          handleFaviconUpdate(tab.id, e)
                        )

                        el.addEventListener('did-start-loading', () => {
                          setTabs((prev) =>
                            prev.map((t) => (t.id === tab.id ? { ...t, loading: true } : t))
                          )
                        })

                        el.addEventListener('did-stop-loading', () => {
                          setTabs((prev) =>
                            prev.map((t) => (t.id === tab.id ? { ...t, loading: false } : t))
                          )
                          // Inject current theme into page after it finishes loading
                          injectThemeIntoWebview(el, themeRef.current)
                        })

                        const checkLogout = (event: any) => {
                          const url = event.url
                          const timeSinceLogin = Date.now() - lastLoginTime.current

                          // Detect redirect to login page (excluding our shell bridge)
                          // If we JUST logged in (< 10s), avoid auto-logout as it might be a transient bridge redirect
                          if (url.includes('/login') && !url.includes('shell-bridge')) {
                            if (timeSinceLogin < 10000) {
                              console.log(
                                '[BrowserShell] Ignoring login redirect shortly after login (bridge phase):',
                                url
                              )
                              return
                            }
                            console.log(
                              '[BrowserShell] Detected redirect to login page, triggering logout:',
                              url
                            )
                            handleLogout()
                          }
                        }

                        el.addEventListener('did-navigate', checkLogout)
                        el.addEventListener('did-navigate-in-page', checkLogout)

                        // Strategy A: Passive Monitoring & Navigation Trigger
                        // 1. Inject script to passively monitor inputs and cache them
                        const monitorScript = `
                                            (function() {
                                                if (window.__credMonitorInit) return;
                                                window.__credMonitorInit = true;
                                                window.__loginTemp = null;

                                                console.log('[CredMonitor] Initialized for:', window.location.hostname);
                                                
                                                function checkInputs() {
                                                    const passwordField = document.querySelector('input[type="password"]');
                                                    const usernameField = document.querySelector('input[type="text"], input[type="email"]');
                                                    const rememberCheckbox = document.querySelector('input[type="checkbox"][name="remember"], input[type="checkbox"][id*="remember"], input[type="checkbox"][id*="ingat"]');
                                                    
                                                    if (passwordField && usernameField && passwordField.value && usernameField.value) {
                                                        window.__loginTemp = {
                                                            username: usernameField.value,
                                                            password: passwordField.value,
                                                            remember: rememberCheckbox ? rememberCheckbox.checked : false,
                                                            domain: window.location.hostname
                                                        };
                                                    }
                                                }

                                                function findAndSendToken() {
                                                    const tokenNames = ['api_token', 'token', 'access_token', 'auth_token'];
                                                    let token = null;

                                                    // 1. Storage
                                                    for (const name of tokenNames) {
                                                        token = localStorage.getItem(name) || sessionStorage.getItem(name);
                                                        if (token) break;
                                                    }

                                                    // 2. Meta tags
                                                    if (!token) {
                                                        const meta = document.querySelector('meta[name="api-token"]');
                                                        if (meta) token = meta.getAttribute('content');
                                                    }

                                                    // 3. Global objects
                                                    if (!token) {
                                                        // @ts-ignore
                                                        token = window.api_token || (window.Laravel && window.Laravel.token);
                                                    }

                                                    if (token) {
                                                        console.log('[CredMonitor] Token found, sending to host...');
                                                        // @ts-ignore
                                                        if (window.electron && window.electron.ipcRenderer) {
                                                            // @ts-ignore
                                                            window.electron.ipcRenderer.sendToHost('token-captured', { token });
                                                        }
                                                    }
                                                }

                                                document.addEventListener('input', checkInputs, true);
                                                document.addEventListener('change', checkInputs, true);
                                                document.addEventListener('submit', () => {
                                                    checkInputs();
                                                    setTimeout(findAndSendToken, 1000); // Wait for potential login redirection/storage update
                                                }, true);

                                                // Periodic check for token if it might appear later
                                                setInterval(findAndSendToken, 5000);
                                                findAndSendToken();
                                            })();
                                        `

                        // Inject monitor script when loading starts/stops to ensure it's there
                        el.addEventListener('did-finish-load', async () => {
                          try {
                            // 1. Inject Monitor Script (Only for Trusted Domains)
                            const currentUrl = el.getURL()
                            const isTrusted =
                              /https?:\/\/(localhost|127\.0\.0\.1|[^\/]+\.(reytechz\.my\.id|mmaxup\.com))/.test(
                                currentUrl
                              )
                            if (isTrusted) {
                              el.executeJavaScript(monitorScript)
                            }

                            // 2. Inject Autofill Script (if credentials exist)
                            // @ts-ignore
                            if (window.myMMA && window.myMMA.getCredentials) {
                              const url = el.getURL()
                              const hostname = new URL(url).hostname
                              // @ts-ignore
                              const creds = await window.myMMA.getCredentials(hostname)

                              if (creds && creds.length > 0) {
                                const { username, password } = creds[0]
                                console.log(
                                  `[BrowserShell] Found credentials for ${hostname}, injecting autofill...`
                                )

                                const autofillScript = `
                                                            (function() {
                                                                const username = "${username.replace(/"/g, '\\"')}";
                                                                const password = "${password.replace(/"/g, '\\"')}";
                                                                
                                                                function setNativeValue(element, value) {
                                                                    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
                                                                    const prototype = Object.getPrototypeOf(element);
                                                                    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
                                                                    
                                                                    if (valueSetter && valueSetter !== prototypeValueSetter) {
                                                                    	prototypeValueSetter.call(element, value);
                                                                    } else {
                                                                    	valueSetter.call(element, value);
                                                                    }
                                                                    
                                                                    element.dispatchEvent(new Event('input', { bubbles: true }));
                                                                    element.dispatchEvent(new Event('change', { bubbles: true }));
                                                                }

                                                                function autofill() {
                                                                    const passwordField = document.querySelector('input[type="password"]');
                                                                    if (!passwordField) return;
                                                                    
                                                                    const form = passwordField.form;
                                                                    let usernameField = null;
                                                                    
                                                                    if (form) {
                                                                        usernameField = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
                                                                    }
                                                                    
                                                                    if (!usernameField) {
                                                                         usernameField = document.querySelector('input[type="text"], input[type="email"]');
                                                                    }
                                                                    
                                                                    if (usernameField && passwordField) {
                                                                        console.log('[AutofillScript] Filling credentials with native setter...');
                                                                        
                                                                        // Only fill if empty to respond to "odd" behavior report
                                                                        if (!usernameField.value) setNativeValue(usernameField, username);
                                                                        if (!passwordField.value) setNativeValue(passwordField, password);
                                                                    }
                                                                }
                                                                
                                                                // Run immediately
                                                                autofill();
                                                                // And retry on DOM changes (for dynamic forms)
                                                                const observer = new MutationObserver(autofill);
                                                                observer.observe(document.body, { childList: true, subtree: true });
                                                            })();
                                                        `
                                el.executeJavaScript(autofillScript)
                              }
                            }
                          } catch (e) {
                            console.error('Failed to inject scripts', e)
                          }
                        })

                        // 2. Check for cached credentials on navigation
                        const checkAndSaveCredentials = async () => {
                          try {
                            // Execute script to get and clear the temp data atomically
                            const data = await el.executeJavaScript(
                              '(() => { const d = window.__loginTemp; window.__loginTemp = null; return d; })()'
                            )

                            if (data && data.username && data.password && data.remember) {
                              console.log(
                                '[BrowserShell] Auto-saving credentials via navigation trigger:',
                                { ...data, password: '***' }
                              )

                              // @ts-ignore
                              if (window.myMMA && window.myMMA.saveCredentials) {
                                // @ts-ignore
                                window.myMMA.saveCredentials(
                                  data.domain,
                                  data.username,
                                  data.password
                                )

                                // Show notification
                                // @ts-ignore
                                if (window.myMMA.showNotification) {
                                  // @ts-ignore
                                  window.myMMA.showNotification('Kredensial Disimpan', {
                                    body: `Sandi untuk ${data.username} telah disimpan.`
                                  })
                                }
                              }
                            } else if (data) {
                              console.log(
                                '[BrowserShell] Credentials found but Remember Me not checked. Skipping.'
                              )
                            }
                          } catch (err) {
                            // Context might be invalid or script not run, ignore
                          }
                        }

                        // Capture on standard navigation (before page unloads)
                        el.addEventListener('will-navigate', (e) => {
                          console.log('[BrowserShell] Will navigate to:', e.url)
                          checkAndSaveCredentials()
                        })

                        // Capture on in-page navigation (SPA)
                        el.addEventListener('did-navigate-in-page', (e) => {
                          console.log('[BrowserShell] SPA Navigation to:', e.url)
                          checkAndSaveCredentials()
                        })

                        // Handle IPC messages
                        el.addEventListener('ipc-message', (e) => {
                          if (e.channel === 'open-app-tab') {
                            const { id, name, icon, url } = e.args[0]
                            handleOpenTab(id, name, url, icon)
                          } else if (e.channel === 'token-captured') {
                            const { token } = e.args[0]
                            console.log('[BrowserShell] Token captured from guest')
                            // @ts-ignore
                            window.apiToken = token
                            setApiToken(token)
                          } else if (e.channel === 'profile-updated') {
                            console.log('[BrowserShell] Profile update notification received')
                            // Refresh user info
                            fetchCurrentUserInfo()
                          } else if (e.channel === 'show-notification') {
                            const { title, options } = e.args[0]
                            console.log(`[BrowserShell] Notification requested: ${title}`, options)

                            // Resolve relative icons to absolute URLs
                            let finalIcon = options?.icon
                            const webview = webviewRefs.current[tab.id]
                            const currentUrl = webview ? webview.getURL() : tab.url

                            if (
                              finalIcon &&
                              !finalIcon.startsWith('http') &&
                              !finalIcon.startsWith('data:')
                            ) {
                              try {
                                finalIcon = new URL(finalIcon, currentUrl).href
                              } catch (err) {
                                finalIcon = tab.icon
                              }
                            } else if (!finalIcon) {
                              finalIcon = tab.icon
                            }

                            // Forward to main process with tab context
                            // @ts-ignore
                            if (window.electron && window.electron.ipcRenderer) {
                              window.electron.ipcRenderer.send('trigger-native-notification', {
                                title,
                                options: {
                                  ...options,
                                  icon: finalIcon,
                                  data: { ...options?.data, tabId: tab.id }
                                }
                              })

                              // Play sound based on title, tabId, or options content
                              const isMessenger = [
                                tab.id.toLowerCase(),
                                title.toLowerCase(),
                                options?.tag?.toLowerCase() || '',
                                options?.data?.tabId?.toLowerCase() || '',
                                options?.body?.toLowerCase() || ''
                              ].some((text) =>
                                text.includes('messenger') ||
                                text.includes('chat') ||
                                text.includes('pesan') ||
                                text.includes('message') ||
                                text.includes('whatsapp') ||
                                text.includes('telegram') ||
                                text.includes('signal')
                              )

                              console.log(`[BrowserShell] Sound selection: ${isMessenger ? 'messenger' : 'general'} (isMessenger=${isMessenger})`)
                              playNotificationSound(isMessenger ? 'messenger' : 'general')
                            }
                          }
                        })

                        el.dataset.ready = 'true'
                      }
                    }
                  }}
                  src={tab.url}
                  preload={preloadPath}
                  useragent={`${navigator.userAgent} MyMMA-Desktop`}
                  style={{ width: '100%', height: '100%' }}
                  // @ts-ignore
                  allowpopups="true"
                  // @ts-ignore
                  webpreferences="contextIsolation=no, sandbox=no"
                />
              </div>
            ))}
        </div>

        {/* Unified Sidebar — 25% width */}
        {activeSidebar !== 'none' && (
          <div
            style={{
              width: '25%',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft:
                theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)'
            }}
          >
            {activeSidebar === 'chat' && (
              <ChatPanel
                isOpen={true}
                onClose={() => setActiveSidebar('none')}
                currentUserId={currentUser?.id}
                apiToken={apiToken}
                backendUrl={backendUrl}
                theme={theme}
                playNotificationSound={playNotificationSound}
              />
            )}
            {activeSidebar === 'downloads' && (
              <DownloadManager
                visible={true}
                theme={theme}
                onClose={() => setActiveSidebar('none')}
              />
            )}
          </div>
        )}
      </div>
      <CredentialsManager
        visible={showCredentials}
        theme={theme}
        onClose={() => setShowCredentials(false)}
      />
      <PasswordPrompt
        visible={showPasswordPrompt}
        userEmail={currentUser?.email || ''}
        backendUrl={backendUrl}
        theme={theme}
        onClose={() => setShowPasswordPrompt(false)}
        onSuccess={() => {
          setShowPasswordPrompt(false)
          setIsCredentialsUnlocked(true)
          setShowCredentials(true)
        }}
      />
      <EmailReader
        visible={showEmail}
        theme={theme}
        onClose={() => setShowEmail(false)}
        backendUrl={backendUrl}
        apiToken={apiToken}
      />
      <Toaster position="top-right" theme={theme} richColors closeButton />
    </div>
  )
}

export default BrowserShell
