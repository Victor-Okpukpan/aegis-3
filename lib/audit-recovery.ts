import { getAllAudits, updateAuditStatus } from './storage';

/**
 * Recovery utility to fix stuck audits
 * Run this periodically or on server start
 */
export async function recoverStuckAudits() {
  try {
    const audits = await getAllAudits();
    const now = Date.now();
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

    for (const audit of audits) {
      // Only check analyzing/pending audits
      if (audit.status !== 'analyzing' && audit.status !== 'pending') {
        continue;
      }

      const createdAt = new Date(audit.created_at).getTime();
      const elapsed = now - createdAt;

      // If stuck for more than 15 minutes, mark as failed
      if (elapsed > TIMEOUT_MS) {
        console.log(`[RECOVERY] Marking stuck audit ${audit.id} as failed (${Math.round(elapsed / 60000)} minutes)`);
        await updateAuditStatus(audit.id, 'failed', {
          system_map: `Error: Analysis timed out after ${Math.round(elapsed / 60000)} minutes. The process may have been interrupted or encountered an error.`,
        });
      }
    }
  } catch (error) {
    console.error('[RECOVERY] Failed to recover stuck audits:', error);
  }
}

/**
 * Start periodic recovery checks
 */
export function startAuditRecovery() {
  // Run immediately on startup
  recoverStuckAudits();

  // Run every 5 minutes
  setInterval(() => {
    recoverStuckAudits();
  }, 5 * 60 * 1000);

  console.log('[RECOVERY] Audit recovery service started');
}
