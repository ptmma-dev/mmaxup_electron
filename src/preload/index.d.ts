import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    myMMA: {
      showNotification: (title: string, options?: NotificationOptions) => void
      onDownloadStarted: (callback: (data: any) => void) => void
      onDownloadProgress: (callback: (data: any) => void) => void
      onDownloadCompleted: (callback: (data: any) => void) => void
      onDownloadFailed: (callback: (data: any) => void) => void
      saveCredentials: (domain: string, username: string, password: string) => Promise<any>
      getCredentials: (domain: string) => Promise<any>
      getDownloadHistory: () => Promise<any[]>
      removeDownloadHistory: (id: string) => Promise<any>
      openFile: (path: string) => Promise<any>
      showInFolder: (path: string) => Promise<any>
      syncEmails: (backendUrl: string, apiToken: string) => Promise<any>
      updateEmailFlags: (
        accountId: number,
        folder: string,
        uid: number,
        flags: string[],
        action: string
      ) => Promise<any>
      moveEmail: (
        accountId: number,
        sourceFolder: string,
        uid: number,
        targetFolder: string
      ) => Promise<any>
      saveDraft: (accountId: number, data: any) => Promise<any>
      deleteEmail: (accountId: number, folder: string, uid: number) => Promise<any>
      sendEmail: (
        backendUrl: string,
        apiToken: string,
        accountId: number,
        data: { to: string; subject: string; body: string }
      ) => Promise<any>
      downloadAttachment: (
        backendUrl: string,
        apiToken: string,
        emlSource: string,
        filename: string
      ) => Promise<any>
      startEmailWatch: (backendUrl: string, apiToken: string) => Promise<any>
      stopEmailWatch: () => Promise<any>
      getDesktopSettings: () => Promise<any>
      setDesktopSettings: (settings: {
        startOnBackground?: boolean
        startOnTray?: boolean
      }) => Promise<any>
      isDesktop: boolean
    }
    isMyMMADesktop: boolean
  }
}
