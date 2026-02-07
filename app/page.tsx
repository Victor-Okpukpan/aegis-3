'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, GitBranch, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import ConsoleLog from '@/components/ConsoleLog';
import StatusIndicator from '@/components/StatusIndicator';
import { AuditResult } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export default function HomePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditResult[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  useEffect(() => {
    fetchRecentAudits();
    const interval = setInterval(fetchRecentAudits, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRecentAudits() {
    try {
      const res = await fetch('/api/audits');
      const data = await res.json();
      setRecentAudits(data.audits || []);
      setLoadingAudits(false);
    } catch (error) {
      console.error('Failed to fetch audits:', error);
      setLoadingAudits(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!repoUrl.trim()) return;

    setLoading(true);
    setLogs([]);
    addLog('[SYSTEM] Initiating audit sequence...');

    try {
      addLog('[STATUS] Validating GitHub URL...');
      
      // Step 1: Ingest repository
      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      });

      if (!ingestRes.ok) {
        const error = await ingestRes.json();
        throw new Error(error.error || 'Ingestion failed');
      }

      const { audit_id } = await ingestRes.json();
      addLog(`[STATUS] Audit ID: ${audit_id}`);
      addLog('[STATUS] Repository queued for analysis...');
      toast.success('Repository ingested successfully');

      // Step 2: Start analysis
      addLog('[AI] Initiating Gemini 3 analysis...');
      
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id }),
      });

      if (!analyzeRes.ok) {
        throw new Error('Analysis initialization failed');
      }

      addLog('[STATUS] Analysis started in background...');
      addLog('[SYSTEM] Redirecting to audit dashboard...');
      toast.success('Analysis started - redirecting...', { duration: 2000 });

      // Redirect to audit page
      setTimeout(() => {
        router.push(`/audit/${audit_id}`);
      }, 1500);
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      addLog(`[ERROR] ${errorMsg}`);
      
      // Show user-friendly toast
      if (errorMsg.includes('quota') || errorMsg.includes('429')) {
        toast.error('API Quota Exceeded\nPlease wait for quota reset or upgrade your Gemini API plan', {
          duration: 8000,
        });
      } else if (errorMsg.includes('Invalid') || errorMsg.includes('URL')) {
        toast.error('Invalid GitHub URL\nPlease check the repository URL format');
      } else {
        toast.error(`Analysis Failed\n${errorMsg.slice(0, 100)}`);
      }
      
      setLoading(false);
    }
  }

  function addLog(message: string) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 lg:px-6 py-6 lg:py-12">
        {/* Hero Section */}
        <div className="border border-slate-800 p-4 lg:p-8 mb-6 lg:mb-8">
          <div className="flex items-start gap-4 lg:gap-6">
            <Shield className="w-12 h-12 lg:w-16 lg:h-16 text-emerald-500 mt-1 lg:mt-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl lg:text-3xl font-bold mb-2 lg:mb-3 text-emerald-400 tracking-wider">
                AEGIS-3 SECURITY AUDITOR
              </h2>
              <p className="text-slate-400 text-xs lg:text-sm leading-relaxed mb-4 lg:mb-6">
                Advanced adversarial AI system for smart contract security analysis. 
                Powered by Gemini 3 with semantic context from 50,000+ historical exploit reports.
                Identifies deep business logic flaws, economic vulnerabilities, and state inconsistencies.
              </p>
              
              <div className="grid grid-cols-3 gap-2 lg:gap-4 text-center">
                <div className="border border-slate-800 p-2 lg:p-3">
                  <div className="text-lg lg:text-2xl font-bold text-emerald-400">50K+</div>
                  <div className="text-[10px] lg:text-xs text-slate-500 uppercase tracking-wider mt-1">
                    Historical Reports
                  </div>
                </div>
                <div className="border border-slate-800 p-2 lg:p-3">
                  <div className="text-lg lg:text-2xl font-bold text-emerald-400">Gemini 3</div>
                  <div className="text-[10px] lg:text-xs text-slate-500 uppercase tracking-wider mt-1">
                    Deep Reasoning
                  </div>
                </div>
                <div className="border border-slate-800 p-2 lg:p-3">
                  <div className="text-lg lg:text-2xl font-bold text-emerald-400">RAG-Lite</div>
                  <div className="text-[10px] lg:text-xs text-slate-500 uppercase tracking-wider mt-1">
                    Context Engine
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          {/* Input Section */}
          <div>
            <div className="border border-slate-800 bg-black p-6 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Repository Input
              </h3>
              
              <form onSubmit={handleSubmit}>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="tactical-input mb-4"
                  disabled={loading}
                />
                
                <button
                  type="submit"
                  className="tactical-button-primary w-full"
                  disabled={loading || !repoUrl.trim()}
                >
                  {loading ? 'ANALYZING...' : 'INITIATE AUDIT'}
                </button>
              </form>
            </div>

            <ConsoleLog logs={logs} />
          </div>

          {/* Recent Audits */}
          <div>
            <div className="border border-slate-800 bg-black p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Audits
              </h3>

              {loadingAudits ? (
                <div className="console-log">
                  [SYSTEM] Loading audit history...
                </div>
              ) : recentAudits.length === 0 ? (
                <div className="console-log text-slate-600">
                  No audits yet. Submit a repository to begin.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {recentAudits.slice(0, 10).map((audit) => (
                    <div
                      key={audit.id}
                      onClick={() => router.push(`/audit/${audit.id}`)}
                      className="tactical-card-hover"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-emerald-400 font-mono truncate">
                            {audit.repo_url}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {formatDistanceToNow(new Date(audit.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        <StatusIndicator status={audit.status} showLabel={false} />
                      </div>

                      {audit.status === 'completed' && audit.findings.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <AlertTriangle className="w-3 h-3 text-orange-500" />
                          <span className="text-slate-400">
                            {audit.findings.length} finding{audit.findings.length !== 1 ? 's' : ''} detected
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-800 pt-6 text-center">
          <p className="text-xs text-slate-600 uppercase tracking-wider">
            Aegis-3 | Tactical Security Platform | Powered by Gemini 3 Pro
          </p>
        </div>
      </main>
    </div>
  );
}
