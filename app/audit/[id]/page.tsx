'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileCode, AlertTriangle, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import CodeViewer from '@/components/CodeViewer';
import SeverityBadge from '@/components/SeverityBadge';
import StatusIndicator from '@/components/StatusIndicator';
import { AuditResult } from '@/lib/types';

export default function AuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const auditId = params.id as string;

  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<number>(0);
  const [copiedPoc, setCopiedPoc] = useState<string | null>(null);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyzeStartTime = useRef<number | null>(null);
  
  // Resizable panel state
  const [detailPanelHeight, setDetailPanelHeight] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect screen size
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    fetchAudit();
    
    // Always poll every 3 seconds
    intervalRef.current = setInterval(() => {
      fetchAudit();
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [auditId]);

  // Stop polling when analysis is complete or failed
  useEffect(() => {
    if (audit?.status === 'completed') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      analyzeStartTime.current = null;
      setTimeoutWarning(false);
      toast.success(`Analysis Complete\n${audit.findings.length} finding${audit.findings.length !== 1 ? 's' : ''} detected`);
    } else if (audit?.status === 'failed') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      analyzeStartTime.current = null;
      setTimeoutWarning(false);
      
      // Show simplified error toast
      const errorMsg = audit.system_map?.replace('Error: ', '') || 'Analysis failed';
      if (errorMsg.includes('quota') || errorMsg.includes('API')) {
        toast.error('API Quota Exceeded\nWait for reset or upgrade plan', { duration: 8000 });
      } else {
        toast.error(`Analysis Failed\n${errorMsg.slice(0, 100)}`, { duration: 6000 });
      }
    } else if (audit?.status === 'analyzing') {
      // Track when analyzing started
      if (!analyzeStartTime.current) {
        analyzeStartTime.current = Date.now();
      }
      
      // Check for timeout (15 seconds - typical Vercel Hobby limit + buffer)
      const elapsed = Date.now() - analyzeStartTime.current;
      if (elapsed > 15000 && !timeoutWarning) {
        setTimeoutWarning(true);
        toast.error(
          'Analysis Taking Longer Than Expected\n\nLikely cause: Vercel Hobby plan (10s timeout).\nSolution: Upgrade to Pro or try a smaller repo.',
          { duration: 10000 }
        );
      }
    }
  }, [audit?.status, timeoutWarning]);

  async function fetchAudit() {
    try {
      const res = await fetch(`/api/audits?id=${auditId}`);
      if (!res.ok) {
        // During polling, audit might not be saved yet - this is expected
        // Only log if it's been a while (loading is false means we've been trying)
        if (!loading) {
          console.warn('Audit not found (still processing)');
        }
        return;
      }
      
      const data = await res.json();
      setAudit(data);
      setLoading(false);
    } catch (error) {
      // Network errors or JSON parse errors - log but don't show to user
      if (!loading) {
        console.error('Failed to fetch audit:', error);
      }
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPoc(id);
      setTimeout(() => setCopiedPoc(null), 2000);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  }

  // Handle resize drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      
      // Constrain between 20% and 80%
      if (newHeight >= 20 && newHeight <= 80) {
        setDetailPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="console-log">[SYSTEM] Loading audit data...</div>
        </main>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="console-log-error mb-4">[ERROR] Audit not found</div>
            <button
              onClick={() => router.push('/')}
              className="tactical-button"
            >
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentFinding = audit.findings[selectedFinding];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Audit Header */}
      <div className="border-b border-slate-800 bg-black">
        <div className="container mx-auto px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
              <button
                onClick={() => router.push('/')}
                className="text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-1">
                  Audit Report
                </div>
                <div className="text-xs lg:text-sm font-mono text-emerald-400 truncate">
                  {audit.repo_url}
                </div>
              </div>
            </div>
            <StatusIndicator status={audit.status} showLabel={false} />
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Findings Panel - Left Side / Top on Mobile */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-slate-800 bg-black overflow-y-auto max-h-[40vh] lg:max-h-none">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Findings ({audit.findings.length})
            </h3>
          </div>

          {audit.status === 'analyzing' || audit.status === 'pending' ? (
            <div className="p-4">
              {/* Live Progress Log */}
              {audit.progress_log && audit.progress_log.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {audit.progress_log.map((log, idx) => (
                    <div
                      key={idx}
                      className={`console-log text-xs ${
                        idx === audit.progress_log!.length - 1 ? 'animate-pulse text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="console-log-success animate-pulse">
                  [AI] {audit.status === 'pending' ? 'Preparing analysis...' : 'Analyzing contracts...'}
                </div>
              )}
              
              {timeoutWarning && (
                <div className="mt-4 p-4 border border-yellow-500/30 bg-yellow-500/5">
                  <div className="text-xs text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Timeout Detected
                  </div>
                  <div className="text-sm text-slate-300 mb-3">
                    Analysis is taking longer than expected (&gt;15s). This likely means:
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1 mb-3 list-disc list-inside">
                    <li>Vercel Hobby plan has 10-second function timeout</li>
                    <li>Large repositories exceed this limit</li>
                    <li>The serverless function was terminated mid-analysis</li>
                  </ul>
                  <div className="text-xs text-emerald-400 font-bold">
                    Solutions:
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>Upgrade to Vercel Pro (60s timeout)</li>
                    <li>Test with smaller repositories</li>
                    <li>Use localhost for large audits</li>
                  </ul>
                </div>
              )}
            </div>
          ) : audit.status === 'failed' ? (
            <div className="p-4">
              <div className="console-log-error mb-4">
                [ERROR] Analysis failed
              </div>
              {audit.system_map && audit.system_map.startsWith('Error:') && (
                <div className="p-4 border border-red-500/30 bg-red-500/5">
                  <div className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Error Summary
                  </div>
                  <div className="text-sm text-slate-300 mb-4 break-words whitespace-pre-wrap">
                    {audit.system_map.replace('Error: ', '')}
                  </div>
                  
                  {/* Show specific fix for network errors */}
                  {audit.system_map.includes('fetch failed') && (
                    <div className="mt-3 p-3 border border-yellow-500/30 bg-yellow-500/5">
                      <div className="text-xs text-yellow-400 uppercase tracking-wider mb-2">
                        Network Connectivity Issue
                      </div>
                      <div className="text-xs text-slate-400 space-y-1">
                        <p>This error typically occurs on <strong>WSL2/localhost</strong> when the Gemini API is unreachable.</p>
                        <p className="mt-2 text-emerald-400 font-bold">Solutions:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Restart WSL2 networking: <code className="text-xs bg-black px-1 py-0.5">wsl --shutdown</code> (in Windows PowerShell)</li>
                          <li>Check if VPN/firewall is blocking API calls</li>
                          <li>Test on Vercel deployment (has full internet access)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  toast.loading('Redirecting to dashboard...', { duration: 1000 });
                  setTimeout(() => router.push('/'), 1000);
                }}
                className="tactical-button-primary mt-4"
              >
                Return to Dashboard
              </button>
            </div>
          ) : audit.findings.length === 0 ? (
            <div className="p-4">
              <div className="console-log text-slate-600">
                [SYSTEM] No vulnerabilities detected.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {audit.findings.map((finding, index) => (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFinding(index)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedFinding === index
                      ? 'bg-emerald-500/5 border-l-2 border-emerald-500'
                      : 'hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <SeverityBadge severity={finding.severity} />
                    {finding.historical_reference && (
                      <div className="text-xs text-amber-500 flex-shrink-0">
                        ⚡ {finding.historical_reference.similarity_score}%
                      </div>
                    )}
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-200 mb-2 break-words">
                    {finding.title}
                  </h4>
                  
                  <div className="text-xs text-slate-500 flex items-start gap-2">
                    <FileCode className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="break-all">{finding.file_path}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel - Right Side / Bottom on Mobile */}
        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
          {currentFinding ? (
            <>
              {/* Finding Details - Scrollable with Dynamic Height */}
              <div 
                className="p-4 lg:p-6 bg-black overflow-y-auto"
                style={{ 
                  height: isDesktop ? `${detailPanelHeight}vh` : 'auto',
                  maxHeight: isDesktop ? 'none' : '40vh'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <SeverityBadge severity={currentFinding.severity} className="mb-3" />
                    <h2 className="text-xl font-bold text-slate-100 mb-2">
                      {currentFinding.title}
                    </h2>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mb-4">
                      <FileCode className="w-3 h-3" />
                      {currentFinding.file_path}
                      {currentFinding.line_numbers.length > 0 && (
                        <span>Lines: {currentFinding.line_numbers.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {currentFinding.description}
                  </p>
                </div>

                {/* Historical Reference */}
                {currentFinding.historical_reference && (
                  <div className="mt-6 p-4 border border-amber-500/30 bg-amber-500/5">
                    <div className="text-xs text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      Historical Reference
                    </div>
                    <div className="text-sm text-slate-300">
                      <strong>{currentFinding.historical_reference.title}</strong>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>Protocol: {currentFinding.historical_reference.protocol}</span>
                      <span>•</span>
                      <span>Similarity: {currentFinding.historical_reference.similarity_score}%</span>
                      {currentFinding.historical_reference.source_link && (
                        <>
                          <span>•</span>
                          <a 
                            href={currentFinding.historical_reference.source_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1"
                          >
                            View Original Report
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* PoC Code */}
                {currentFinding.poc_code && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">
                        Proof of Concept (Foundry)
                      </div>
                      <button
                        onClick={() => copyToClipboard(currentFinding.poc_code!, currentFinding.id)}
                        className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        {copiedPoc === currentFinding.id ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 bg-black border border-slate-800 text-xs text-slate-300 overflow-x-auto">
                      <code>{currentFinding.poc_code}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Resize Handle - Desktop Only */}
              <div
                onMouseDown={handleMouseDown}
                className={`hidden lg:block h-1 bg-slate-800 hover:bg-emerald-500/50 cursor-ns-resize transition-colors relative group ${
                  isDragging ? 'bg-emerald-500' : ''
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-0.5 bg-slate-600 group-hover:bg-emerald-400 transition-colors" />
                </div>
              </div>

              {/* Code Viewer */}
              <div className="flex-1 bg-black overflow-hidden">
                <CodeViewer
                  code={
                    audit.files && audit.files[currentFinding.file_path]
                      ? audit.files[currentFinding.file_path]
                      : `// ${currentFinding.file_path}\n\n// File content not available\n// Vulnerability at lines: ${currentFinding.line_numbers.join(', ')}`
                  }
                  language="sol"
                  highlightLines={currentFinding.line_numbers}
                  className="h-full"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="console-log text-slate-600">
                [SYSTEM] Select a finding to view details
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
