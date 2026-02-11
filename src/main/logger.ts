import { app } from 'electron'
import { join } from 'path'
import { appendFileSync } from 'fs'

// The log file will be located in the user data directory
// e.g., ~/.config/mymma-app/app.log on Linux
const logFile = join(app.getPath('userData'), 'app.log')

export const log = (message: string, level: 'INFO' | 'ERROR' = 'INFO') => {
    const timestamp = new Date().toISOString()
    const formattedMessage = `[${timestamp}] [${level}] ${message}\n`

    // Always log to console for terminal visibility
    if (level === 'ERROR') {
        console.error(formattedMessage.trim())
    } else {
        console.log(formattedMessage.trim())
    }

    try {
        appendFileSync(logFile, formattedMessage)
    } catch (err) {
        console.error('Failed to write to log file:', err)
    }
}

export const logInfo = (message: string) => log(message, 'INFO')
export const logError = (message: string) => log(message, 'ERROR')

// Initial entry
logInfo('--- Log Session Started ---')
logInfo(`Log file: ${logFile}`)
logInfo(`Platform: ${process.platform}`)
logInfo(`App Version: ${app.getVersion()}`)
