import fs from 'fs/promises';
import path from 'path';
import { AuditResult } from './types';

const AUDITS_DIR = path.join(process.cwd(), '.temp', 'audits');

/**
 * Initialize audits storage directory
 */
async function ensureAuditsDir() {
  await fs.mkdir(AUDITS_DIR, { recursive: true });
}

/**
 * Save audit result to storage
 */
export async function saveAudit(audit: AuditResult): Promise<void> {
  await ensureAuditsDir();
  const filePath = path.join(AUDITS_DIR, `${audit.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(audit, null, 2), 'utf-8');
}

/**
 * Get audit by ID
 */
export async function getAudit(id: string): Promise<AuditResult | null> {
  try {
    const filePath = path.join(AUDITS_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Get all audits (sorted by created_at, newest first)
 */
export async function getAllAudits(): Promise<AuditResult[]> {
  try {
    await ensureAuditsDir();
    const files = await fs.readdir(AUDITS_DIR);
    const audits: AuditResult[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(AUDITS_DIR, file), 'utf-8');
          audits.push(JSON.parse(content));
        } catch (error) {
          console.error(`Failed to read audit ${file}:`, error);
        }
      }
    }

    return audits.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (error) {
    return [];
  }
}

/**
 * Update audit status
 */
export async function updateAuditStatus(
  id: string,
  status: AuditResult['status'],
  updates?: Partial<AuditResult>
): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) throw new Error('Audit not found');

  audit.status = status;
  if (updates) {
    Object.assign(audit, updates);
  }

  await saveAudit(audit);
}
