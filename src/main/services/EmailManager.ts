import { simpleParser } from 'mailparser'
import { ImapFlow } from 'imapflow'
import axios from 'axios'
import nodemailer from 'nodemailer'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { createHash } from 'crypto'

export interface EmailConfig {
  host: string
  port: number
  tls: boolean
  user: string
  pass: string
}

export class EmailManager {
  private idleClients: Map<number, ImapFlow> = new Map()

  constructor(
    private backendUrl: string,
    private apiToken: string
  ) { }

  private getStableMessageId(parsed: any, accountUser: string): string {
    if (parsed.messageId) {
      const raw = parsed.messageId
      return raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw
    }

    // No Message-ID, create a stable fingerprint hash from headers
    const fingerprint = `${parsed.from?.text || 'unknown'}|${parsed.subject || ''}|${parsed.date?.getTime() || 0}`
    const hash = createHash('sha256').update(fingerprint).digest('hex')
    return `fp-${accountUser.split('@')[0]}-${hash.substring(0, 16)}`
  }

  private categorizeError(err: any): string {
    const code = err.code || ''
    const message = err.message || ''

    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return 'Koneksi ke server gagal (Masalah DNS). Silakan periksa koneksi internet Anda atau pastikan alamat server benar.'
    }

    if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
      return 'Koneksi ke server ditolak atau terputus. Server backend mungkin sedang down.'
    }

    if (code === 'ETIMEDOUT') {
      return 'Koneksi ke server timeout. Silakan coba beberapa saat lagi.'
    }

    if (axios.isAxiosError(err)) {
      if (!err.response) {
        return 'Tidak dapat menghubungi server backend. Silakan pastikan Anda terhubung ke internet.'
      }
      if (err.response.status === 401) {
        return 'Sesi Anda telah berakhir. Silakan login kembali.'
      }
      return `Gagal menghubungi server backend (${err.response.status}).`
    }

    if (message.includes('Connection not available')) {
      return 'Koneksi internet tidak tersedia atau jalur ke server terputus.'
    }

    return message || 'Terjadi kesalahan yang tidak diketahui.'
  }

  async syncAllAccounts() {
    try {
      const response = await axios
        .get(`${this.backendUrl}/api/email-accounts`, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            Accept: 'application/json'
          }
        })
        .catch((err) => {
          throw new Error(this.categorizeError(err))
        })

      const accounts = response.data
      const allResults: any[] = []
      const newEmails: any[] = []

      for (const account of accounts) {
        console.log(`[EmailSync] Syncing account (IMAP): ${account.username}@${account.host}`)
        let client: ImapFlow | null = null
        try {
          client = new ImapFlow({
            host: account.host,
            port: account.port,
            secure: account.port === 993,
            auth: {
              user: account.username,
              pass: account.password
            },
            // @ts-ignore
            tls: { rejectUnauthorized: true },
            logger: false
          })

          await client.connect().catch((err) => {
            throw new Error(`Gagal login ke email ${account.username}: ${this.categorizeError(err)}`)
          })

          const folders = await client.list()
          for (const folder of folders) {
            if (folder.flags && folder.flags.has('\\Noselect')) continue

            let folderName = 'inbox'
            const path = folder.path.toLowerCase()
            if (folder.specialUse === '\\Sent' || path.includes('sent') || path.includes('terkirim'))
              folderName = 'sent'
            else if (
              folder.specialUse === '\\Archive' ||
              path.includes('archive') ||
              path.includes('arsip')
            )
              folderName = 'archive'
            else if (
              folder.specialUse === '\\Trash' ||
              path.includes('trash') ||
              path.includes('sampah') ||
              path.includes('bin') ||
              path.includes('deleted')
            )
              folderName = 'trash'
            else if (
              folder.specialUse === '\\Drafts' ||
              path.includes('draft') ||
              path.includes('draf')
            )
              folderName = 'drafts'
            else if (
              folder.specialUse === '\\Junk' ||
              path.includes('spam') ||
              path.includes('junk')
            )
              folderName = 'spam'
            else if (path === 'inbox') folderName = 'inbox'
            else continue

            let lock = await client.getMailboxLock(folder.path)
            try {
              const status = await client.status(folder.path, { messages: true })
              if (status.messages === 0) {
                lock.release()
                continue
              }

              for await (let message of client.fetch('1:*', {
                envelope: true,
                source: true,
                uid: true,
                flags: true
              })) {
                try {
                  if (message.flags && message.flags.has('\\Deleted')) continue

                  const raw = message.source
                  if (!raw) continue

                  const parsed = await simpleParser(raw)
                  const messageId = this.getStableMessageId(parsed, account.username)

                  const syncResponse = await axios.post(
                    `${this.backendUrl}/api/emails/sync`,
                    {
                      email_account_id: account.id,
                      message_id: messageId,
                      uid: message.uid,
                      folder: folderName,
                      folder_path: folder.path,
                      sender: parsed.from?.text || 'Unknown',
                      recipient: account.username,
                      cc: Array.isArray(parsed.cc) ? parsed.cc.map(a => a.text).join(', ') : (parsed.cc?.text || null),
                      bcc: Array.isArray(parsed.bcc) ? parsed.bcc.map(a => a.text).join(', ') : (parsed.bcc?.text || null),
                      subject: parsed.subject,
                      sent_at: parsed.date,
                      content: JSON.stringify({
                        html: parsed.html || false,
                        text: parsed.text || '',
                        eml: raw.toString()
                      }),
                      attachments_info: parsed.attachments.map((a) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size
                      })),
                      is_read: message.flags ? message.flags.has('\\Seen') : false,
                      is_starred: message.flags ? message.flags.has('\\Starred') : false
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${this.apiToken}`,
                        Accept: 'application/json'
                      }
                    }
                  )

                  if (syncResponse.status === 201 && folderName === 'inbox') {
                    newEmails.push({
                      account: account.username,
                      sender: parsed.from?.text || 'Unknown',
                      subject: parsed.subject || '(No Subject)',
                      date: parsed.date
                    })
                  }

                  allResults.push(syncResponse.data)
                } catch (msgErr: any) {
                  console.error(`[EmailSync] Error processing message:`, msgErr.message || msgErr)
                }
              }
            } finally {
              lock.release()
            }
          }
        } catch (accErr: any) {
          console.error(
            `[EmailSync] Failed to sync account ${account.username}:`,
            accErr.message || accErr
          )
        } finally {
          if (client) await client.logout()
        }
      }

      return { totalSynced: allResults.length, newEmails: newEmails }
    } catch (err: any) {
      console.error('[EmailSync] Error syncing all accounts:', err.message || err)
      throw err
    }
  }

  async sendEmail(accountId: number, data: { to: string; cc?: string; bcc?: string; subject: string; body: string; isHtml?: boolean }) {
    try {
      const response = await axios.get(`${this.backendUrl}/api/email-accounts/${accountId}`, {
        headers: { Authorization: `Bearer ${this.apiToken}` }
      })
      const account = response.data

      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port,
        secure: account.smtp_encryption === 'ssl',
        auth: { user: account.username, pass: account.password }
      })

      const mailOptions: any = {
        from: `"${account.username}" <${account.username}>`,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        attachments: (data as any).attachments?.map((a: any) => ({
          filename: a.name,
          content: a.data,
          encoding: 'base64'
        }))
      }

      if (data.isHtml) {
        mailOptions.html = data.body
        mailOptions.text = data.body.replace(/<[^>]*>?/gm, '')
      } else {
        mailOptions.text = data.body
      }

      const info = await transporter.sendMail(mailOptions)

      try {
        const streamTransport = nodemailer.createTransport({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        })
        const { message } = await streamTransport.sendMail(mailOptions)

        const wrap = await this.getClient(accountId)
        const client = wrap.client

        const sentFolder = await this.findFolderBySpecialUseOrCommonName(client, '\\Sent', [
          'sent',
          'sent messages',
          'sent items'
        ])
        if (sentFolder) {
          const appendResult = await client.append(sentFolder.path, message as any, ['\\Seen'])

          if (appendResult && (appendResult as any).uid) {
            const parsed = await simpleParser(message)
            const messageId = this.getStableMessageId(parsed, account.username)

            await axios.post(
              `${this.backendUrl}/api/emails/sync`,
              {
                email_account_id: account.id,
                message_id: messageId,
                uid: (appendResult as any).uid,
                sender: account.username,
                recipient: data.to,
                subject: data.subject,
                sent_at: new Date(),
                content: JSON.stringify({
                  html: data.isHtml ? data.body : false,
                  text: data.isHtml ? data.body.replace(/<[^>]*>?/gm, '') : data.body,
                  eml: message.toString()
                }),
                attachments_info:
                  (data as any).attachments?.map((a: any) => ({
                    filename: a.name,
                    contentType: 'application/octet-stream',
                    size: a.data.length
                  })) || [],
                folder: 'sent'
              },
              { headers: { Authorization: `Bearer ${this.apiToken}`, Accept: 'application/json' } }
            )
          }
        }
        await client.logout()
      } catch (sentErr: any) {
        console.error(
          `[EmailSend] Failed to save copy or sync sent email:`,
          sentErr.message || sentErr
        )
      }

      return { success: true, messageId: info.messageId }
    } catch (err: any) {
      console.error('[EmailSend] Error sending email:', err.message || err)
      throw err
    }
  }

  async extractAndSaveAttachment(emlSource: string, filename: string) {
    try {
      const parsed = await simpleParser(emlSource)
      const attachment = parsed.attachments.find((a) => a.filename === filename)
      if (!attachment) throw new Error(`Attachment "${filename}" not found.`)

      const downloadDir = join(homedir(), 'MyMMA Downloads')
      if (!existsSync(downloadDir)) mkdirSync(downloadDir, { recursive: true })

      const filePath = join(downloadDir, filename)
      writeFileSync(filePath, attachment.content)
      return { success: true, filePath }
    } catch (err: any) {
      console.error('[EmailSync] Error extracting attachment:', err.message || err)
      throw err
    }
  }

  async exportEmailAsEml(emlSource: string, filename: string) {
    try {
      const downloadDir = join(homedir(), 'MyMMA Downloads')
      if (!existsSync(downloadDir)) mkdirSync(downloadDir, { recursive: true })

      // Clean filename to prevent path traversal or invalid characters
      const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200) + '.eml'
      const filePath = join(downloadDir, safeFilename)

      writeFileSync(filePath, emlSource)
      return { success: true, filePath }
    } catch (err: any) {
      console.error('[EmailSync] Error exporting email as EML:', err.message || err)
      throw err
    }
  }

  async exportBulkEmails(emails: { emlSource: string; filename: string }[], folderName: string) {
    try {
      const parentDir = join(homedir(), 'MyMMA Downloads')
      if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const subDirName = `Export ${folderName} - ${timestamp}`
      const exportPath = join(parentDir, subDirName)
      mkdirSync(exportPath, { recursive: true })

      for (const email of emails) {
        const safeFilename = email.filename.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200) + '.eml'
        writeFileSync(join(exportPath, safeFilename), email.emlSource)
      }

      return { success: true, folderPath: exportPath, count: emails.length }
    } catch (err: any) {
      console.error('[EmailSync] Error bulk exporting emails:', err.message || err)
      throw err
    }
  }

  async exportToMbox(emails: { emlSource: string; sender: string; sentAt: string }[], folderName: string) {
    try {
      const downloadDir = join(homedir(), 'MyMMA Downloads')
      if (!existsSync(downloadDir) || !existsSync(downloadDir)) mkdirSync(downloadDir, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const safeFolderName = folderName.replace(/[/\\?%*:|"<>]/g, '-')
      const filename = `${safeFolderName}_Export_${timestamp}.mbox`
      const filePath = join(downloadDir, filename)

      let mboxContent = ''
      for (const email of emails) {
        const date = new Date(email.sentAt)
        const dateString = date.toString().replace(/GMT.*$/, '').trim()
        const sender = email.sender || 'unknown@example.com'

        // MBOX format starts with "From " (envelope sender)
        mboxContent += `From ${sender} ${dateString}\n`
        mboxContent += email.emlSource.trim() + '\n\n'
      }

      writeFileSync(filePath, mboxContent)
      return { success: true, filePath, count: emails.length }
    } catch (err: any) {
      console.error('[EmailSync] Error exporting to MBOX:', err.message || err)
      throw err
    }
  }

  async startWatching(onNewEmail: (email: any) => void) {
    try {
      await this.stopWatching()
      const response = await axios.get(`${this.backendUrl}/api/email-accounts`, {
        headers: { Authorization: `Bearer ${this.apiToken}`, Accept: 'application/json' }
      })

      for (const account of response.data) {
        try {
          const client = new ImapFlow({
            host: account.host,
            port: account.port,
            secure: account.port === 993,
            auth: { user: account.username, pass: account.password },
            // @ts-ignore
            tls: { rejectUnauthorized: true },
            logger: false,
            maxIdleTime: 20 * 60 * 1000
          })

          await client.connect()
          await client.mailboxOpen('INBOX')

          client.on('exists', async (data) => {
            try {
              for await (let message of client.fetch(data.count.toString(), {
                envelope: true,
                source: true,
                uid: true,
                flags: true
              })) {
                if (message.flags && message.flags.has('\\Deleted')) continue

                const raw = message.source
                if (!raw) continue
                const parsed = await simpleParser(raw)
                const messageId = this.getStableMessageId(parsed, account.username)

                await axios.post(
                  `${this.backendUrl}/api/emails/sync`,
                  {
                    email_account_id: account.id,
                    message_id: messageId,
                    uid: message.uid,
                    folder: 'inbox',
                    folder_path: 'INBOX',
                    sender: parsed.from?.text || 'Unknown',
                    recipient: account.username,
                    subject: parsed.subject,
                    sent_at: parsed.date,
                    content: JSON.stringify({
                      html: parsed.html || false,
                      text: parsed.text || '',
                      eml: raw.toString()
                    }),
                    attachments_info: parsed.attachments.map((a) => ({
                      filename: a.filename,
                      contentType: a.contentType,
                      size: a.size
                    })),
                    is_read: message.flags ? message.flags.has('\\Seen') : false,
                    is_starred: message.flags ? message.flags.has('\\Starred') : false
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${this.apiToken}`,
                      Accept: 'application/json'
                    }
                  }
                )

                onNewEmail({
                  account: account.username,
                  sender: parsed.from?.text || 'Unknown',
                  subject: parsed.subject || '(No Subject)',
                  date: parsed.date
                })
              }
            } catch (err: any) {
              console.error(`[EmailWatch] Error processing new message:`, err.message || err)
            }
          })

          this.idleClients.set(account.id, client)
        } catch (accErr: any) {
          console.error(`[EmailWatch] Failed for ${account.username}:`, accErr.message || accErr)
        }
      }
    } catch (err: any) {
      console.error('[EmailWatch] Error setting up watch:', err.message || err)
    }
  }

  async stopWatching() {
    for (const [_id, client] of this.idleClients.entries()) {
      try {
        await client.logout()
      } catch (err) { }
    }
    this.idleClients.clear()
  }

  private async getClient(accountId: number) {
    const response = await axios.get(`${this.backendUrl}/api/email-accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` }
    })
    const account = response.data
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.port === 993,
      auth: { user: account.username, pass: account.password },
      // @ts-ignore
      tls: { rejectUnauthorized: true },
      logger: false
    })
    await client.connect()
    return { client, account }
  }

  private async findFolderBySpecialUseOrCommonName(
    client: ImapFlow,
    specialUse: string,
    commonNames: string[]
  ) {
    const folders = await client.list()
    let target = folders.find((f) => f.specialUse === specialUse)
    if (!target) target = folders.find((f) => commonNames.includes(f.path.toLowerCase()))
    return target
  }

  async updateEmailFlags(
    accountId: number,
    folderPath: string,
    uid: number,
    flags: string[],
    action: 'add' | 'remove' | 'set'
  ) {
    let client: ImapFlow | null = null
    try {
      const wrap = await this.getClient(accountId)
      client = wrap.client
      await client.mailboxOpen(folderPath)

      if (action === 'add') await client.messageFlagsAdd({ uid }, flags)
      else if (action === 'remove') await client.messageFlagsRemove({ uid }, flags)
      else await client.messageFlagsSet({ uid }, flags)

      return { success: true }
    } finally {
      if (client) await client.logout()
    }
  }

  async moveEmail(
    accountId: number,
    sourceFolderPath: string,
    uid: number,
    targetFolder: 'trash' | 'archive' | 'spam' | 'inbox'
  ) {
    let client: ImapFlow | null = null
    try {
      const wrap = await this.getClient(accountId)
      client = wrap.client
      await client.mailboxOpen(sourceFolderPath)

      const folders = await client.list()
      let targetPath = ''
      if (targetFolder === 'trash') {
        const f =
          folders.find((f) => f.specialUse === '\\Trash') ||
          folders.find((f) =>
            ['trash', 'bin', 'deleted items', 'sampah', 'kotak sampah', 'hapus'].some((name) =>
              f.path.toLowerCase().includes(name)
            )
          )
        targetPath = f?.path || ''
      } else if (targetFolder === 'archive') {
        const f =
          folders.find((f) => f.specialUse === '\\Archive') ||
          folders.find((f) =>
            ['archive', 'arsip'].some((name) => f.path.toLowerCase().includes(name))
          )
        targetPath = f?.path || ''
      } else if (targetFolder === 'spam') {
        const f =
          folders.find((f) => f.specialUse === '\\Junk') ||
          folders.find((f) =>
            ['spam', 'junk', 'sampah'].some((name) => f.path.toLowerCase().includes(name))
          )
        targetPath = f?.path || ''
      } else if (targetFolder === 'inbox') {
        targetPath = 'INBOX'
      }

      if (!targetPath) throw new Error(`Target folder ${targetFolder} not found.`)
      await client.messageMove({ uid }, targetPath)
      await client.mailboxClose()
      return { success: true }
    } finally {
      if (client) await client.logout()
    }
  }

   async saveDraft(accountId: number, data: { to: string; cc?: string; bcc?: string; subject: string; body: string; isHtml?: boolean }) {
    let client: ImapFlow | null = null
    try {
      const wrap = await this.getClient(accountId)
      client = wrap.client
      const account = wrap.account

      const draftFolder = await this.findFolderBySpecialUseOrCommonName(client, '\\Drafts', [
        'drafts',
        'draft',
        'draf'
      ])
      if (!draftFolder) throw new Error('Drafts folder not found.')

      const streamTransport = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      })

      const mailOptions: any = {
        from: `"${account.username}" <${account.username}>`,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject
      }

      if (data.isHtml) {
        mailOptions.html = data.body
        mailOptions.text = data.body.replace(/<[^>]*>?/gm, '')
      } else {
        mailOptions.text = data.body
      }

      const { message } = await streamTransport.sendMail(mailOptions)

      const appendResult = await client.append(draftFolder.path, message as any, ['\\Draft'])

      if (appendResult && (appendResult as any).uid) {
        const parsed = await simpleParser(message)
        const messageId = this.getStableMessageId(parsed, account.username)

        await axios.post(
          `${this.backendUrl}/api/emails/sync`,
          {
            email_account_id: account.id,
            message_id: messageId,
            uid: (appendResult as any).uid,
            folder_path: draftFolder.path,
            sender: account.username,
            recipient: data.to,
            cc: data.cc || null,
            bcc: data.bcc || null,
            subject: data.subject,
            sent_at: new Date(),
            content: JSON.stringify({
              html: data.isHtml ? data.body : false,
              text: data.isHtml ? data.body.replace(/<[^>]*>?/gm, '') : data.body,
              eml: message.toString()
            }),
            attachments_info: [],
            folder: 'drafts'
          },
          { headers: { Authorization: `Bearer ${this.apiToken}`, Accept: 'application/json' } }
        )
      }

      return { success: true }
    } finally {
      if (client) await client.logout()
    }
  }

  async deleteEmail(accountId: number, folderPath: string, uid: number) {
    let client: ImapFlow | null = null
    try {
      const wrap = await this.getClient(accountId)
      client = wrap.client
      await client.mailboxOpen(folderPath)
      await client.messageDelete({ uid })
      await client.mailboxClose()
      return { success: true }
    } catch (err) {
      console.error('Delete error:', err)
      return { success: false, error: (err as any).message }
    } finally {
      if (client) await client.logout()
    }
  }
}
