'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';

interface CodeViewerProps {
  code: string;
  language?: string;
  highlightLines?: number[];
  className?: string;
}

export default function CodeViewer({
  code,
  language = 'sol',
  highlightLines = [],
  className = '',
}: CodeViewerProps) {
  const editorRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editorRef.current && window.monaco) {
      const editor = editorRef.current;
      const monaco = window.monaco;
      
      if (highlightLines.length > 0) {
        const decorations = highlightLines.map(lineNumber => ({
          range: new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_VALUE),
          options: {
            isWholeLine: true,
            className: 'vulnerable-line',
            glyphMarginClassName: 'vulnerable-glyph',
            linesDecorationsClassName: 'vulnerable-line-decoration',
          },
        }));
        
        // Clear old decorations and add new ones
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
      } else {
        // Clear all decorations if no lines to highlight
        editor.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
    }
  }, [highlightLines, code]);

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;

    // Custom theme
    monaco.editor.defineTheme('aegis-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '10b981', fontStyle: 'bold' },
        { token: 'string', foreground: '6ee7b7' },
        { token: 'number', foreground: '34d399' },
        { token: 'type', foreground: '5eead4' },
        { token: 'function', foreground: 'a7f3d0' },
        { token: 'variable', foreground: 'd1fae5' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#0f172a',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#10b981',
        'editor.selectionBackground': '#10b98133',
        'editor.inactiveSelectionBackground': '#10b98122',
        'editorCursor.foreground': '#10b981',
        'editorWhitespace.foreground': '#1e293b',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#334155',
      },
    });

    monaco.editor.setTheme('aegis-dark');
    
    // Apply initial decorations if any
    if (highlightLines.length > 0) {
      const decorations = highlightLines.map(lineNumber => ({
        range: new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_VALUE),
        options: {
          isWholeLine: true,
          className: 'vulnerable-line',
          glyphMarginClassName: 'vulnerable-glyph',
          linesDecorationsClassName: 'vulnerable-line-decoration',
        },
      }));
      decorationsRef.current = editor.deltaDecorations([], decorations);
    }
  }

  if (!mounted) {
    return (
      <div className={`monaco-container bg-black h-full flex items-center justify-center ${className}`}>
        <div className="console-log">[SYSTEM] Initializing code viewer...</div>
      </div>
    );
  }

  return (
    <div className={`monaco-container ${className}`}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={code}
        theme="aegis-dark"
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          lineNumbers: 'on',
          glyphMargin: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'off',
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}
