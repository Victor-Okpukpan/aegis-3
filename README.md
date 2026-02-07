# Aegis-3: Adversarial Smart Contract Auditor

**AI-powered security analysis that thinks like an auditor.**

Built for the [Gemini 3 Hackathon](https://gemini3.devpost.com/)



---

## The Problem

Static analyzers catch surface bugs. Manual audits catch logic flaws but take weeks. **Nothing bridges this gap at scale.**

DeFi lost $3.8B in 2024 (Chainalysis) to vulnerabilities that tools like Slither missed:
- Cross-contract logic flaws
- Oracle manipulation vectors  
- Economic attack paths
- State corruption bugs

**Example:** A "safe" Vault becomes vulnerable when paired with a manipulable Strategy contract. Static tools analyze contracts in isolation. They can't reason about this.

---

## Our Solution

**Aegis-3 is an adversarial reasoning engine** that combines:

1. **Gemini 3's 1M token context** - Analyze entire protocols, not single files
2. **50,000+ historical exploits** - Pattern-match against real attack vectors via semantic RAG
3. **Foundry PoC generation** - Executable proof-of-concepts for critical findings
4. **Architectural mapping** - Understand cross-contract interactions and trust boundaries

### Key Innovation

We inject 69,641 indexed vulnerability patterns into Gemini 3's context, enabling it to say: *"This oracle manipulation is 87% similar to the Euler Finance exploit (March 2023). Here's the PoC."*

---

## How It Works

```
GitHub Repo → Architecture Mapping (Flash) → RAG Search (50K+ patterns)
     ↓
Historical Context + Full Codebase → Gemini 3 Pro (Deep Reasoning)
     ↓
Findings (Severity, Lines, Historical Refs, Foundry PoCs)
```

**4-minute end-to-end:** Submit URL → View findings with highlighted code + executable exploits

---

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/Victor-Okpukpan/aegis-3
cd aegis && npm install

# 2. Add API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Run
npm run dev
# Open http://localhost:3000
```

---

## Demo Workflow

1. **Submit repo:** `https://github.com/Aave/protocol-v2`
2. **Wait 2-3 minutes** (cloning + AI analysis)
3. **Review findings:**
   - Split-screen: Findings list + Monaco code viewer
   - Red-highlighted vulnerable lines
   - Historical references (e.g., "87% similar to Compound rounding error")
   - Copy-paste Foundry PoC to verify locally

**See it in action:** [3-minute demo video](https://youtube.com/demo)

---

## Why Gemini 3?

| Feature | Why It Matters |
|---------|---------------|
| **1M token context** | Analyze 100+ contract codebases without chunking |
| **Deep reasoning** | Understands complex state transitions and economic vectors |
| **Thinking mode** | Enables adversarial logic - "what could go wrong here?" |
| **Flash + Pro models** | Fast mapping (Flash) → Deep audit (Pro) |

**Novel usage:** We treat Gemini not as a chatbot but as a semantic reasoning engine. By injecting structured historical exploit data, we turn it into a specialized security tool.

---

## Impact

**For Security Researchers:**
- **60% faster initial audit** - Triage in 5 minutes vs 2 days
- **Zero manual exploit research** - 50K patterns auto-matched
- **PoC generation** - Saves 1-2 hours per finding

**For Protocols:**
- **$30K average savings** - Reduced senior auditor hours
- **Faster iteration** - Pre-audit self-assessment
- **Educational** - Learn from historical exploits

**This is not a replacement for audits.** Aegis-3 just accelerates the process. Findings still require human verification.

---

## Technical Highlights

- **AI:** Gemini 3 Pro/Flash (two-phase pipeline)
- **Context:** 800K+ tokens per audit (full codebase analysis)
- **RAG:** Custom pattern-matching over 69,641 indexed findings (<10ms search)
- **UI:** Tactical minimalist design (Monaco editor, resizable panels, real-time updates)
- **Stack:** Next.js 16, React 19, Tailwind CSS 4

**Detailed docs:** [See `/docs`](/docs)

---

## Project Stats

| Metric | Value |
|--------|-------|
| **Indexed Findings** | 69,641 across 31 DeFi categories |
| **Analysis Time** | 2-4 minutes average |
| **Context Window** | Up to 1M tokens (Gemini 3) |
| **LoC** | ~2,500 (excluding data) |
| **Build Time** | 12 seconds |

---

## Submission Links

- **Live Demo:** 
- **Video (3 min):** 
- **Code:** https://github.com/Victor-Okpukpan/aegis-3

---

## Documentation

Comprehensive technical docs in `/docs`:

- **[Architecture Deep-Dive](/docs/ARCHITECTURE.md)** - RAG engine, Gemini pipeline, UI design
- **[Setup Guide](/docs/SETUP.md)** - Local installation, production deployment
- **[Innovation Thesis](/docs/INNOVATION.md)** - Why LLMs beat static analysis
- **[API Reference](/docs/API.md)** - Endpoints, data models, examples

---

## Hackathon Compliance

**Gemini 3 Integration:**

Aegis-3 uses Gemini 3 in a two-phase adversarial pipeline. Phase 1 (Flash) performs rapid architectural mapping of entire codebases, identifying contract types, key functions, and interaction patterns in 10-20 seconds. Phase 2 (Pro) conducts deep security analysis with historical context injection—we use semantic RAG to retrieve 15 relevant exploits from 69,641 indexed findings, then inject this into Gemini's 1M token context window alongside the full codebase. The model's deep reasoning capabilities enable cross-contract vulnerability detection and Foundry PoC generation. Unlike chat interfaces, we treat Gemini as a specialized reasoning engine: structured prompts enforce JSON output with severity classifications, line numbers, and attack path explanations. Automatic fallback from Pro to Flash handles quota limits gracefully. This approach transforms Gemini into a domain-specific security tool that "thinks like an auditor"—referencing historical patterns, reasoning about economic incentives, and generating executable exploits.

---

## License

MIT
