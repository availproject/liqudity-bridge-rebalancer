# Liquidity Bridge Rebalancer

Automated liquidity rebalancing system between Avail and Base networks using Wormhole & Vector bridge. Monitors pool balances and automatically rebalances when thresholds are breached.

## Overview

This service runs two servers:
- **Cron Server** (Port 3000): Automated rebalancing job with lifecycle management
- **Core API Server** (Port 3001): Job monitoring and manual bridge operations

## Getting Started

### Installation
```bash
bun install
```

### Environment Variables
Create a `.env` file with the .env.example

### Development
```bash
# Start cron server
bun run start-cron

# Start core API server
bun run start
```

---

## API Documentation

All endpoints require authentication via `x-api-key` header.

### Cron Server (Port 3000)

#### 1. Health Check
```bash
curl http://localhost:3000/
```

**Pseudo Flow:**
```
→ Returns health status of cron server
```

---

#### 2. Stop Rebalancer
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/stop
```

**Response:** `"stopped rebalancer script"`

**Pseudo Flow:**
```
→ Stop the cron job permanently
→ No more automatic executions will occur
```

---

#### 3. Pause Rebalancer
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/pause
```

**Response:** `"paused rebalancer script"`

**Pseudo Flow:**
```
→ Temporarily pause the cron job
→ Job can be resumed later
→ Maintains job state
```

---

#### 4. Resume Rebalancer
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/resume
```

**Response:** `"resumed rebalancer script"`

**Pseudo Flow:**
```
→ Resume a paused cron job
→ Rebalancing will continue on schedule
```

---

#### 5. Trigger Manual Run
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/trigger-run
```

**Response:**
```json
{
  "status": "started",
  "message": "Job has been initiated."
}
```

**Pseudo Flow:**
```
→ Check if job is already running
  ├─ If running: Return "already_running" status
  └─ If not running:
      └─ Trigger immediate execution
      └─ Run entrypoint logic:
          1. Fetch balances on both chains
          2. Check if AVAIL balance < THRESHOLD
             └─ Bridge from BASE → AVAIL
          3. Check if BASE balance < THRESHOLD
             └─ Bridge from AVAIL → BASE
          4. Send notifications on completion/failure
```

---

### Core API Server (Port 3001)

#### 1. Health Check
```bash
curl http://localhost:3001/
```

**Response:** `"core apis health check ok"`

---

#### 2. Get Last Job Status
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3001/status
```

**Response:**
```json
{
  "status": "completed",
  "started_at": "2024-01-15T10:30:00Z",
  "finished_at": "2024-01-15T10:35:00Z",
  "error": null,
  "is_running": false
}
```

**Pseudo Flow:**
```
→ Query local database for most recent job
→ Return job execution details:
  - Status: running | completed | failed
  - Timestamps
  - Error message (if failed)
  - Current running state
```

---

#### 3. Get Job History
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3001/history?limit=20"
```

**Query Parameters:**
- `limit` (optional): Number of jobs to return (default: 10)

**Response:**
```json
{
  "total": 20,
  "jobs": [
    {
      "id": 1,
      "status": "completed",
      "started_at": "2024-01-15T10:30:00Z",
      "finished_at": "2024-01-15T10:35:00Z",
      "error": null
    }
  ]
}
```

**Pseudo Flow:**
```
→ Query database for last N jobs
→ Return paginated job history with:
  - Job ID
  - Execution status
  - Timing information
  - Error details (if any)
```

---

#### 4. Initiate Wormhole Bridge (Legacy)
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3001/legacy/wormhole-initiate?sourceChain=Base&destinationChain=Avail&amount=1000000000000000000"
```

**Query Parameters:**
- `sourceChain`: Source chain name (e.g., "Base", "BaseSepolia")
- `destinationChain`: Destination chain name
- `amount`: Amount to bridge in wei (string)

**Response:**
```json
{
  "initiateHash": "0x...",
  "destinationHash": "0x..."
}
```

**Pseudo Flow:**
```
→ Validate source and destination chains
→ Select appropriate client (Base or Avail)
→ Initiate Wormhole bridge transaction:
  1. Approve token spending (if needed)
  2. Call bridge contract with amount
  3. Wait for transaction confirmation
  4. Monitor for bridge completion on destination
  5. Return transaction hashes for both chains
```

---

## Rebalancing Logic

The automated rebalancer runs every 10 minutes and follows this logic:

```
START
  ↓
Fetch Pool Balances
  ├─ AVAIL token balance
  ├─ BASE token balance
  └─ BASE gas balance
  ↓
Check Gas Threshold
  ├─ If gas < GAS_THRESHOLD
  │   └─ THROW ERROR: "Please top up gas"
  ↓
Check AVAIL Balance < THRESHOLD?
  ├─ YES → Bridge BASE → AVAIL
  │   1. Send notification (job starting)
  │   2. Lock tokens on BASE
  │   3. Wait for Wormhole attestation
  │   4. Claim tokens on AVAIL
  │   5. Send notification (success/failure)
  ↓
Check BASE Balance < THRESHOLD?
  ├─ YES → Bridge AVAIL → BASE
  │   1. Send notification (job starting)
  │   2. Lock tokens on AVAIL
  │   3. Wait for Wormhole attestation
  │   4. Claim tokens on BASE
  │   5. Send notification (success/failure)
  ↓
Both Balances Sufficient?
  └─ Log: "No rebalancing required"
  ↓
END
```

---

## Error Handling

- All jobs log to local database with timestamps
- Failed jobs send Slack notifications (if configured)
- Gas threshold checks prevent failed transactions
- Job status prevents concurrent executions

---

## Authentication

All protected endpoints require API key authentication:

```bash
-H "x-api-key: YOUR_API_KEY"
```

Keys are validated using Unkey service. Invalid keys return `401 Unauthorized`.

---

## Monitoring

- Check `/status` endpoint for current job state
- Review `/history` for past execution logs
- Set up Slack webhooks for real-time notifications
- Monitor gas balances to prevent transaction failures

---

## License

MIT
