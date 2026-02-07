import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Add click listener to intercept sub-app links
if (typeof window !== 'undefined') {
  // Capture click events globally
  window.addEventListener('click', (e) => {
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
  }, true)

  // Intercept window.open
  const originalWindowOpen = window.open
  // @ts-ignore
  window.open = (url: string, target?: string, features?: string) => {
    if (url && typeof url === 'string' && (url.includes('reytechz.my.id') || url.includes('mmaxup.com'))) {
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
      close: () => { },
      onclick: null,
      onclose: null,
      onerror: null,
      onshow: null,
      addEventListener: () => { },
      removeEventListener: () => { },
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
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (query) => {
        if (query.name === 'notifications') {
          console.log('[Guest Notification] navigator.permissions.query mocked for notifications')
          return Promise.resolve({
            state: 'granted',
            onchange: null,
            name: 'notifications'
          } as any);
        }
        return originalQuery.call(navigator.permissions, query);
      };
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
    ServiceWorkerRegistration.prototype.showNotification = function (title: string, options?: NotificationOptions) {
      console.log(`[Guest SW Notification] Requesting: ${title}`, options)
      // @ts-ignore
      const { ipcRenderer } = electronAPI
      ipcRenderer.sendToHost('show-notification', { title, options })
      return Promise.resolve()
    }
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
