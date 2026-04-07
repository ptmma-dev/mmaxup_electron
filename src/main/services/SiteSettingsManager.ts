import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

interface SiteSettings {
  notifications: boolean
}

interface SettingsStore {
  [origin: string]: SiteSettings
}

export class SiteSettingsManager {
  private path: string
  private settings: SettingsStore = {}

  constructor() {
    this.path = join(app.getPath('userData'), 'site-settings.json')
    this.load()
  }

  private load() {
    try {
      if (existsSync(this.path)) {
        this.settings = JSON.parse(readFileSync(this.path, 'utf8'))
      }
    } catch (error) {
      console.error('[SiteSettings] Failed to load settings:', error)
      this.settings = {}
    }
  }

  public save() {
    try {
      writeFileSync(this.path, JSON.stringify(this.settings, null, 2))
    } catch (error) {
      console.error('[SiteSettings] Failed to save settings:', error)
    }
  }

  public getSettings(origin: string): SiteSettings {
    // Default settings logic
    const defaults: SiteSettings = {
      notifications: true // Notifications usually okay to ask/allow
    }

    return { ...defaults, ...(this.settings[origin] || {}) }
  }

  public updateSettings(origin: string, newSettings: Partial<SiteSettings>) {
    const current = this.getSettings(origin)
    this.settings[origin] = { ...current, ...newSettings }
    this.save()
    return this.settings[origin]
  }

  public clearSettings(origin: string) {
    if (this.settings[origin]) {
      delete this.settings[origin]
      this.save()
    }
  }
}
