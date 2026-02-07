import { GoogleGenerativeAI } from '@google/generative-ai';
import { ArchitectureMap, AuditFinding } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Step 1: Generate Architecture System Map
 */
export async function generateSystemMap(
  code: string,
  onProgress?: (message: string) => void
): Promise<ArchitectureMap> {
  onProgress?.('[AI] ANALYZING ARCHITECTURE...');

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
  });

  const prompt = `You are Aegis-3, an Adversarial AI Auditor specializing in smart contract security.

Analyze the following Solidity codebase and generate an Architecture System Map.

CODE:
${code.slice(0, 500000)} // Limit to avoid token overflow

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
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
      },
    });

    const response = result.response.text();
    onProgress?.('[AI] SYSTEM MAP GENERATED');

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                     response.match(/```\n([\s\S]*?)\n```/) ||
                     [null, response];
    
    const jsonStr = jsonMatch[1] || response;
    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('[AI] System map generation failed:', error);
    throw error;
  }
}

/**
 * Step 2: Adversarial Security Audit
 */
export async function performAdversarialAudit(
  code: string,
  systemMap: ArchitectureMap,
  historicalContext: string,
  onProgress?: (message: string) => void
): Promise<AuditFinding[]> {
  onProgress?.('[AI] PERFORMING ADVERSARIAL AUDIT...');

  // Try Pro first, fallback to Flash if quota exceeded
  let modelName = 'gemini-3-pro-preview';
  let model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are Aegis-3, an Adversarial AI Auditor. Your goal is to identify deep business logic flaws, economic vulnerabilities, and state inconsistencies.

SYSTEM MAP:
${JSON.stringify(systemMap, null, 2)}

HISTORICAL EXPLOIT PATTERNS:
${historicalContext}

CODE:
${code.slice(0, 800000)} // Limit for token management

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
- Oracle manipulation and price manipulation
- Flash loan attack vectors
- Governance and timelock bypasses

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
        "source_link": "https://github.com/audits/link-to-report.md"
      },
      "poc_code": "// Foundry PoC code here (for CRITICAL/HIGH only)"
    }
  ]
}

IMPORTANT: When providing historical_reference, extract the source_link from the historical context provided above.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        // Note: thinkingConfig is available in Gemini 3 API but not yet in TypeScript types
        // The model will use default deep reasoning behavior
      },
    } as any);

    const response = result.response.text();
    onProgress?.('[AI] AUDIT COMPLETE');

    // Extract JSON from response
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                     response.match(/```\n([\s\S]*?)\n```/) ||
                     [null, response];
    
    const jsonStr = jsonMatch[1] || response;
    const parsed = JSON.parse(jsonStr.trim());

    return parsed.findings || [];
  } catch (error: any) {
    // Check if quota exceeded for Pro model
    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      console.log('[AI] Pro model quota exceeded, falling back to Flash...');
      onProgress?.('[AI] QUOTA EXCEEDED - SWITCHING TO FLASH MODEL...');
      
      try {
        // Fallback to Flash model (has free tier)
        modelName = 'gemini-3-flash-preview';
        model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
          },
        } as any);

        const response = result.response.text();
        onProgress?.('[AI] AUDIT COMPLETE (FLASH MODEL)');

        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/```\n([\s\S]*?)\n```/) ||
                         [null, response];
        
        const jsonStr = jsonMatch[1] || response;
        const parsed = JSON.parse(jsonStr.trim());

        return parsed.findings || [];
      } catch (flashError: any) {
        console.error('[AI] Flash model also failed:', flashError);
        throw new Error(`Gemini API quota exceeded. Please wait or upgrade your plan. Details: ${flashError.message}`);
      }
    }
    
    console.error('[AI] Adversarial audit failed:', error);
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
  }
}
