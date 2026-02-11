import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Add click listener to intercept sub-app links
if (typeof window !== 'undefined') {
  // Capture click events globally
  window.addEventListener(
    'click',
    (e) => {
      const target = (e.target as HTMLElement).closest('a')
      if (target && target.dataset.shellTabId) {
        // Strictly block natural navigation to ensure shell control
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        // Extract metadata and notify the host
        const tabId = target.dataset.shellTabId
        const tabName = target.dataset.shellTabName || target.innerText
        const tabIcon = target.dataset.shellTabIcon
        const tabUrl = target.href

        // Send to host renderer via ipc-message
        // @ts-ignore
        const { ipcRenderer } = electronAPI
        ipcRenderer.sendToHost('open-app-tab', {
          id: tabId,
          name: tabName,
          icon: tabIcon,
          url: tabUrl
        })
      }
    },
    true
  )

  // Intercept window.open
  const originalWindowOpen = window.open
  // @ts-ignore
  window.open = (url: string, target?: string, features?: string) => {
    if (
      url &&
      typeof url === 'string' &&
      (url.includes('reytechz.my.id') || url.includes('mmaxup.com'))
    ) {
      // Notify host to open a tab
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.send('open-app-tab', {
        id: `tab-${Date.now()}`,
        name: 'New Tab',
        url,
        icon: null
      })
      return null
    }
    return originalWindowOpen.call(window, url, target, features)
  }

  // Expose window controls
  contextBridge.exposeInMainWorld('windowControls', {
    minimize: () => {
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.send('window-minimize')
    },
    maximize: () => {
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.send('window-maximize')
    },
    close: () => {
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.send('window-close')
    }
  })
  // Inject host detection flag for sub-apps
  // @ts-ignore
  window.isMyMMADesktop = true

  // Bridge window.Notification

  // @ts-ignore
  window.Notification = function (title: string, options?: NotificationOptions) {
    console.log(`[Guest Notification] Requesting: ${title}`, options)
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.sendToHost('show-notification', { title, options })

    return {
      close: () => {},
      onclick: null,
      onclose: null,
      onerror: null,
      onshow: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true
    }
  }

  // Force permission to granted using defineProperty for read-only prop
  try {
    Object.defineProperty(window.Notification, 'permission', {
      get: () => 'granted',
      enumerable: true,
      configurable: true
    })

    // @ts-ignore
    window.Notification.requestPermission = () => {
      console.log('[Guest Notification] requestPermission called')
      return Promise.resolve('granted')
    }

    // Mock navigator.permissions.query
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query
      navigator.permissions.query = (query) => {
        if (query.name === 'notifications') {
          console.log('[Guest Notification] navigator.permissions.query mocked for notifications')
          return Promise.resolve({
            state: 'granted',
            onchange: null,
            name: 'notifications'
          } as any)
        }
        return originalQuery.call(navigator.permissions, query)
      }
    }
    console.log('[Guest Notification] Permissions successfully mocked to granted')
  } catch (e) {
    console.error('[Guest Notification] Failed to mock permissions', e)
  }

  // Bridge ServiceWorker notifications
  if ('ServiceWorkerRegistration' in window) {
    // @ts-ignore
    const originalShowNotification = ServiceWorkerRegistration.prototype.showNotification
    // @ts-ignore
    ServiceWorkerRegistration.prototype.showNotification = function (
      title: string,
      options?: NotificationOptions
    ) {
      console.log(`[Guest SW Notification] Requesting: ${title}`, options)
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.sendToHost('show-notification', { title, options })
      return Promise.resolve()
    }
  }

  // Login Detection and Auto-fill
  const loginLogic = async () => {
    const domain = window.location.hostname
    console.log('[Preload] Initializing login logic for:', domain)

    // @ts-ignore
    const { ipcRenderer } = electronAPI

    // Search for credentials from Main
    let storedCreds: any[] = []
    try {
      storedCreds = await ipcRenderer.invoke('credentials:get', { domain })
      console.log(`[Preload] Found ${storedCreds.length} stored credentials for ${domain}`)
    } catch (err) {
      console.error('[Preload] Error fetching credentials:', err)
    }

    let lastUsername = ''
    let lastPassword = ''

    const findLoginFields = () => {
      const passwordField = document.querySelector('input[type="password"]') as HTMLInputElement
      if (!passwordField) return null

      const form = passwordField.form
      let usernameField = form?.querySelector(
        'input[type="text"], input[type="email"], input:not([type]), input[autocomplete="username"]'
      ) as HTMLInputElement

      if (!usernameField) {
        usernameField = document.querySelector(
          'input[type="text"], input[type="email"], input[autocomplete="username"]'
        ) as HTMLInputElement
      }

      return { usernameField, passwordField, form }
    }

    const autofill = () => {
      if (storedCreds && storedCreds.length > 0) {
        const fields = findLoginFields()
        if (fields && fields.usernameField && fields.passwordField) {
          console.log('[Preload] Found fields, attempting autofill...')
          const lastUsed = storedCreds[0]

          // Only fill if empty to avoid overwriting user input
          if (!fields.usernameField.value) fields.usernameField.value = lastUsed.username
          if (!fields.passwordField.value) fields.passwordField.value = lastUsed.password

          fields.usernameField.dispatchEvent(new Event('input', { bubbles: true }))
          fields.passwordField.dispatchEvent(new Event('input', { bubbles: true }))
          fields.usernameField.dispatchEvent(new Event('change', { bubbles: true }))
          fields.passwordField.dispatchEvent(new Event('change', { bubbles: true }))
          console.log('[Preload] Autofill complete for:', lastUsed.username)
        } else {
          // Debug why it failed
          const pwd = document.querySelector('input[type="password"]')
          console.log('[Preload] Autofill retrying... Password field found?', !!pwd)

          // List all inputs to see what's actually there
          const allInputs = Array.from(document.querySelectorAll('input'))
          console.log(`[Preload] Total inputs found: ${allInputs.length}`)
          allInputs.forEach((inp, i) => {
            console.log(
              `[Input ${i}] Type: ${inp.type}, Name: ${inp.name}, ID: ${inp.id}, Class: ${inp.className}`
            )
          })
        }
      }
    }

    const captureCredentials = () => {
      const fields = findLoginFields()
      const username = fields?.usernameField?.value || lastUsername
      const password = fields?.passwordField?.value || lastPassword

      // Detect "Remember Me" checkbox
      let remember = false
      if (fields?.form) {
        const rememberCheckbox = fields.form.querySelector(
          'input[type="checkbox"][name="remember"], input[type="checkbox"][id*="remember"]'
        ) as HTMLInputElement
        if (rememberCheckbox) {
          remember = rememberCheckbox.checked
          console.log('[Preload] Remember checkbox found:', {
            checked: remember,
            name: rememberCheckbox.name,
            id: rememberCheckbox.id
          })
        } else {
          console.log('[Preload] Remember checkbox NOT found in form')
        }
      }

      console.log('[Preload] Capture attempt:', {
        domain,
        hasUsername: !!username,
        hasPassword: !!password,
        remember,
        usernameLength: username?.length,
        passwordLength: password?.length
      })

      if (username && password) {
        const alreadySaved = storedCreds.find(
          (c: any) => c.username === username && c.password === password
        )

        // Auto-save if 'Remember Me' is checked or if it's a new credential
        if (!alreadySaved || remember) {
          console.log('[Preload] Sending credentials:capture event', { domain, username, remember })
          ipcRenderer.sendToHost('credentials:capture', { domain, username, password, remember })
        } else {
          console.log('[Preload] Skipping - already saved and remember=false')
        }
      }
    }

    // Keep track of input values in real-time
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target.type === 'password') {
        lastPassword = target.value
      } else if (target.type === 'text' || target.type === 'email' || !target.type) {
        lastUsername = target.value
      }
    }

    document.addEventListener('input', handleInput, true)
    document.addEventListener('change', handleInput, true)

    // Initial check
    autofill()

    // Watch for dynamic changes
    const observer = new MutationObserver(() => {
      autofill()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // Simple approach: capture after password is entered and user waits 2 seconds
    let captureTimeout: any = null

    // Capture triggers
    document.addEventListener(
      'submit',
      () => {
        console.log('[Preload] Form submit detected')
        captureCredentials()
      },
      true
    )

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement
        // Safely get text content
        const text = target.innerText?.toLowerCase() || ''

        // Safely check ID
        const id = typeof target.id === 'string' ? target.id.toLowerCase() : ''

        // Safely check Class
        let className = ''
        if (typeof target.className === 'string') {
          className = target.className.toLowerCase()
        } else if (target.classList && target.classList.value) {
          className = target.classList.value.toLowerCase()
        }

        const loginRegex = /log[\s-]?in|sign[\s-]?in|masuk|submit/i
        if (loginRegex.test(text) || loginRegex.test(id) || loginRegex.test(className)) {
          console.log('[Preload] Login button clicked')
          setTimeout(captureCredentials, 100)
        }
      },
      true
    )

    // Also trigger capture when password field loses focus (user finished typing)
    document.addEventListener(
      'focusout',
      (e) => {
        const target = e.target as HTMLInputElement
        console.log('[Preload] Focusout event:', {
          tagName: target.tagName,
          type: target.type,
          name: target.name,
          autocomplete: target.autocomplete,
          hasValue: !!target.value
        })

        // Check if it's a password field by type, name, or autocomplete attribute
        const isPasswordField =
          target.type === 'password' ||
          target.name?.toLowerCase().includes('password') ||
          target.name?.toLowerCase().includes('kata') ||
          target.autocomplete === 'current-password'

        if (isPasswordField && target.value) {
          console.log('[Preload] Password field lost focus, scheduling capture')
          // Clear any existing timeout
          if (captureTimeout) clearTimeout(captureTimeout)
          // Capture after 2 seconds of inactivity
          captureTimeout = setTimeout(() => {
            console.log('[Preload] Delayed capture triggered')
            captureCredentials()
          }, 2000)
        }
      },
      true
    )

    console.log('[Preload] All event listeners registered successfully')

    window.addEventListener('beforeunload', () => {
      console.log('[Preload] Page unloading, final capture attempt')
      captureCredentials()
    })
  }

  // Run login logic after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loginLogic)
  } else {
    loginLogic()
  }
}

// Expose explicit MyMMA Bridge API
const myMMABridge = {
  showNotification: (title: string, options?: NotificationOptions) => {
    console.log(`[MyMMA Bridge] showNotification: ${title}`)
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.sendToHost('show-notification', { title, options })
  },
  onDownloadStarted: (callback: (data: any) => void) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.on('download-started', (_event, value) => callback(value))
  },
  onDownloadProgress: (callback: (data: any) => void) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.on('download-progress', (_event, value) => callback(value))
  },
  onDownloadCompleted: (callback: (data: any) => void) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.on('download-completed', (_event, value) => callback(value))
  },
  onDownloadFailed: (callback: (data: any) => void) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    ipcRenderer.on('download-failed', (_event, value) => callback(value))
  },
  saveCredentials: (domain: string, username: string, password: string) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    return ipcRenderer.invoke('credentials:save', { domain, username, password })
  },
  getCredentials: (domain: string) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    return ipcRenderer.invoke('credentials:get', { domain })
  },
  openFile: (path: string) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    return ipcRenderer.invoke('shell:open-file', { path })
  },
  showInFolder: (path: string) => {
    // @ts-ignore
    const { ipcRenderer } = electronAPI
    return ipcRenderer.invoke('shell:show-in-folder', { path })
  },
  isDesktop: true
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('myMMA', myMMABridge)
    contextBridge.exposeInMainWorld('isMyMMADesktop', true)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore
  window.myMMA = myMMABridge
  // @ts-ignore
  window.isMyMMADesktop = true
}
