const axios = require('axios')
const gunzip = require('gunzip-maybe')
const getStream = require('get-stream')

// Function to get a single page of audit log requests
async function getPageOfAuditLogRequests (airtableApiKey, airtableApiHost, airtableEnterpriseAccountId, airtableAuditLogRequestsPageSize, offset = undefined) {
  let url = `https://${airtableApiHost}/v0/meta/enterpriseAccounts/${airtableEnterpriseAccountId}/auditLogs?pageSize=${airtableAuditLogRequestsPageSize}`
  // Only add offset if it is defined
  if (offset) { url += `&offset=${offset}` }

  // Call API to get audit log requests
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${airtableApiKey}` }
  })

  // Return the response
  return response.data //  (this includes the offset for the next page, if any): { auditLogs: [], offset: '' }
}

// Function to get all audit log entries for a given enterprise account
async function getAllAuditLogRequests (airtableApiKey, airtableApiHost, airtableEnterpriseAccountId, airtableAuditLogRequestsPageSize) {
  const allAuditLogRequests = []

  // Get first page of audit log requests and set offset
  const firstPageOfAuditLogRequests = await getPageOfAuditLogRequests(airtableApiKey, airtableApiHost, airtableEnterpriseAccountId, airtableAuditLogRequestsPageSize)
  allAuditLogRequests.push(...firstPageOfAuditLogRequests.auditLogs)
  let offset = firstPageOfAuditLogRequests.offset

  // Get subsequent pages of audit log requests while there is an offset from the previous page
  while (offset) {
    const nextPageOfAuditLogRequests = await getPageOfAuditLogRequests(airtableApiKey, airtableApiHost, airtableEnterpriseAccountId, airtableAuditLogRequestsPageSize, offset)
    allAuditLogRequests.push(...nextPageOfAuditLogRequests.auditLogs)
    offset = nextPageOfAuditLogRequests.offset
  }

  return allAuditLogRequests
}

async function createAuditLogRequest (airtableApiKey, airtableApiHost, airtableEnterpriseAccountId, body) {
  // Create the audit log request
  const response = await axios.post(`https://${airtableApiHost}/v0/meta/enterpriseAccounts/${airtableEnterpriseAccountId}/auditLogs`,
    body,
    {
      headers: {
        Authorization: `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )
  // Return the response
  return response.data // { id: '' }
}

// Function to take a log file URL and return an array of audit log entries
async function getAuditLogEntries (logFileUrl) {
  // Get the (compressed) log file as a stream
  const auditLogFile = await axios({
    method: 'get',
    url: logFileUrl,
    responseType: 'stream'
  })

  // Decompress stream and turn into string
  const decompressedStream = await auditLogFile.data.pipe(gunzip())
  const auditLogEntriesAsString = await getStream(decompressedStream)

  // Split string of new line-delimited JSON entries into array of JSON objects
  const lines = auditLogEntriesAsString.split('\n')
  if (lines[lines.length - 1] === '') {
    // Remove extra line at the end of the file
    lines.pop()
  }
  const arrayOfAuditLogEntries = lines.map(JSON.parse)
  return arrayOfAuditLogEntries
}

// Helper function to get yesterday's date in YYYY-MM-DD format
function getYesterdaysDate () {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

module.exports = {
  getPageOfAuditLogRequests,
  getAllAuditLogRequests,
  createAuditLogRequest,
  getAuditLogEntries,
  getYesterdaysDate
}
