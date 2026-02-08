import fs from 'fs/promises';
import path from 'path';
import { AuditResult } from './types';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

// Use Redis on production (detects REDIS_URL), filesystem locally
const USE_REDIS = !!process.env.REDIS_URL;
const AUDITS_DIR = path.join(process.cwd(), '.temp', 'audits');

// Redis client (lazy initialization)
let redis: RedisClientType | null = null;
async function getRedis(): Promise<RedisClientType> {
  if (!redis && process.env.REDIS_URL) {
    redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
  }
  return redis!;
}

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
  if (USE_REDIS) {
    // Store in Redis (Upstash)
    const client = await getRedis();
    await client.set(`audit:${audit.id}`, JSON.stringify(audit));
    // Also add to sorted set of all audits (by timestamp)
    await client.zAdd('audits:list', { score: Date.now(), value: audit.id });
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
    if (USE_REDIS) {
      // Retrieve from Redis
      const client = await getRedis();
      const data = await client.get(`audit:${id}`);
      return data ? JSON.parse(data) : null;
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
    if (USE_REDIS) {
      // Get audit IDs from sorted set (newest first)
      const client = await getRedis();
      const auditIds = await client.zRange('audits:list', 0, -1, { REV: true });
      const audits: AuditResult[] = [];
      
      for (const id of auditIds) {
        const data = await client.get(`audit:${id}`);
        if (data) {
          audits.push(JSON.parse(data));
        }
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
