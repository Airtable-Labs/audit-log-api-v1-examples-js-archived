// Load dependencies for logging Audit Log entries
const SumoLogger = require('sumo-logger')

// Load helper functions
const { getAllAuditLogRequests, getAuditLogEntries, getYesterdaysDate } = require('./helpers/airtable')

// Read in environment variables from .env
require('dotenv').config()
const {
  AIRTABLE_API_KEY,
  AIRTABLE_API_HOST,
  AIRTABLE_ENTERPRISE_ACCOUNT_ID,
  AIRTABLE_AUDIT_LOG_REQUESTS_PAGE_SIZE,
  SUMO_LOGIC_HTTP_SOURCE_URL
} = process.env

// Define Sumo Logic configuration
// Ref: https://github.com/SumoLogic/js-sumo-logger
const config = {
  endpoint: SUMO_LOGIC_HTTP_SOURCE_URL,
  interval: 1000,
  batchSize: 1024,
  onError: function (err) {
    console.error('error', err)
  }
}

// Instantiate SumoLogger
const sumoLogger = new SumoLogger(config)

async function enrichAuditLogEntries (arrayOfAuditLogEntries, logFileUrl) {
  const enrichedAuditLogEntries = arrayOfAuditLogEntries.map(entry => {
    const payloadToLog = entry
    payloadToLog._at_action_timestamp = new Date(entry.request.starttime)
    payloadToLog.url = logFileUrl
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

  for (const auditLogRequest of recentCompletedAuditLogsToProcess) {
    console.log(`\nProcessing audit log request ${auditLogRequest.id} by ${auditLogRequest.createdByUserId} @ ${auditLogRequest.createdTime} [timePeriod=${auditLogRequest.timePeriod};filter=${auditLogRequest.filter}]`)
    if (auditLogRequest.state === 'done') {
      console.log(`\tstate=done; has ${auditLogRequest.data.logFileUrls.length} file(s)`)

      if (new Date(auditLogRequest.data.expirationTime) < new Date()) {
        console.error(`\t/!\\ Expired at ${auditLogRequest.data.expirationTime}`)
        continue
      }

      for (const logFileUrl of auditLogRequest.data.logFileUrls) {
        console.log('\t\tProcessing log file')
        try {
          // Get the audit log entries from the log file
          const arrayOfAuditLogEntries = await getAuditLogEntries(logFileUrl)

          // Enrich audit log entries with additional metadata
          const enrichedAuditLogEntries = await enrichAuditLogEntries(arrayOfAuditLogEntries, logFileUrl)

          // Actually log the entries
          enrichedAuditLogEntries.map(payload => sumoLogger.log(payload))
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

  // Flush any logs, typically this line would be in your shutdown code
  await sumoLogger.flushLogs()
})()
