import fs from 'fs/promises';
import path from 'path';
import { SecurityReport, SecurityFinding } from './types';

const REPORTS_DIR = path.join(process.cwd(), 'data', 'security-reports');

// In-memory cache for indexed reports
let reportsCache: Map<string, SecurityReport> | null = null;
let indexedFindings: SecurityFinding[] = [];

/**
 * RAG-lite indexing system
 * Loads all JSON reports and creates a searchable index
 */
export async function initializeReportsIndex(): Promise<void> {
  if (reportsCache) return; // Already initialized

  console.log('[REPORTS] Initializing RAG-lite index...');
  
  reportsCache = new Map();
  const files = await fs.readdir(REPORTS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf-8');
      const report: SecurityReport = JSON.parse(content);
      reportsCache.set(file, report);
      indexedFindings.push(...report.findings);
    } catch (error) {
      console.error(`[REPORTS] Failed to load ${file}:`, error);
    }
  }

  console.log(`[REPORTS] Indexed ${indexedFindings.length} findings from ${jsonFiles.length} reports`);
}

/**
 * Search for relevant historical vulnerabilities based on code patterns
 */
export async function searchRelevantFindings(
  keywords: string[],
  patterns: string[],
  limit: number = 10
): Promise<SecurityFinding[]> {
  await initializeReportsIndex();

  const scoredFindings = indexedFindings.map(finding => {
    let score = 0;

    // Score based on title and content matching
    const searchText = `${finding.title} ${finding.content}`.toLowerCase();
    
    keywords.forEach(keyword => {
      const kw = keyword.toLowerCase();
      if (searchText.includes(kw)) {
        score += 3;
      }
    });

    // Score based on tags matching patterns
    patterns.forEach(pattern => {
      const patternLower = pattern.toLowerCase();
      finding.tags.forEach(tag => {
        if (tag.toLowerCase().includes(patternLower)) {
          score += 5;
        }
      });
    });

    // Boost high-severity findings
    if (finding.impact === 'CRITICAL') score += 10;
    if (finding.impact === 'HIGH') score += 5;

    // Boost findings with higher quality/rarity scores
    score += finding.quality_score * 2;
    score += finding.rarity_score;

    return { finding, score };
  });

  // Sort by score and return top results
  return scoredFindings
    .filter(sf => sf.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(sf => sf.finding);
}

/**
 * Get findings by category
 */
export async function getFindingsByCategory(category: string): Promise<SecurityFinding[]> {
  await initializeReportsIndex();
  
  const report = reportsCache?.get(`${category.toLowerCase()}.json`);
  return report?.findings || [];
}

/**
 * Extract key vulnerability patterns from code
 */
export function extractVulnerabilityPatterns(code: string): string[] {
  const patterns: string[] = [];
  
  // Common vulnerability patterns in Solidity
  const patternDetectors = [
    { pattern: /delegatecall/gi, name: 'delegatecall' },
    { pattern: /selfdestruct/gi, name: 'selfdestruct' },
    { pattern: /tx\.origin/gi, name: 'tx.origin' },
    { pattern: /transfer\(/gi, name: 'transfer' },
    { pattern: /send\(/gi, name: 'send' },
    { pattern: /call\.value/gi, name: 'call.value' },
    { pattern: /assembly/gi, name: 'assembly' },
    { pattern: /proxy/gi, name: 'proxy' },
    { pattern: /oracle/gi, name: 'oracle' },
    { pattern: /flashloan/gi, name: 'flashloan' },
    { pattern: /reentrancy/gi, name: 'reentrancy' },
    { pattern: /access control/gi, name: 'access-control' },
    { pattern: /integer overflow/gi, name: 'overflow' },
    { pattern: /underflow/gi, name: 'underflow' },
    { pattern: /block\.timestamp/gi, name: 'timestamp' },
    { pattern: /blockhash/gi, name: 'blockhash' },
    { pattern: /approve/gi, name: 'approve' },
    { pattern: /transferFrom/gi, name: 'transferFrom' },
    { pattern: /\_mint/gi, name: 'minting' },
    { pattern: /\_burn/gi, name: 'burning' },
  ];

  for (const detector of patternDetectors) {
    if (detector.pattern.test(code)) {
      patterns.push(detector.name);
    }
  }

  return [...new Set(patterns)];
}

/**
 * Generate search keywords from code and architecture
 */
export function generateSearchKeywords(code: string, systemMap?: any): string[] {
  const keywords: string[] = [];

  // Extract common DeFi/Web3 terms
  const terms = [
    'vault', 'pool', 'staking', 'lending', 'borrow', 'oracle',
    'price', 'liquidity', 'swap', 'exchange', 'token', 'erc20',
    'proxy', 'upgradeable', 'governance', 'timelock', 'multisig',
    'flash', 'loan', 'liquidation', 'collateral', 'debt'
  ];

  for (const term of terms) {
    if (new RegExp(term, 'gi').test(code)) {
      keywords.push(term);
    }
  }

  // Add patterns from system map
  if (systemMap?.patterns) {
    keywords.push(...systemMap.patterns);
  }

  return [...new Set(keywords)];
}
