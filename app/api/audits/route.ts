import { NextRequest, NextResponse } from 'next/server';
import { getAllAudits, getAudit } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get specific audit
      const audit = await getAudit(id);
      if (!audit) {
        return NextResponse.json(
          { error: 'Audit not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(audit);
    } else {
      // Get all audits
      const audits = await getAllAudits();
      return NextResponse.json({ audits });
    }
  } catch (error) {
    console.error('[API] Audits fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audits' },
      { status: 500 }
    );
  }
}
