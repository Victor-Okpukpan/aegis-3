import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { cloneRepository, flattenSolidityCode, isValidGitHubUrl } from '@/lib/github';
import { saveAudit } from '@/lib/storage';
import { AuditResult } from '@/lib/types';

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
