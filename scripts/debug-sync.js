require('dotenv').config()
const POP3Client = require('node-pop3')
const { simpleParser } = require('mailparser')
const axios = require('axios')

// CONFIGURATION - Reading from .env
const config = {
  host: 'mail.ptmma.co.id',
  port: 995,
  user: process.env.DEBUG_MAIL_USER || 'system.mmaxup@ptmma.co.id',
  pass: process.env.DEBUG_MAIL_PASS || '',
  tls: true,
  rejectUnauthorized: false
}

const backendUrl = 'https://apps.reytechz.my.id' // Adjust if using local
const apiToken = '' // ADD YOUR API TOKEN HERE (Bearer Token)

async function testSync() {
  console.log('[DEBUG] Starting Sync Test...')
  console.log(`[DEBUG] Connecting to ${config.host}:${config.port}...`)

  const client = new POP3Client({
    host: config.host,
    port: config.port,
    tls: config.tls,
    tlsOptions: { rejectUnauthorized: config.rejectUnauthorized },
    user: config.user,
    password: config.pass
  })

  try {
    const list = await client.LIST()
    console.log(`[DEBUG] Found ${list.length} emails on server.`)

    if (list.length === 0) {
      console.log('[DEBUG] No emails to sync. Exit.')
      await client.QUIT()
      return
    }

    // Fetch the last email
    const lastMsgId = list.length
    console.log(`[DEBUG] Fetching message ID: ${lastMsgId}...`)
    const raw = await client.RETR(lastMsgId)

    console.log('[DEBUG] Parsing email content...')
    const parsed = await simpleParser(raw)

    const syncData = {
      message_id: parsed.messageId || `msg_${Date.now()}`,
      sender: parsed.from.text,
      recipient: parsed.to.text,
      subject: parsed.subject,
      sent_at: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
      content: JSON.stringify({
        html: parsed.html || parsed.textAsHtml,
        text: parsed.text,
        eml: raw
      }),
      folder: 'inbox'
    }

    console.log('[DEBUG] Parsed metadata:', {
      subject: syncData.subject,
      from: syncData.sender,
      date: syncData.sent_at
    })

    if (!apiToken) {
      console.warn('[DEBUG] Skipping API sync because apiToken is missing.')
      console.log('[DEBUG] Sync data would be:', syncData)
    } else {
      console.log(`[DEBUG] Sending to backend: ${backendUrl}/api/email/sync...`)
      const response = await axios.post(`${backendUrl}/api/email/sync`, syncData, {
        headers: { Authorization: `Bearer ${apiToken}` }
      })
      console.log('[DEBUG] Backend response:', response.status, response.data)
    }

    await client.QUIT()
    console.log('[DEBUG] Test completed successfully.')
  } catch (err) {
    console.error('[DEBUG] FATAL ERROR:', err.message)
    console.error(err)
  }
}

testSync()
