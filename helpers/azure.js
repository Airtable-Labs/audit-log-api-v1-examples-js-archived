const axios = require('axios')

// Function to send data to Azure Log Analytics
// HT/heavily borrowed from https://github.com/jasoncabot-ms/catnotcat/blob/master/loadtest/k6ToAzure.js
async function postToAzureLogAnalytics (azureWorkspaceId, azureTableName, azureHost, azureSharedKey, rawData, timeField) {
  const apiPath = '/api/logs'
  const data = JSON.stringify(rawData)
  const rfcDate = new Date().toUTCString()

  const contentLength = Buffer.byteLength(data, 'utf8')
  const signature = buildAzureSignature(azureSharedKey, rfcDate, contentLength, 'POST', 'application/json', apiPath)
  const authorization = `SharedKey ${azureWorkspaceId}:${signature}`
  const headers = {
    'X-MS-Date': rfcDate,
    'Log-Type': azureTableName,
    Authorization: authorization,
    'Content-Length': contentLength,
    'Time-Generated-Field': timeField,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }

  // POST the data to the Azure Log Analytics HTTP Data Collector API
  return await axios.post(`https://${azureWorkspaceId}.${azureHost}${apiPath}?api-version=2016-04-01`, data, { headers })
}

// Function to build proper signature for Azure
// HT/heavily borrowed from https://github.com/jasoncabot-ms/catnotcat/blob/master/loadtest/k6ToAzure.js
function buildAzureSignature (azureSharedKey, date, contentLen, method, contentType, resource) {
  const headers = 'x-ms-date:' + date
  const stringToSign = method + '\n' + contentLen + '\n' + contentType + '\n' + headers + '\n' + resource
  /* eslint-disable new-cap */
  const decodedKey = new Buffer.from(azureSharedKey, 'base64')

  const hmac = require('crypto').createHmac('sha256', decodedKey).update(stringToSign, 'utf-8')
  return hmac.digest('base64')
}

module.exports = {
  postToAzureLogAnalytics
}
