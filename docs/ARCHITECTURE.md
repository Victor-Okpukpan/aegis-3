# Technical Architecture

Deep dive into Aegis-3's adversarial reasoning engine.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│  (Next.js + React + Monaco Editor + Tailwind CSS)           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Submit GitHub URL
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   INGESTION ENGINE                           │
│  • Clone repo (simple-git)                                   │
│  • Extract .sol files recursively                            │
│  • Flatten to unified context string                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Flattened Code (~50-500KB)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                 GEMINI 3 FLASH (Phase 1)                     │
│  • Architecture Mapping (10-20s)                             │
│  • Contract Type Classification                              │
│  • Interaction Graph Generation                              │
│  • Risk Area Identification                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ System Map (JSON)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   RAG-LITE ENGINE                            │
│  • Extract vulnerability patterns (15 types)                 │
│  • Search 69,641 indexed findings (<10ms)                    │
│  • Score by: severity + quality + pattern match             │
│  • Return top 15 similar exploits                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Historical Context
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                 GEMINI 3 PRO (Phase 2)                       │
│  • Adversarial Audit with Deep Reasoning (30-60s)            │
│  • Cross-reference Historical Exploits                       │
│  • Generate Foundry PoC for Critical/High                    │
│  • Output Structured Findings (JSON)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Findings + PoCs
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE & UI                               │
│  • Persist to .temp/audits/ (JSON files)                    │
│  • Real-time polling for status updates                      │
│  • Split-screen viewer with Monaco                           │
│  • Vulnerable line highlighting (red background)             │
│  • Copy-to-clipboard PoC code                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Architectural Mapping

### Model: Gemini 3 Flash

**Why Flash?** Fast, cost-effective system comprehension before deep analysis.

### Input
```typescript
{
  code: string;  // Flattened Solidity files
  // Example: 50 contracts = ~200KB of code
}
```

### Prompt Strategy
```
Analyze the following Solidity codebase and generate an Architecture System Map.

CODE: [flattened contracts with file path headers]

TASK:
1. Identify all major contracts and their types (Proxy, Implementation, Vault, Oracle, Token, Governance, etc.)
2. Map key functions in each contract (especially state-changing functions)
3. Identify cross-contract interactions and dependencies
4. Detect architectural patterns (Upgradeable Proxies, Access Control, Oracle Dependencies, etc.)
5. Highlight potential risk areas based on architecture

Respond ONLY in JSON format:
{
  "contracts": [
    {
      "name": "ContractName",
      "type": "Proxy|Implementation|Vault|Oracle|Token|Governance|Other",
      "key_functions": ["function1", "function2"],
      "interactions": ["Contract1.function", "Contract2.function"]
    }
  ],
  "patterns": ["Upgradeable Proxy", "Oracle Dependency", "Multi-sig", "Timelock"],
  "risk_areas": ["External oracle calls", "Upgradeable without timelock", "Complex delegation chain"]
}
```

### Output Processing
```typescript
const systemMap: ArchitectureMap = JSON.parse(response);
// Used in Phase 2 for context-aware vulnerability detection
```

**Performance:** 10-20 seconds for 50-100 contracts

---

## RAG-Lite Engine

### Why "Lite"?

Vector embeddings (Pinecone, Weaviate) are overkill for structured vulnerability data. Our pattern-based approach provides:
- **Sub-second search** (<10ms for 69K findings)
- **Deterministic results** (no embedding drift)
- **Exact tag/pattern alignment**
- **Zero external dependencies**
- **No API costs**

### Data Structure

```typescript
interface SecurityFinding {
  id: string;
  title: string;
  impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  content: string;  // Full vulnerability description
  quality_score: number;  // 0-10 (editorial quality)
  rarity_score: number;   // 0-10 (uniqueness)
  protocol_name: string;
  source_link: string;    // Link to original audit report
  tags: string[];         // ["Reentrancy", "Oracle", "Flash Loan"]
}
```

**Total Dataset:** 69,641 findings across 31 JSON files

### Indexing Algorithm

```typescript
function searchRelevantFindings(
  keywords: string[],
  patterns: string[],
  limit: number = 15
): SecurityFinding[] {
  const scoredFindings = findings.map(finding => {
    let score = 0;
    const searchText = `${finding.title} ${finding.content}`.toLowerCase();
    
    // Keyword matching
    keywords.forEach(keyword => {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 3;
      }
    });
    
    // Pattern tag matching (higher weight)
    patterns.forEach(pattern => {
      finding.tags.forEach(tag => {
        if (tag.toLowerCase().includes(pattern.toLowerCase())) {
          score += 5;
        }
      });
    });
    
    // Severity boost
    if (finding.impact === 'CRITICAL') score += 10;
    if (finding.impact === 'HIGH') score += 5;
    
    // Quality metrics
    score += finding.quality_score * 2;
    score += finding.rarity_score;
    
    return { finding, score };
  });
  
  return scoredFindings
    .filter(sf => sf.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(sf => sf.finding);
}
```

### Pattern Extraction

Automated detection from code:

```typescript
const patternDetectors = [
  { pattern: /delegatecall/gi, name: 'delegatecall' },
  { pattern: /selfdestruct/gi, name: 'selfdestruct' },
  { pattern: /tx\.origin/gi, name: 'tx.origin' },
  { pattern: /oracle/gi, name: 'oracle' },
  { pattern: /flashloan/gi, name: 'flashloan' },
  { pattern: /proxy/gi, name: 'proxy' },
  { pattern: /reentrancy/gi, name: 'reentrancy' },
  { pattern: /approve/gi, name: 'approve' },
  // ... 20+ patterns total
];
```

**Performance:** <10ms to search and score 69,641 findings

---

## Phase 2: Adversarial Audit

### Model: Gemini 3 Pro

**Why Pro?** Deep reasoning required for complex vulnerability detection.

### Context Injection

**Total Context Size:** ~850K tokens
- **Flattened codebase:** ~500K tokens
- **System map:** ~10K tokens
- **Historical context:** ~40K tokens (15 findings × ~2.7K each)
- **Prompt instructions:** ~5K tokens

### Prompt Engineering

```
You are Aegis-3, an Adversarial AI Auditor. Your goal is to identify deep business logic flaws, 
economic vulnerabilities, and state inconsistencies.

SYSTEM MAP:
{
  "contracts": [...],
  "patterns": ["Upgradeable Proxy", "Oracle Dependency"],
  "risk_areas": ["External oracle calls without validation"]
}

HISTORICAL EXPLOIT PATTERNS:
[CRITICAL] Reentrancy in ERC4626 withdraw
Protocol: Sentiment Finance
Source: https://github.com/pashov/audits/...
Description: The withdraw function transfers tokens before updating shares...
Tags: Reentrancy, ERC4626, Vault

[HIGH] Oracle price manipulation via flash loan
Protocol: Euler Finance  
Source: https://github.com/trailofbits/...
Description: The price oracle can be manipulated within a single transaction...
Tags: Oracle, Flash Loan, Price Manipulation

... (13 more similar exploits)

CODE:
// ========================================
// FILE: contracts/Vault.sol
// ========================================

pragma solidity ^0.8.0;
...

TASK:
Perform a comprehensive adversarial audit. For each vulnerability:
1. Identify the specific line numbers and file path
2. Categorize severity (CRITICAL/HIGH/MEDIUM/LOW/INFO)
3. Provide a clear logical explanation of the vulnerability
4. Reference similar historical exploits if patterns match
5. Generate a Foundry-style PoC code snippet for CRITICAL/HIGH findings

Focus on:
- Business logic flaws (incorrect calculations, state corruption, fund loss)
- Economic vulnerabilities (oracle manipulation, flash loan attacks, MEV)
- Access control bypasses
- State inconsistencies and race conditions
- Reentrancy and external call safety
- Integer overflow/underflow (even with Solidity ^0.8.0)
- Proxy upgrade vulnerabilities

Respond ONLY in JSON format:
{
  "findings": [
    {
      "id": "unique-id",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "title": "Brief vulnerability title",
      "description": "Detailed explanation of the vulnerability, attack vector, and impact",
      "line_numbers": [123, 124, 125],
      "file_path": "contracts/Vault.sol",
      "historical_reference": {
        "title": "Similar vulnerability title from history",
        "protocol": "Protocol Name",
        "similarity_score": 85,
        "source_link": "https://github.com/audits/..."
      },
      "poc_code": "// Foundry PoC code here (for CRITICAL/HIGH only)"
    }
  ]
}
```

### Automatic Fallback

```typescript
try {
  // Attempt Gemini 3 Pro (best quality)
  result = await proModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1.0 },
  });
} catch (error) {
  if (error.includes('quota') || error.includes('429')) {
    console.log('[AI] Pro quota exceeded, falling back to Flash...');
    
    // Fallback to Flash (30x more generous quota)
    result = await flashModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.0 },
    });
  }
}
```

**Performance:** 30-60 seconds for deep analysis

---

## UI Architecture

### Technology Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19
- **Styling:** Tailwind CSS 4
- **Code Editor:** Monaco Editor
- **Notifications:** react-hot-toast
- **Git Ops:** simple-git

### Design Philosophy: Tactical Minimalism

**Color Scheme:**
- Background: `#000000` (Pure black)
- Primary: `#10b981` (Emerald-500)
- Borders: `#1e293b` (Slate-800)
- Text: `#e2e8f0` (Slate-100)

**Typography:**
- Font: JetBrains Mono (monospace)
- Sizes: 12-14px (body), 16-24px (headings)

**Design Rules:**
- Zero border radius (sharp corners only)
- 1px borders everywhere
- High information density
- Console-style logging

### Split-Screen Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header (AEGIS-3 | Status Indicator)                      │
├──────────┬───────────────────────────────────────────────┤
│[CRITICAL]│ Vulnerability Title                          │
│ Reen...  │ Full description with attack vector...       │
│ 📄 Vault │                                               │
│          │ Historical Reference:                         │
│[HIGH]    │ • Similar to Euler Finance (87%)             │
│ Oracle.. │ • View Original Report →                     │
│          │                                               │
│[MEDIUM]  │ Proof of Concept (Foundry):                  │
│ Access...│ [Copy Button]                                │
│          │ ```solidity                                   │
│          │ contract ExploitTest {                        │
│          │   function testExploit() {...}                │
│          │ }                                             │
│          │ ```                                           │
│          ├═══════════════════════════════════════════════┤← Drag to resize
│          │ 123 │ function withdraw(uint256 amount) {    │
│          │ 124 │     require(balances[msg.sender] >= ..│
│          │▌125 │     msg.sender.call{value: amount}(""); │← Highlighted
│          │▌126 │     balances[msg.sender] -= amount;    │← Highlighted
│          │ 127 │ }                                       │
└──────────┴───────────────────────────────────────────────┘
```

### Monaco Editor Integration

**Custom Theme: "aegis-dark"**

```typescript
monaco.editor.defineTheme('aegis-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '10b981', fontStyle: 'bold' },
    { token: 'string', foreground: '6ee7b7' },
    { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#e2e8f0',
    'editorLineNumber.foreground': '#475569',
    'editorLineNumber.activeForeground': '#10b981',
  },
});
```

**Vulnerable Line Highlighting:**

```css
.vulnerable-line {
  background-color: rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgb(239, 68, 68);
}
```

### Real-Time Updates

**Polling Strategy:**

```typescript
useEffect(() => {
  fetchAudit();
  
  // Poll every 3 seconds
  const interval = setInterval(() => {
    fetchAudit();
  }, 3000);
  
  return () => clearInterval(interval);
}, [auditId]);

// Stop when complete/failed
useEffect(() => {
  if (audit?.status === 'completed' || audit?.status === 'failed') {
    clearInterval(interval);
    // Show toast notification
  }
}, [audit?.status]);
```

### Responsive Design

**Breakpoints:**
- Mobile: < 640px (stacked layout)
- Tablet: 640-1024px (stacked, more spacing)
- Desktop: ≥ 1024px (split-screen with resizable panels)

---

## Data Flow

### Audit Lifecycle

```typescript
// 1. User submits GitHub URL
POST /api/ingest
  → Create audit record (status: 'pending')
  → Start background processing

// 2. Background cloning
async function processRepository() {
  const { id, path } = await cloneRepository(repoUrl);
  const { code, files } = await flattenSolidityCode(path);
  
  await updateAuditStatus(auditId, 'analyzing', {
    system_map: 'Repository cloned successfully'
  });
}

// 3. User triggers analysis
POST /api/analyze
  → Start Gemini 3 pipeline
  → Update status to 'analyzing'

// 4. Phase 1: Architecture
const systemMap = await generateSystemMap(code);

// 5. RAG Search
const patterns = extractVulnerabilityPatterns(code);
const relevantFindings = await searchRelevantFindings(keywords, patterns, 15);

// 6. Phase 2: Adversarial Audit
const findings = await performAdversarialAudit(code, systemMap, historicalContext);

// 7. Save results
await updateAuditStatus(auditId, 'completed', {
  findings,
  files: fileContents,
});

// 8. Frontend polls and displays
GET /api/audits?id=auditId
  → Returns audit with findings
  → UI renders split-screen view
```

### Storage Structure

```
.temp/
├── repos/
│   └── [random-id]/          # Cloned repositories (temp)
│       └── contracts/...
└── audits/
    └── [audit-id].json       # Persisted audit results
```

**Audit JSON Schema:**

```typescript
{
  "id": "abc123",
  "repo_url": "https://github.com/...",
  "system_map": "{\"contracts\": [...]}",
  "findings": [
    {
      "id": "finding-1",
      "severity": "CRITICAL",
      "title": "Reentrancy in withdraw",
      "description": "...",
      "line_numbers": [125, 126],
      "file_path": "contracts/Vault.sol",
      "historical_reference": {
        "title": "Similar vulnerability",
        "protocol": "Euler Finance",
        "similarity_score": 87,
        "source_link": "https://..."
      },
      "poc_code": "contract ExploitTest {...}"
    }
  ],
  "files": {
    "contracts/Vault.sol": "pragma solidity ^0.8.0;\n..."
  },
  "created_at": "2026-02-07T...",
  "status": "completed"
}
```

---

## Performance Optimizations

### 1. In-Memory RAG Cache

```typescript
let reportsCache: Map<string, SecurityReport> | null = null;

export async function initializeReportsIndex() {
  if (reportsCache) return; // Already loaded
  
  reportsCache = new Map();
  const files = await fs.readdir(REPORTS_DIR);
  
  for (const file of files) {
    const report = JSON.parse(await fs.readFile(file, 'utf-8'));
    reportsCache.set(file, report);
  }
}
```

**Result:** <10ms searches vs 500ms+ with file I/O

### 2. Code Truncation

```typescript
// Limit context to prevent token overflow
const prompt = `
CODE:
${code.slice(0, 800000)} // ~800K tokens max
`;
```

### 3. Parallel File Reading

```typescript
const files = await Promise.all(
  solidityFiles.map(async (filePath) => ({
    path: filePath,
    content: await fs.readFile(filePath, 'utf-8')
  }))
);
```

### 4. Background Processing

Analysis runs async—frontend doesn't block:

```typescript
// Fire and forget
processRepository(auditId, repoUrl).catch(error => {
  console.error(`[AUDIT ${auditId}] Failed:`, error);
});

return NextResponse.json({ audit_id: auditId });
```

---

## Error Handling

### 1. Quota Management

```typescript
// Automatic Flash fallback
if (error.includes('quota')) {
  onProgress?.('[AI] SWITCHING TO FLASH MODEL...');
  result = await flashModel.generateContent(prompt);
}
```

### 2. Stuck Audit Recovery

```typescript
// Detect audits stuck >15 minutes
export async function recoverStuckAudits() {
  const audits = await getAllAudits();
  const TIMEOUT_MS = 15 * 60 * 1000;
  
  for (const audit of audits) {
    if (audit.status !== 'analyzing') continue;
    
    const elapsed = Date.now() - new Date(audit.created_at).getTime();
    if (elapsed > TIMEOUT_MS) {
      await updateAuditStatus(audit.id, 'failed', {
        system_map: 'Error: Analysis timed out'
      });
    }
  }
}
```

### 3. User-Friendly Messages

```typescript
// Backend: Simplify errors
if (fullError.includes('quota')) {
  userMessage = 'API quota exceeded. Wait 15-60 minutes or upgrade plan.';
}

// Frontend: Toast notifications
toast.error('API Quota Exceeded\nWait for reset or upgrade plan', {
  duration: 8000,
});
```

---

## Security Considerations

### 1. Repository Isolation

```typescript
// Each clone in separate directory
const repoPath = path.join(TEMP_DIR, nanoid(10));
await git.clone(repoUrl, repoPath, ['--depth', '1']);
```

### 2. Automatic Cleanup

```typescript
// Always cleanup, even on error
try {
  await performAnalysis();
} finally {
  await cleanupRepository(repoId);
}
```

### 3. API Key Protection

```
.env file (gitignored)
GEMINI_API_KEY=...

Server-side only—never exposed to client
```

### 4. Input Validation

```typescript
if (!repoUrl || !isValidGitHubUrl(repoUrl)) {
  return NextResponse.json(
    { error: 'Invalid GitHub repository URL' },
    { status: 400 }
  );
}
```

---

## Scalability Considerations

### Current Limits

- **Free Tier:** 1,500 Flash requests/day, 50 Pro requests/day
- **File Size:** Repos >1M tokens are truncated
- **Concurrency:** Single-threaded analysis (one repo at a time)
- **Storage:** Local file system (.temp/)

### Production Recommendations

1. **Database:** Replace JSON files with PostgreSQL/MongoDB
2. **Queue System:** Bull/BullMQ for async job processing
3. **Caching:** Redis for RAG results and system maps
4. **CDN:** S3 + CloudFront for audit results
5. **Rate Limiting:** Implement per-user quotas
6. **Monitoring:** Sentry for errors, Datadog for performance

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js App (Serverless Functions)                    │ │
│  │  • /api/ingest (cloning + parsing)                     │ │
│  │  • /api/analyze (Gemini pipeline)                      │ │
│  │  • /api/audits (data retrieval)                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ API Calls
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    GEMINI 3 API                              │
│  • Flash Model (architecture mapping)                        │
│  • Pro Model (adversarial audit)                             │
└─────────────────────────────────────────────────────────────┘
```

**Note:** Vercel has 10-60s function timeouts. For very large repos, consider:
- Deploying to Railway/Render (no timeout limits)
- Breaking analysis into smaller chunks
- Using Vercel's experimental `maxDuration` flag

---

## Tech Stack Justification

| Choice | Alternatives Considered | Why Chosen |
|--------|------------------------|------------|
| **Next.js** | Remix, Astro | Best React meta-framework, excellent DX |
| **Gemini 3** | GPT-4, Claude | 1M context window, deep reasoning |
| **RAG-Lite** | Pinecone, Weaviate | Faster, simpler, zero API costs |
| **Monaco** | CodeMirror, Ace | Industry standard, excellent Solidity support |
| **Tailwind** | CSS Modules, Styled Components | Fastest prototyping, excellent utilities |
| **simple-git** | nodegit, isomorphic-git | Simplest API, good error handling |

---

**For more:** [Setup Guide](/docs/SETUP.md) | [Innovation Thesis](/docs/INNOVATION.md) | [API Docs](/docs/API.md)
