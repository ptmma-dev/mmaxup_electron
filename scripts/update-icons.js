const png2icons = require('png2icons')
const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')

// Configuration
const RESOURCES_DIR = path.join(__dirname, '../resources')
const ASSETS_ICONS_DIR = path.join(__dirname, '../assets/icons')
const PNG_DIR = path.join(ASSETS_ICONS_DIR, 'png')
const SVG_SOURCE = path.join(RESOURCES_DIR, 'icon.svg')

const run = async () => {
  console.log('Starting standard icon update process...')

    // Ensure directories exist
    ;[ASSETS_ICONS_DIR, PNG_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    })

  if (!fs.existsSync(SVG_SOURCE)) {
    console.error(`Error: Source SVG not found at ${SVG_SOURCE}`)
    app.quit()
    return
  }

  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

  console.log('1. Generating multi-size PNGs from SVG...')
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })

  win.loadFile(SVG_SOURCE)

  await new Promise((resolve) => {
    win.webContents.on('did-finish-load', async () => {
      setTimeout(async () => {
        for (const size of sizes) {
          console.log(`   - Generating ${size}x${size} PNG...`)
          // Resize the window to the target size for better rendering
          win.setSize(size, size)

          const image = await win.capturePage()
          const buffer = image.toPNG()
          const outputPath = path.join(PNG_DIR, `${size}x${size}.png`)
          fs.writeFileSync(outputPath, buffer)

          // Also save a copy as icon.png for dev/main process usage (using 1024)
          if (size === 1024) {
            fs.writeFileSync(path.join(ASSETS_ICONS_DIR, 'icon.png'), buffer)
            fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.png'), buffer)
          }
        }
        resolve()
      }, 500)
    })
  })

  console.log('2. Generating ICO and ICNS files...')
  try {
    const mainPngPath = path.join(ASSETS_ICONS_DIR, 'icon.png')
    const input = fs.readFileSync(mainPngPath)

    // ICNS
    const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0)
    if (icns) {
      fs.writeFileSync(path.join(ASSETS_ICONS_DIR, 'icon.icns'), icns)
      console.log('   - Saved icon.icns')
    }

    // ICO
    const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, false)
    if (ico) {
      fs.writeFileSync(path.join(ASSETS_ICONS_DIR, 'icon.ico'), ico)
      console.log('   - Saved icon.ico')
    }
  } catch (error) {
    console.error('Error generating ICO/ICNS:', error)
  }

  console.log('Done! All standard icons updated.')
  app.quit()
}

app.whenReady().then(run)
