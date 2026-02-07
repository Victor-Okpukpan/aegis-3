import { NextRequest, NextResponse } from 'next/server';
import { getAudit, updateAuditStatus, saveAudit } from '@/lib/storage';
import { cloneRepository, flattenSolidityCode, cleanupRepository } from '@/lib/github';
import { generateSystemMap, performAdversarialAudit } from '@/lib/gemini';
import { searchRelevantFindings, extractVulnerabilityPatterns, generateSearchKeywords } from '@/lib/reports';

export async function POST(req: NextRequest) {
  try {
    const { audit_id } = await req.json();

    if (!audit_id) {
      return NextResponse.json(
        { error: 'Audit ID required' },
        { status: 400 }
      );
    }

    // Validate Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get audit record
    const audit = await getAudit(audit_id);
    if (!audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 }
      );
    }

    if (audit.status !== 'pending') {
      return NextResponse.json(
        { error: 'Audit already processed or in progress' },
        { status: 400 }
      );
    }

    // Start analysis (async)
    performAnalysis(audit_id, audit.repo_url).catch(error => {
      console.error(`[ANALYZE ${audit_id}] Failed:`, error);
    });

    return NextResponse.json({ status: 'analysis_started', audit_id });
  } catch (error) {
    console.error('[API] Analyze error:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}

/**
 * Background analysis processing
 */
async function performAnalysis(auditId: string, repoUrl: string) {
  let repoId: string | null = null;

  try {
    await updateAuditStatus(auditId, 'analyzing');

    // Step 1: Clone and flatten repository
    console.log(`[ANALYZE ${auditId}] Cloning repository...`);
    const { id, path: repoPath } = await cloneRepository(repoUrl);
    repoId = id;

    const { code, files } = await flattenSolidityCode(repoPath);
    
    // Create a map of file paths to contents for later display
    const fileContents: Record<string, string> = {};
    files.forEach(file => {
      fileContents[file.path] = file.content;
    });
    
    // Step 2: Generate Architecture System Map
    console.log(`[ANALYZE ${auditId}] Generating system map...`);
    const systemMap = await generateSystemMap(code);

    await updateAuditStatus(auditId, 'analyzing', {
      system_map: JSON.stringify(systemMap, null, 2),
    });

    // Step 3: Extract vulnerability patterns and search historical findings
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

    // Step 4: Perform adversarial audit with Gemini 3
    console.log(`[ANALYZE ${auditId}] Performing adversarial audit...`);
    const findings = await performAdversarialAudit(
      code,
      systemMap,
      historicalContext
    );

    // Step 5: Save results (including file contents for display)
    await updateAuditStatus(auditId, 'completed', {
      findings,
      files: fileContents,
    });

    console.log(`[ANALYZE ${auditId}] Analysis complete. Found ${findings.length} issues.`);

    // Cleanup
    if (repoId) {
      await cleanupRepository(repoId);
    }
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
      // Truncate very long error messages
      userMessage = fullError.slice(0, 200) + '...';
    } else {
      userMessage = fullError;
    }
    
    await updateAuditStatus(auditId, 'failed', {
      system_map: `Error: ${userMessage}`,
    });
    
    if (repoId) {
      await cleanupRepository(repoId);
    }
  }
}
