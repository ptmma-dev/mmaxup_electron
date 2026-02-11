import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Notification,
  session,
  Tray,
  Menu,
  nativeTheme,
  safeStorage,
  nativeImage
} from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { optimizer, is } from '@electron-toolkit/utils'
import { logInfo, logError } from './logger'
// Import icon for asset tracking
import iconAsset from '../../resources/icon.png?asset'

// Determine absolute icon path for robustness (especially for Linux taskbar)
const iconPath = join(__dirname, '../../assets/icons/icon.png')
const icon = nativeImage.createFromPath(iconPath)

// Detailed logging for icon loading
logInfo(`Icon asset import path: ${iconAsset}`)
logInfo(`Icon absolute path: ${iconPath}`)
logInfo(`Icon file exists: ${existsSync(iconPath)}`)
logInfo(`NativeImage created. Empty? ${icon.isEmpty()}`)
if (!icon.isEmpty()) {
  const size = icon.getSize()
  logInfo(`Icon dimensions: ${size.width}x${size.height}`)
} else {
  logError('Application icon is EMPTY. Taskbar/Window icon may not appear.')
}

// Set app identity early for OS recognition (especially Linux/Wayland/Hyprland)
// Use the slug-case name to match the executable and desktop file name
// for better window manager association.
logInfo(`Setting app name to: mymma-app`)
app.name = 'mymma-app'
app.setAppUserModelId('com.mymma.app')

if (process.platform === 'linux') {
  // Helps Wayland compositors find the .desktop file
  // Using the base name (slug) is often more reliable than the full desktop filename.
  ; (app as any).setDesktopName('mymma-app')
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()

      // Protocol handler for Windows/Linux
      const url = commandLine.pop()
      if (url && url.startsWith('mmaxup://')) {
        console.log('[Protocol] Deep link received via second-instance:', url)
        mainWindow.webContents.send('protocol-link', url)
      }
    }
  })
}

// Register protocol client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('mmaxup', process.execPath, [join(__dirname, '../../')])
  }
} else {
  app.setAsDefaultProtocolClient('mmaxup')
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
    icon,
    // @ts-ignore: wmClass is specific to Linux/X11
    wmClass: 'mymma-app',
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

  // Secure Credential Storage IPC
  const credentialsPath = join(app.getPath('userData'), 'credentials.json')

  // Helper to check encryption availability
  const isEncryptionAvailable = () => {
    return process.platform !== 'linux' || safeStorage.isEncryptionAvailable()
  }

  ipcMain.handle('credentials:get', async (_event) => {
    if (!existsSync(credentialsPath)) {
      return []
    }
    try {
      const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      const allCreds: any[] = []

      // Flatten structure for UI: { id, domain, username, password }
      Object.keys(data).forEach((domain) => {
        data[domain].forEach((cred: any) => {
          try {
            const unlockedPassword =
              isEncryptionAvailable() && cred.encrypted
                ? safeStorage.decryptString(Buffer.from(cred.password, 'base64'))
                : cred.password

            allCreds.push({
              id: `${domain}-${cred.username}`,
              domain,
              username: cred.username,
              password: unlockedPassword
            })
          } catch (err) {
            console.error(`[Credentials] Failed to decrypt for ${domain}/${cred.username}`, err)
          }
        })
      })

      return allCreds
    } catch (err) {
      console.error('[Credentials] Error reading credentials:', err)
      return []
    }
  })

  ipcMain.handle('credentials:save', async (_event, { domain, username, password }) => {
    let data: any = {}
    if (existsSync(credentialsPath)) {
      try {
        data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      } catch (err) {
        console.error('[Credentials] Error parsing existing credentials:', err)
      }
    }

    if (!data[domain]) {
      data[domain] = []
    }

    // Encrypt password if possible
    const canEncrypt = isEncryptionAvailable()
    const finalPassword = canEncrypt
      ? safeStorage.encryptString(password).toString('base64')
      : password

    // Check if account already exists
    const index = data[domain].findIndex((c: any) => c.username === username)
    if (index !== -1) {
      data[domain][index].password = finalPassword
      data[domain][index].encrypted = canEncrypt
    } else {
      data[domain].push({ username, password: finalPassword, encrypted: canEncrypt })
    }

    try {
      writeFileSync(credentialsPath, JSON.stringify(data, null, 2))
      return { success: true }
    } catch (err) {
      console.error('[Credentials] Error saving credentials:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // File System Operations
  ipcMain.handle('shell:open-file', async (_event, { path }) => {
    if (!path) return { success: false, error: 'No path provided' }
    try {
      const result = await shell.openPath(path)
      return { success: !result, error: result }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('shell:show-in-folder', async (_event, { path }) => {
    if (!path) return { success: false, error: 'No path provided' }
    try {
      shell.showItemInFolder(path)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('credentials:delete', async (_event, { domain, username }) => {
    if (!existsSync(credentialsPath)) {
      return { success: false }
    }
    try {
      const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      if (data[domain]) {
        data[domain] = data[domain].filter((c: any) => c.username !== username)
        if (data[domain].length === 0) {
          delete data[domain]
        }
        writeFileSync(credentialsPath, JSON.stringify(data, null, 2))
        return { success: true }
      }
      return { success: false }
    } catch (err) {
      console.error('[Credentials] Error deleting credentials:', err)
      return { success: false, error: (err as Error).message }
    }
  })

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

    // Use main app icon logic if specific icon not provided or if we want to enforce consistency
    // In this case, we default to the main app icon if no specific icon is provided,
    // or if the logic previously forced a notification icon.
    if (!finalIcon) {
      finalIcon = iconPath
    }

    console.log(`[Notification] Platform: ${process.platform}`)
    console.log(`[Notification] Final Icon Path: ${finalIcon}`)

    if (!Notification.isSupported()) {
      console.error('[Notification] Native notifications are NOT supported on this system')
      return
    }

    try {
      const notificationParams: any = {
        title,
        body: options?.body,
        silent: options?.silent
      }

      // Load icon as nativeImage
      let iconImage: any = null
      if (finalIcon) {
        // Try loading from absolute path if available, or fallback
        // Since we are now using the main icon mostly, it's simpler.
        // If finalIcon is the imported 'icon' string (path), we can try to use it.

        // Check if it's the imported asset path (which might be a transformed path in dev)
        // or a file path.
        if (typeof finalIcon === 'string') {
          iconImage = nativeImage.createFromPath(finalIcon.replace('file://', ''))
        }

        if (iconImage && !iconImage.isEmpty()) {
          console.log('[Notification] User provided icon loaded successfully')
        } else {
          // Fallback to main resources icon if needed
          const absoluteIconPath = join(__dirname, '../../resources/icon.png')
          iconImage = nativeImage.createFromPath(absoluteIconPath)
        }
      }

      // On Linux, providing the app icon explicitly often results in stacking/redundancy
      // if the identity is not perfectly matched.
      if (process.platform === 'linux') {
        // Only provide icon if it's NOT the main app icon to allow clean badging
        // But since we removed the separate notification icon, we likely want to verify behavior.
        // If we want the main icon, we often DON'T pass it explicitly if app.desktopName / app.name matches.

        // However, if we want to ensure the rounded icon is used (and not a generic system one),
        // we might still want to pass it if the system isn't picking it up automatically.
        // For now, let's pass it if it's explicitly loaded, to ensure our new rounded look is used.
        if (iconImage && !iconImage.isEmpty()) {
          notificationParams.icon = iconImage
        }
      } else {
        if (iconImage && !iconImage.isEmpty()) {
          notificationParams.icon = iconImage
        }
      }

      const notification = new Notification(notificationParams)

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
  // app.setAppUserModelId('com.mymma.app') // Moved to top-level

  // Set app name explicitly
  // app.name = 'MyMMA App' // Moved to top-level

  // Set default window icon behavior for Linux
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
  }

  console.log(`[System Check] Notifications Supported: ${Notification.isSupported()}`)
  console.log(
    `[System Check] Theme: shouldUseDarkColors=${nativeTheme.shouldUseDarkColors}, themeSource=${nativeTheme.themeSource}`
  )

  nativeTheme.on('updated', () => {
    console.log(
      '[System Check] nativeTheme updated! shouldUseDarkColors:',
      nativeTheme.shouldUseDarkColors
    )
  })

  // Enforce permissions globally for the default session
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL()
    console.log(`[Permission Request] ${permission} for ${url}`)

    // Auto-grant for sub-apps or specifically for notifications
    if (
      url.includes('reytechz.my.id') ||
      url.includes('mmaxup.com') ||
      permission === 'notifications'
    ) {
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
  ; (app as any).isQuitting = true
  console.log('[App] App is quitting')
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function checkForUpdates(): void {
  console.log('[Update] Initializing check. Current version:', app.getVersion())

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('checking-for-update', () => {
    console.log('[Update] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Update] Update available:', info.version, 'Release date:', info.releaseDate)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Update] Update not available. Current version is latest:', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[Update] Error in auto-updater:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + Math.floor(progressObj.percent) + '%'
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
      console.log('[Update] Update notification clicked. Quitting and installing...')
      autoUpdater.quitAndInstall()
    })

    notification.show()
  })
}
