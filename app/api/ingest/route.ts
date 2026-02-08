import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { cloneRepository, flattenSolidityCode, isValidGitHubUrl } from '@/lib/github';
import { saveAudit, getAudit } from '@/lib/storage';
import { AuditResult } from '@/lib/types';
import { generateSystemMap, performAdversarialAudit } from '@/lib/gemini';
import { searchRelevantFindings, extractVulnerabilityPatterns, generateSearchKeywords } from '@/lib/reports';

export async function POST(req: NextRequest) {
  try {
    const { repo_url } = await req.json();

    // Validate URL
    if (!repo_url || !isValidGitHubUrl(repo_url)) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    // Create audit record
    const auditId = nanoid(12);
    const audit: AuditResult = {
      id: auditId,
      repo_url,
      system_map: '',
      findings: [],
      created_at: new Date().toISOString(),
      status: 'pending',
    };

    await saveAudit(audit);

    // Start async processing (don't await)
    processRepository(auditId, repo_url).catch(error => {
      console.error(`[AUDIT ${auditId}] Processing failed:`, error);
    });

    return NextResponse.json({ audit_id: auditId });
  } catch (error) {
    console.error('[API] Ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate audit' },
      { status: 500 }
    );
  }
}

/**
 * Background processing of repository
 */
async function processRepository(auditId: string, repoUrl: string) {
  const { updateAuditStatus } = await import('@/lib/storage');
  const { cleanupRepository } = await import('@/lib/github');
  
  let repoId: string | null = null;

  try {
    // Clone repository
    const { id, path: repoPath } = await cloneRepository(repoUrl);
    repoId = id;

    // Flatten Solidity code
    const { code, files } = await flattenSolidityCode(repoPath);
    
    // Create file contents map
    const fileContents: Record<string, string> = {};
    files.forEach(file => {
      fileContents[file.path] = file.content;
    });

    // Update status to analyzing and store flattened code + files
    await updateAuditStatus(auditId, 'analyzing', {
      system_map: `Repository cloned successfully. ${code.length} characters of Solidity code extracted.`,
      flattened_code: code,
      files: fileContents,
    });

    // Cleanup
    await cleanupRepository(repoId);
    
    // Trigger analysis automatically
    console.log(`[AUDIT ${auditId}] Starting AI analysis...`);
    performAIAnalysis(auditId).catch(error => {
      console.error(`[AUDIT ${auditId}] AI analysis failed:`, error);
    });
  } catch (error: any) {
    console.error(`[AUDIT ${auditId}] Processing error:`, error);
    try {
      await updateAuditStatus(auditId, 'failed', {
        system_map: `Error: ${error?.message || 'Processing failed'}`,
      });
    } catch (statusError) {
      console.error(`[AUDIT ${auditId}] Failed to update status:`, statusError);
    }
    
    if (repoId) {
      try {
        await cleanupRepository(repoId);
      } catch (cleanupError) {
        console.error(`[AUDIT ${auditId}] Cleanup error:`, cleanupError);
      }
    }
  }
}

/**
 * Perform AI analysis on the ingested repository
 */
async function performAIAnalysis(auditId: string) {
  const { updateAuditStatus } = await import('@/lib/storage');
  
  try {
    // Get the audit record
    const audit = await getAudit(auditId);
    if (!audit || !audit.flattened_code) {
      throw new Error('Audit or flattened code not found');
    }

    const code = audit.flattened_code;
    const fileContents = audit.files || {};
    
    // Step 1: Generate Architecture System Map
    console.log(`[ANALYZE ${auditId}] Generating system map...`);
    const systemMap = await generateSystemMap(code);

    await updateAuditStatus(auditId, 'analyzing', {
      system_map: JSON.stringify(systemMap, null, 2),
    });

    // Step 2: Extract vulnerability patterns and search historical findings
    console.log(`[ANALYZE ${auditId}] Searching historical patterns...`);
    const patterns = extractVulnerabilityPatterns(code);
    const keywords = generateSearchKeywords(code, systemMap);
    
    const relevantFindings = await searchRelevantFindings(keywords, patterns, 15);
    
    // Build historical context for Gemini
    const historicalContext = relevantFindings
      .map(f => `
[${f.impact}] ${f.title}
Protocol: ${f.protocol_name}
Source: ${f.source_link}
Description: ${f.content.slice(0, 500)}
Tags: ${f.tags.join(', ')}
---
      `)
      .join('\n');

    // Step 3: Perform adversarial audit with Gemini 3
    console.log(`[ANALYZE ${auditId}] Performing adversarial audit...`);
    const findings = await performAdversarialAudit(
      code,
      systemMap,
      historicalContext
    );

    // Step 4: Save results
    await updateAuditStatus(auditId, 'completed', {
      findings,
    });

    console.log(`[ANALYZE ${auditId}] Analysis complete. Found ${findings.length} issues.`);
  } catch (error: any) {
    console.error(`[ANALYZE ${auditId}] Analysis error:`, error);
    
    // Simplify error message for display
    let userMessage = 'Unknown error occurred';
    const fullError = error?.message || '';
    
    if (fullError.includes('quota') || fullError.includes('429')) {
      userMessage = 'API quota exceeded. Your Gemini API free tier limit has been reached. Please wait for quota reset or upgrade your plan.';
    } else if (fullError.includes('ENOENT') || fullError.includes('no such file')) {
      userMessage = 'Repository processing failed. The files could not be accessed.';
    } else if (fullError.includes('network') || fullError.includes('ECONNREFUSED')) {
      userMessage = 'Network error. Could not connect to Gemini API.';
    } else if (fullError.length > 200) {
      userMessage = fullError.slice(0, 200) + '...';
    } else {
      userMessage = fullError;
    }
    
    await updateAuditStatus(auditId, 'failed', {
      system_map: `Error: ${userMessage}`,
    });
  }
}
