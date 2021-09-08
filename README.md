# Airtable Audit Log API Examples

This repository has a collection of sample scripts which can be used to request, retrieve, and ingest [Airtable Enterpise audit logs](https://support.airtable.com/hc/en-us/articles/4406956857111-Enterprise-audit-log) into various third-party systems.

Note: Audit Logs are only available on the Airtable Enterprise plan.

---

The software made available from this repository is not supported by Formagrid Inc (Airtable) or part of the Airtable Service. It is made available on an "as is" basis and provided without express or implied warranties of any kind.

---

### General information
- Examples in this repository are setup to read environment variables from `.env` using the [dotenv](https://www.npmjs.com/package/dotenv) npm package
- If you're looking for functions to use to integrate with other systems, take a look at the functions in `helpers/airtable.js` which leverage [axios](https://www.npmjs.com/package/axios) to call the [Airtable Audit Log APIs](https://airtable.com/api/enterprise)
- All examples implement the same basic workflow:
  1. Load dependencies/configurations
  2. Implement an "enrichAuditLogEntries" function which reformats the audit log entries based off of specific requirements for the third-party system
  3. Create a new request for audit logs for the previous day (this code is commented out by default)
  4. Get a list of all audit log requests and filters out requests that are not yet available
  5. Takes the most recent audit log requests and retrieves the files, decompresses them, and logs each audit log entry into the third-party system.

### Splunk (splunk_http_event_collector.js)
- Uses [Splunk's HTTP Event Collector (HEC)](https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector) via [Splunk's first-party JS SDK](https://github.com/splunk/splunk-javascript-logging)
- Tested with Splunk Cloud though HEC is available on Splunk Enterprise on-prem as well

### Sumo Logic (sumo_logic_http_collection.js)
- Uses [Sumo's HTTP Collection](https://help.sumologic.com/03Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source) functionaity via [Sumo's first-party JS SDK](https://github.com/SumoLogic/js-sumo-logger)
- Note that in order for Sumo to ingest logs from more than 24 hours ago with their original activity date, the collector's source needs to have timestamp parsing turned on and a [timestamp format](https://help.sumologic.com/03Send-Data/Sources/04Reference-Information-for-Sources/Timestamps%2C-Time-Zones%2C-Time-Ranges%2C-and-Date-Formats) defined. When using this repository's example code, specify:
  - Timezone: `GMT-00:00`
  - Format: `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`
  - Timestamp locator: `"_at_action_timestamp":"(.*?)",`

### Azure Monitor / Log Analytics / Sentinel (azure_monitor_http_data_collector.js)
- Uses [Azure's Data Collector API](https://docs.microsoft.com/en-us/azure/azure-monitor/logs/data-collector-api) via community-provided helper functions (see credits/links inline)

### Generic console.log (generic_console_log.js)
- Uses `console.log` to echo the audit log entries to standard out

### Generic save to file (generic_save_to_file.js)
- Uses [fs-extra](https://www.npmjs.com/package/fs-extra) to save audit log entries to a file as a JSON array of entries. 
- Note that this format (JSON array of entries) is different than the format outputted by the raw files from the Airtable API which are JSON but new-line delimmitted (and spread across multiple different files per audit log request)
