import { NextResponse } from 'next/server';
import { recoverStuckAudits } from '@/lib/audit-recovery';

/**
 * Manual endpoint to trigger recovery of stuck audits
 */
export async function POST() {
  try {
    await recoverStuckAudits();
    return NextResponse.json({ 
      success: true, 
      message: 'Stuck audits recovered' 
    });
  } catch (error: any) {
    console.error('[API] Recovery error:', error);
    return NextResponse.json(
      { error: error?.message || 'Recovery failed' },
      { status: 500 }
    );
  }
}
