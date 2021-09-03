// Load dependencies for logging Audit Log entries
const { Logger: SplunkLogger } = require('splunk-logging')

// Load helper functions
const { getAuditLogEntries, getAllAuditLogRequests, createAuditLogRequest, getYesterdaysDate } = require('./helpers/airtable')

// Read in environment variables from .env
require('dotenv').config()
const {
  AIRTABLE_API_KEY,
  AIRTABLE_API_HOST,
  AIRTABLE_ENTERPRISE_ACCOUNT_ID,
  AIRTABLE_AUDIT_LOG_REQUESTS_PAGE_SIZE,
  SPLUNK_HTTP_EVENT_COLLECTOR_TOKEN,
  SPLUNK_HTTP_EVENT_COLLECTOR_URL
} = process.env

// Define Splunk configuration
// Ref: https://dev.splunk.com/enterprise/docs/devtools/javascript/logging-javascript/loggingjavascripthowtos/howtoautobatchjs
const config = {
  token: SPLUNK_HTTP_EVENT_COLLECTOR_TOKEN,
  url: SPLUNK_HTTP_EVENT_COLLECTOR_URL,
  maxBatchSize: 1024,
  maxRetries: 3
}

// Create Splunk Logger
const Logger = new SplunkLogger(config)

// Define error handler
Logger.error = function (err, context) {
  console.log('error', err, 'context', context)
}

async function enrichAuditLogEntries (arrayOfAuditLogEntries, logFileUrl) {
  // Splunk expects a 'time' field in epoch seconds, so we convert the ISO 8601 date string to epoch seconds
  const enrichedAuditLogEntries = arrayOfAuditLogEntries.map(entry => {
    const payloadToLog = {
      metadata: {
        time: new Date(entry.request.starttime).getTime(),
        source: logFileUrl,
        sourcetype: 'airtable_audit_log_entry'
      },
      message: entry
    }
    return payloadToLog
  })
  return enrichedAuditLogEntries
}

; (async () => {
  // Create new request for Airtable Audit Logs for yesterday
  // const yesterdaysDate = getYesterdaysDate()
  // const newAuditLogRequest = await createAuditLogRequest(AIRTABLE_API_KEY, AIRTABLE_API_HOST, AIRTABLE_ENTERPRISE_ACCOUNT_ID, { timePeriod: yesterdaysDate })
  // console.log({ newAuditLogRequest })

  // Get all audit log requests
  const allAuditLogRequests = await getAllAuditLogRequests(AIRTABLE_API_KEY, AIRTABLE_API_HOST, AIRTABLE_ENTERPRISE_ACCOUNT_ID, AIRTABLE_AUDIT_LOG_REQUESTS_PAGE_SIZE)

  // Get the most recent N audit log request(s) with a status of 'done'
  const nRecentCompleteAuditLogsToProcess = 3
  const completedAuditLogRequests = allAuditLogRequests.filter(r => r.state === 'done')
  const recentCompletedAuditLogsToProcess = completedAuditLogRequests.slice(0, nRecentCompleteAuditLogsToProcess)

  // Process each of the N most recent audit log requests
  for (const auditLogRequest of recentCompletedAuditLogsToProcess) {
    console.log(`\nProcessing audit log request ${auditLogRequest.id} by ${auditLogRequest.createdByUserId} @ ${auditLogRequest.createdTime} [timePeriod=${auditLogRequest.timePeriod};filter=${auditLogRequest.filter}]`)
    if (auditLogRequest.state === 'done') {
      console.log(`\tstate=done; has ${auditLogRequest.data.logFileUrls.length} file(s)`)

      // Check expiration time and log error if expired
      if (new Date(auditLogRequest.data.expirationTime) < new Date()) {
        console.error(`\t/!\\ Expired at ${auditLogRequest.data.expirationTime}`)
        continue
      }

      // Get audit log entries for each log file
      for (const logFileUrl of auditLogRequest.data.logFileUrls) {
        console.log('\t\tProcessing log file')
        try {
          // Get the audit log entries from the log file
          const arrayOfAuditLogEntries = await getAuditLogEntries(logFileUrl)

          // Enrich audit log entries with additional metadata
          const enrichedAuditLogEntries = await enrichAuditLogEntries(arrayOfAuditLogEntries, logFileUrl)

          // Actually log the entries
          enrichedAuditLogEntries.map(payload => Logger.send(payload))
        } catch (err) {
          console.error('Error processing log file')
          console.error(err.message)
        }
      }
    } else {
      console.log(`\tThis audit log request is not ready yet; state=${auditLogRequest.state}`)
    }
  }

  console.info('\n\nDone processing audit logs')
})()
