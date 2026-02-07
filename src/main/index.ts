import { app, shell, BrowserWindow, ipcMain, Notification, session, Tray, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Debug: Log icon path
console.log('[Icon] Using icon path:', icon)
console.log('[Icon] Absolute path:', join(__dirname, '../../resources/icon.png'))

// Extend App type to include custom property via type casting where used
// since multiple definitions can conflict in some TS configurations

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

let tray: Tray | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const preloadPath = join(__dirname, '../preload/index.js')

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle request for preload path
  ipcMain.handle('get-preload-path', () => preloadPath)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Window Management IPC
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.on('window-close', () => {
    // Hide to tray instead of closing
    mainWindow.hide()
  })

  // Prevent window from being destroyed when closed
  mainWindow.on('close', (event) => {
    // Check if app is quitting (Cmd+Q, Quit from menu, etc.)
    if (!(app as any).isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Native Notification Trigger
  ipcMain.on('trigger-native-notification', (_event, { title, options }) => {
    // Determine the best icon
    let finalIcon = options?.icon

    // If it's a generic favicon or missing, use the high-res app icon
    if (!finalIcon || finalIcon.includes('favicon') || finalIcon.includes('logo.svg')) {
      finalIcon = icon
    }

    console.log(`[IPC] trigger-native-notification for "${title}"`, {
      body: options?.body,
      iconUsed: finalIcon
    })

    if (!Notification.isSupported()) {
      console.error('[Notification] Native notifications are NOT supported on this system')
      return
    }

    try {
      const notification = new Notification({
        title,
        body: options?.body,
        icon: finalIcon,
        silent: options?.silent
      })

      notification.on('show', () => console.log(`[Notification] "${title}" is now visible`))
      notification.on('click', () => {
        console.log(`[Notification] "${title}" clicked`)
        const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('focus-tab', { tabId: options?.data?.tabId })
        }
      })

      notification.show()
      console.log(`[Notification] .show() called for "${title}"`)
    } catch (err) {
      console.error(`[Notification] Direct exception for "${title}":`, err)
    }
  })
}

function createTray(): void {
  // Use the same icon imported at the top
  console.log('[Tray] Creating system tray with icon:', icon)

  // Create tray icon
  tray = new Tray(icon)

  // Set tooltip
  tray.setToolTip('MyMMA App')

  // Click tray icon to show/hide window
  tray.on('click', () => {
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  // Context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MyMMA',
      click: () => {
        const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  console.log('[Tray] System tray icon created successfully')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows/linux notifications
  app.setAppUserModelId('com.mymma.app')

  // Set app name explicitly
  app.name = 'MyMMA App'

  // Set default window icon behavior for Linux
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
  }

  console.log(`[System Check] Notifications Supported: ${Notification.isSupported()}`)

  // Enforce permissions globally for the default session
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL()
    console.log(`[Permission Request] ${permission} for ${url}`)

    // Auto-grant for sub-apps or specifically for notifications
    if (url.includes('reytechz.my.id') || url.includes('mmaxup.com') || permission === 'notifications') {
      console.log(`[Permission Granted] ${permission}`)
      return callback(true)
    }
    callback(false)
  })

  console.log(`[System Check] Notifications Supported: ${Notification.isSupported()}`)

  // Create download directory
  const downloadDir = join(homedir(), 'MyMMA Downloads')
  if (!existsSync(downloadDir)) {
    mkdirSync(downloadDir, { recursive: true })
  }

  session.defaultSession.on('will-download', (_event, item) => {
    // Set the save path, which also tells Electron not to prompt a save dialog.
    const fileName = item.getFilename()
    const filePath = join(downloadDir, fileName)
    item.setSavePath(filePath)

    const downloadId = Date.now().toString()
    const date = new Date().toLocaleString()

    // Notify renderer about the new download
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      mainWindow.webContents.send('download-started', {
        id: downloadId,
        fileName,
        date,
        totalBytes: item.getTotalBytes()
      })
    }

    item.on('updated', (_event, state) => {
      if (state === 'progressing') {
        if (!item.isPaused() && mainWindow) {
          mainWindow.webContents.send('download-progress', {
            id: downloadId,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes()
          })
        }
      }
    })

    item.once('done', (_event, state) => {
      if (state === 'completed') {
        if (mainWindow) {
          mainWindow.webContents.send('download-completed', {
            id: downloadId,
            filePath
          })
        }
      } else {
        if (mainWindow) {
          mainWindow.webContents.send('download-failed', {
            id: downloadId,
            reason: state
          })
        }
      }
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('[IPC] Received: ping (pong)'))

  createWindow()
  createTray()
  checkForUpdates()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Global handler for all windows and webviews
  app.on('web-contents-created', (_, contents) => {
    // Force webview preferences
    contents.on('will-attach-webview', (_, webPreferences) => {
      const pPath = join(__dirname, '../preload/index.js')
      console.log('[System] Webview attaching, forcing contextIsolation: false')
      webPreferences.contextIsolation = false
      webPreferences.preload = pPath
    })

    // Set custom User Agent for all contents
    const originalUserAgent = contents.getUserAgent()
    contents.setUserAgent(`${originalUserAgent} MyMMADesktop/1.0.0`)

    contents.setWindowOpenHandler((details) => {
      const url = details.url
      // If it's a sub-app, notify the main window to open a tab
      if (url.includes('reytechz.my.id') || url.includes('mmaxup.com')) {
        const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
        if (mainWindow) {
          mainWindow.webContents.send('open-app-tab-from-main', {
            url,
            name: 'New Tab',
            id: `tab-${Date.now()}`
          })
        }
        return { action: 'deny' }
      }
      return { action: 'allow' }
    })
  })
})

// Don't quit when all windows are closed - keep running in tray
app.on('window-all-closed', () => {
  // Don't quit - app stays in tray
  console.log('[App] All windows closed, but app stays in tray')
})

// Set flag when app is quitting
app.on('before-quit', () => {
  (app as any).isQuitting = true
  console.log('[App] App is quitting')
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function checkForUpdates(): void {
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Update] Update available:', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Update] Update not available:', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[Update] Error in auto-updater:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
    console.log('[Update] ' + log_message)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Update] Update downloaded:', info.version)

    // Notify user
    const notification = new Notification({
      title: 'Update Ready',
      body: `Version ${info.version} has been downloaded and will be installed on restart.`
    })

    notification.on('click', () => {
      autoUpdater.quitAndInstall()
    })

    notification.show()
  })
}
