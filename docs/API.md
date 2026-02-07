# API Reference

Complete documentation for Aegis-3 API endpoints.

---

## Base URL

**Development:** `http://localhost:3000`  
**Production:** `https://aegis3.vercel.app`

---

## Endpoints

### 1. Ingest Repository

```http
POST /api/ingest
```

**Description:** Clone a GitHub repository and prepare it for analysis.

**Request Body:**

```json
{
  "repo_url": "https://github.com/Aave/protocol-v2"
}
```

**Response (202 Accepted):**

```json
{
  "audit_id": "abc123xyz789",
  "status": "pending",
  "message": "Repository ingestion started"
}
```

**Response (400 Bad Request):**

```json
{
  "error": "Invalid GitHub repository URL"
}
```

**Response (500 Internal Server Error):**

```json
{
  "error": "Failed to clone repository: Network timeout"
}
```

**Example (curl):**

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/OpenZeppelin/openzeppelin-contracts"}'
```

**Example (JavaScript):**

```javascript
const response = await fetch('/api/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repo_url: 'https://github.com/Aave/protocol-v2'
  })
});

const { audit_id } = await response.json();
console.log('Audit ID:', audit_id);
```

---

### 2. Start Analysis

```http
POST /api/analyze
```

**Description:** Trigger the two-phase Gemini analysis on an ingested repository.

**Request Body:**

```json
{
  "audit_id": "abc123xyz789"
}
```

**Response (202 Accepted):**

```json
{
  "status": "analyzing",
  "message": "Analysis started"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Audit not found"
}
```

**Response (400 Bad Request):**

```json
{
  "error": "Audit already completed"
}
```

**Example (curl):**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"audit_id":"abc123xyz789"}'
```

**Notes:**
- Analysis runs asynchronously (30-60 seconds)
- Poll `/api/audits?id={audit_id}` for status updates

---

### 3. Get Audit Results

```http
GET /api/audits?id={audit_id}
```

**Description:** Retrieve audit results, including findings and status.

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Audit ID from `/api/ingest` |

**Response (200 OK - Pending):**

```json
{
  "id": "abc123xyz789",
  "repo_url": "https://github.com/Aave/protocol-v2",
  "status": "pending",
  "system_map": "Waiting for analysis...",
  "findings": [],
  "created_at": "2026-02-07T14:30:00.000Z"
}
```

**Response (200 OK - Analyzing):**

```json
{
  "id": "abc123xyz789",
  "repo_url": "https://github.com/Aave/protocol-v2",
  "status": "analyzing",
  "system_map": "{\"contracts\":[...]}",
  "findings": [],
  "created_at": "2026-02-07T14:30:00.000Z"
}
```

**Response (200 OK - Completed):**

```json
{
  "id": "abc123xyz789",
  "repo_url": "https://github.com/Aave/protocol-v2",
  "status": "completed",
  "system_map": "{\"contracts\":[{\"name\":\"LendingPool\",\"type\":\"Core\"}]}",
  "findings": [
    {
      "id": "finding-1",
      "severity": "CRITICAL",
      "title": "Reentrancy in liquidationCall",
      "description": "The liquidationCall function transfers tokens before updating state...",
      "line_numbers": [234, 235, 236],
      "file_path": "contracts/LendingPool.sol",
      "historical_reference": {
        "title": "Reentrancy in ERC4626 withdraw",
        "protocol": "Sentiment Finance",
        "similarity_score": 87,
        "source_link": "https://github.com/pashov/audits/..."
      },
      "poc_code": "// Foundry PoC\ncontract ExploitTest {\n  function testReentrancy() {...}\n}"
    }
  ],
  "files": {
    "contracts/LendingPool.sol": "pragma solidity ^0.8.0;\n\ncontract LendingPool {...}",
    "contracts/PriceOracle.sol": "pragma solidity ^0.8.0;\n\ncontract PriceOracle {...}"
  },
  "created_at": "2026-02-07T14:30:00.000Z"
}
```

**Response (200 OK - Failed):**

```json
{
  "id": "abc123xyz789",
  "repo_url": "https://github.com/Aave/protocol-v2",
  "status": "failed",
  "system_map": "Error: API quota exceeded. Wait for reset or upgrade plan.",
  "findings": [],
  "created_at": "2026-02-07T14:30:00.000Z"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Audit not found"
}
```

**Example (curl):**

```bash
curl http://localhost:3000/api/audits?id=abc123xyz789
```

**Example (JavaScript with Polling):**

```javascript
async function pollAudit(auditId) {
  const poll = setInterval(async () => {
    const response = await fetch(`/api/audits?id=${auditId}`);
    const audit = await response.json();
    
    console.log('Status:', audit.status);
    
    if (audit.status === 'completed') {
      clearInterval(poll);
      console.log('Findings:', audit.findings);
    } else if (audit.status === 'failed') {
      clearInterval(poll);
      console.error('Error:', audit.system_map);
    }
  }, 3000); // Poll every 3 seconds
}

pollAudit('abc123xyz789');
```

---

### 4. Get Recent Audits

```http
GET /api/audits
```

**Description:** Retrieve a list of recent audits (last 10).

**Response (200 OK):**

```json
[
  {
    "id": "abc123xyz789",
    "repo_url": "https://github.com/Aave/protocol-v2",
    "status": "completed",
    "created_at": "2026-02-07T14:30:00.000Z"
  },
  {
    "id": "def456uvw012",
    "repo_url": "https://github.com/Uniswap/v3-core",
    "status": "analyzing",
    "created_at": "2026-02-07T13:15:00.000Z"
  }
]
```

**Example (curl):**

```bash
curl http://localhost:3000/api/audits
```

---

### 5. Recovery System

```http
POST /api/recovery
```

**Description:** Manually trigger the audit recovery system to mark stuck audits as failed.

**Response (200 OK):**

```json
{
  "message": "Recovery system executed",
  "recovered_audits": 2
}
```

**Example (curl):**

```bash
curl -X POST http://localhost:3000/api/recovery
```

**Notes:**
- Automatically marks audits stuck >15 minutes as "failed"
- Use if an audit is stuck on "analyzing" status

---

## Data Models

### AuditResult

```typescript
interface AuditResult {
  id: string;
  repo_url: string;
  system_map: string;  // JSON string or error message
  findings: AuditFinding[];
  files?: Record<string, string>;  // File path → file content
  created_at: string;  // ISO 8601 timestamp
  status: "pending" | "analyzing" | "completed" | "failed";
}
```

### AuditFinding

```typescript
interface AuditFinding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  line_numbers: number[];
  file_path: string;
  historical_reference?: {
    title: string;
    protocol: string;
    similarity_score: number;  // 0-100
    source_link?: string;
  };
  poc_code?: string;  // Foundry test code
}
```

### ArchitectureMap

```typescript
interface ArchitectureMap {
  contracts: {
    name: string;
    type: string;  // "Proxy" | "Implementation" | "Vault" | "Oracle" | "Token" | "Governance" | "Other"
    key_functions: string[];
    interactions: string[];
  }[];
  patterns: string[];  // ["Upgradeable Proxy", "Oracle Dependency", ...]
  risk_areas: string[];  // ["External oracle calls", "Complex delegation", ...]
}
```

---

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `400` | Invalid request (bad URL, missing fields) | Check request body format |
| `404` | Audit not found | Verify audit ID is correct |
| `429` | Rate limit exceeded | Wait for quota reset |
| `500` | Internal server error | Check logs, retry after 1 minute |
| `503` | Service unavailable (Gemini API down) | Wait and retry |

---

## Rate Limits

### Gemini API (Free Tier)

- **Flash:** 1,500 requests/day (15/minute)
- **Pro:** 50 requests/day (2/minute)

**Aegis-3 Usage:**
- 1 audit = 2 requests (1 Flash + 1 Pro)
- Free tier = ~25 audits/day

**Upgrade:** https://ai.google.dev/pricing

---

## Webhook Support (Future)

**Coming Soon:** Webhook notifications for audit completion.

**Planned Endpoint:**

```http
POST /api/webhooks
```

**Payload:**

```json
{
  "webhook_url": "https://your-server.com/audit-complete",
  "audit_id": "abc123xyz789"
}
```

**Callback when complete:**

```json
{
  "audit_id": "abc123xyz789",
  "status": "completed",
  "findings_count": 8,
  "critical_count": 2
}
```

---

## SDK (Coming Soon)

**JavaScript/TypeScript SDK:**

```bash
npm install @aegis3/sdk
```

**Usage:**

```typescript
import { Aegis3Client } from '@aegis3/sdk';

const client = new Aegis3Client({
  apiKey: process.env.AEGIS_API_KEY
});

// Submit audit
const audit = await client.submitAudit({
  repoUrl: 'https://github.com/Aave/protocol-v2'
});

// Wait for completion
await audit.waitForCompletion();

// Get findings
const findings = audit.findings.filter(f => f.severity === 'CRITICAL');
console.log(`Found ${findings.length} critical issues`);
```

---

## Examples

### Full Workflow (Node.js)

```javascript
const REPO_URL = 'https://github.com/OpenZeppelin/openzeppelin-contracts';
const API_BASE = 'http://localhost:3000';

async function auditRepository(repoUrl) {
  // 1. Ingest repository
  console.log('Ingesting repository...');
  const ingestResponse = await fetch(`${API_BASE}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl })
  });
  
  const { audit_id } = await ingestResponse.json();
  console.log('Audit ID:', audit_id);
  
  // 2. Start analysis
  console.log('Starting analysis...');
  await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audit_id })
  });
  
  // 3. Poll for completion
  console.log('Waiting for analysis...');
  let audit;
  while (true) {
    const response = await fetch(`${API_BASE}/api/audits?id=${audit_id}`);
    audit = await response.json();
    
    if (audit.status === 'completed' || audit.status === 'failed') {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s
  }
  
  // 4. Display results
  if (audit.status === 'completed') {
    console.log(`\n✓ Analysis complete! Found ${audit.findings.length} issues:\n`);
    
    audit.findings.forEach(finding => {
      console.log(`[${finding.severity}] ${finding.title}`);
      console.log(`  File: ${finding.file_path}`);
      console.log(`  Lines: ${finding.line_numbers.join(', ')}`);
      if (finding.historical_reference) {
        console.log(`  Similar to: ${finding.historical_reference.protocol} (${finding.historical_reference.similarity_score}%)`);
      }
      console.log('');
    });
  } else {
    console.error('✗ Analysis failed:', audit.system_map);
  }
}

auditRepository(REPO_URL);
```

---

## Testing

**Run API tests:**

```bash
npm run test:api
```

**Manual testing:**

```bash
# Test ingest endpoint
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/OpenZeppelin/openzeppelin-contracts"}'

# Copy audit_id from response, then test analyze
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"audit_id":"YOUR_AUDIT_ID"}'

# Poll results
curl http://localhost:3000/api/audits?id=YOUR_AUDIT_ID
```

---

## Security

### API Key (Coming Soon)

**Header:**

```http
Authorization: Bearer YOUR_API_KEY
```

**Rate limits per key:**
- Free tier: 100 audits/day
- Pro tier: 1,000 audits/day

### Input Validation

All inputs are sanitized:
- GitHub URLs validated against regex
- Audit IDs checked for valid format (alphanumeric)
- File paths restricted to `.temp/` directory

### Data Privacy

- Repositories cloned locally (not stored remotely)
- Audit results stored locally (`.temp/audits/`)
- No data sent to third parties (except Gemini API)

---

**For more:** [Architecture](/docs/ARCHITECTURE.md) | [Setup](/docs/SETUP.md) | [Innovation](/docs/INNOVATION.md)
