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
  "http://localhost:3001/legacy/wormhole-initiate?sourceChain=Base&destinationChain=Ethereum&amount=1000000000000000000"
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
- Slack notifier setup for real-time notifications

---

## Legacy Scripts

The project includes legacy claim scripts for manual bridge operations. These are standalone scripts that can be run locally for specific bridge claim scenarios.

### Available Scripts

#### 1. Avail Claim (`legacy/avail_claim.ts`)

Claims tokens on Avail chain after they've been bridged from Ethereum/Base.

**Required Environment Variables:**
```bash
# Avail Configuration
SURI=<your-substrate-secret-uri>
BRIDGE_API_URL=<bridge-api-endpoint>
AVAIL_CLAIM_AMOUNT=<amount-in-wei>
MESSAGE_ID=<bridge-message-id>
BLOCK_NUMBER=<source-block-number>
```

**Usage:**
```bash
bun run legacy/avail_claim.ts
```

**Process Flow:**
```
1. Connect to Avail RPC
2. Poll bridge API for Ethereum head
3. Wait for block inclusion (SOURCE_BLOCK <= HEAD_BLOCK)
4. Fetch merkle proof from bridge API
5. Submit execute transaction with proof
6. Wait for finalization on Avail
```

---

#### 2. Ethereum Claim (`legacy/eth_claim.ts`)

Claims tokens on Ethereum/Base after they've been bridged from Avail.

**Required Environment Variables:**
```bash
# Ethereum/Base Configuration
BRIDGE_PROXY_ETH=<bridge-contract-address>
BRIDGE_API_URL=<bridge-api-endpoint>
ETH_PROVIDER_URL=<ethereum-rpc-url>
WALLET_SIGNER_KEY_ETH=<private-key>

# Transaction Details
BLOCK_NUMBER=<avail-block-number>
TX_INDEX=<transaction-index>
FINALIZED_BLOCK=<finalized-block-hash>

# NTT Token Configuration (for Base)
AVAIL_TOKEN_BASE=<token-address>
MANAGER_ADDRESS_BASE=<manager-address>
WORMHOLE_TRANSCEIVER_BASE=<transceiver-address>

# NTT Token Configuration (for Ethereum)
AVAIL_TOKEN_ETH=<token-address>
MANAGER_ADDRESS_ETH=<manager-address>
WORMHOLE_TRANSCEIVER_ETH=<transceiver-address>

# Environment
CONFIG=<Mainnet|Testnet>
```

**Usage:**
```bash
bun run legacy/eth_claim.ts
```

**Process Flow:**
```
1. Validate all environment variables
2. Connect to Ethereum/Base RPC
3. Poll bridge API for Avail head
4. Wait for block inclusion (SOURCE_BLOCK <= HEAD_BLOCK)
5. Fetch merkle proof from bridge API
6. Encode token transfer payload
7. Estimate gas and submit receiveAVAIL transaction
8. Retry up to 3 times on failure (5 min intervals)
9. Wait for 2 confirmations
10. Verify finalization
```

**Notes:**
- Ethereum claim script includes automatic retry logic (3 attempts)
- Gas estimation with 15% buffer for safety
- Supports both Mainnet and Testnet configurations
- Links to Etherscan for transaction verification

---

### When to Use Legacy Scripts

- **Manual Bridge Recovery**: When automated rebalancing fails
- **One-off Transfers**: For non-standard bridge amounts
- **Testing**: Verify bridge functionality in isolation
- **Emergency Operations**: Manual intervention needed

---

## License

MIT
