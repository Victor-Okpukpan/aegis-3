'use client';

import { useEffect, useRef } from 'react';

interface ConsoleLogProps {
  logs: string[];
  className?: string;
}

export default function ConsoleLog({ logs, className = '' }: ConsoleLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className={`bg-black border border-slate-800 p-4 h-64 overflow-y-auto ${className}`}
    >
      {logs.length === 0 ? (
        <div className="console-log">
          [SYSTEM] Awaiting input...
        </div>
      ) : (
        logs.map((log, index) => (
          <div
            key={index}
            className={
              log.includes('[ERROR]')
                ? 'console-log-error'
                : log.includes('[STATUS]') || log.includes('[AI]')
                ? 'console-log-success'
                : 'console-log'
            }
          >
            {log}
          </div>
        ))
      )}
    </div>
  );
}
