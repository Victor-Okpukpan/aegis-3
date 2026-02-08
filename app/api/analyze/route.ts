import { NextRequest, NextResponse } from 'next/server';
import { getAudit, updateAuditStatus } from '@/lib/storage';
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

    if (audit.status !== 'analyzing') {
      return NextResponse.json(
        { error: 'Audit not ready for analysis. Must be in "analyzing" state.' },
        { status: 400 }
      );
    }

    // Verify flattened code is available
    if (!audit.flattened_code) {
      return NextResponse.json(
        { error: 'Flattened code not found. Repository ingestion may have failed.' },
        { status: 400 }
      );
    }

    // Start analysis (async)
    performAnalysis(audit_id, audit.flattened_code, audit.files || {}).catch(error => {
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
async function performAnalysis(auditId: string, code: string, fileContents: Record<string, string>) {
  try {
    await updateAuditStatus(auditId, 'analyzing');
    
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

    // Step 4: Save results (file contents already stored from ingest step)
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
      // Truncate very long error messages
      userMessage = fullError.slice(0, 200) + '...';
    } else {
      userMessage = fullError;
    }
    
    await updateAuditStatus(auditId, 'failed', {
      system_map: `Error: ${userMessage}`,
    });
  }
}
