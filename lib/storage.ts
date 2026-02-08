import fs from 'fs/promises';
import path from 'path';
import { AuditResult } from './types';
import { kv } from '@vercel/kv';

// Use Redis/KV on production (detects REDIS_URL, KV_URL, or KV_REST_API_URL), filesystem locally
const USE_KV = !!(process.env.REDIS_URL || process.env.KV_URL || process.env.KV_REST_API_URL);
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
  if (USE_KV) {
    // Store in Vercel KV (Redis)
    await kv.set(`audit:${audit.id}`, audit);
    // Also add to list of all audits
    await kv.zadd('audits:list', { score: Date.now(), member: audit.id });
  } else {
    // Fallback to filesystem for local development
    await ensureAuditsDir();
    const filePath = path.join(AUDITS_DIR, `${audit.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(audit, null, 2), 'utf-8');
  }
}

/**
 * Get audit by ID
 */
export async function getAudit(id: string): Promise<AuditResult | null> {
  try {
    if (USE_KV) {
      // Retrieve from Vercel KV
      const audit = await kv.get<AuditResult>(`audit:${id}`);
      return audit;
    } else {
      // Fallback to filesystem
      const filePath = path.join(AUDITS_DIR, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    return null;
  }
}

/**
 * Get all audits (sorted by created_at, newest first)
 */
export async function getAllAudits(): Promise<AuditResult[]> {
  try {
    if (USE_KV) {
      // Get audit IDs from sorted set (newest first)
      const auditIds = await kv.zrange<string[]>('audits:list', 0, -1, { rev: true });
      const audits: AuditResult[] = [];
      
      for (const id of auditIds) {
        const audit = await kv.get<AuditResult>(`audit:${id}`);
        if (audit) audits.push(audit);
      }
      
      return audits;
    } else {
      // Fallback to filesystem
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
    }
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
