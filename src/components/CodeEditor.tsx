import React, { useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { Play, RotateCcw, Send, Settings2 } from 'lucide-react';
import styles from './CodeEditor.module.css';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  language: 'javascript' | 'python';
  onReset: () => void;
  onRun: () => void;
  onSubmit: () => void;
  isRunning: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  language,
  onReset,
  onRun,
  onSubmit,
  isRunning,
}) => {
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(language === 'javascript' ? 2 : 4);

  const editorLanguage = language === 'javascript' ? 'javascript' : 'python';

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <div className={styles.controlsLeft}>
          <div style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 'bold', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
            Python 3 (Pyodide WASM)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <Settings2 size={14} />
            <select
              className={styles.select}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ padding: '4px 6px', fontSize: '0.8rem' }}
              title="Font Size"
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '0.8rem' }}>Spaces:</span>
            <select
              className={styles.select}
              value={tabSize}
              onChange={(e) => setTabSize(Number(e.target.value))}
              style={{ padding: '4px 6px', fontSize: '0.8rem' }}
              title="Tab Width"
            >
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="8">8</option>
            </select>
          </div>

          <button
            className={styles.resetBtn}
            onClick={onReset}
            title="Reset to starter template"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className={styles.actionsRight}>
          <button
            className={`${styles.btn} ${styles.btnRun}`}
            onClick={onRun}
            disabled={isRunning}
          >
            <Play size={14} className={isRunning ? 'spin' : ''} />
            <span>Run Code</span>
          </button>
          
          <button
            className={`${styles.btn} ${styles.btnSubmit}`}
            onClick={onSubmit}
            disabled={isRunning}
          >
            <Send size={14} />
            <span>Submit</span>
          </button>
        </div>
      </div>

      <div className={styles.editorWrapper}>
        <MonacoEditor
          height="100%"
          language={editorLanguage}
          theme="monospace-theme"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('monospace-theme', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '475569', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'e2e8f0', fontStyle: 'bold' },
                { token: 'identifier', foreground: 'e2e8f0' },
                { token: 'string', foreground: '94a3b8' },
                { token: 'number', foreground: '94a3b8' },
                { token: 'regexp', foreground: '64748b' },
                { token: 'type', foreground: 'cbd5e1' },
                { token: 'class', foreground: 'cbd5e1' },
                { token: 'function', foreground: 'cbd5e1' },
              ],
              colors: {
                'editor.background': '#121316',
                'editor.foreground': '#e2e8f0',
                'editor.lineHighlightBackground': '#25282e',
                'editorLineNumber.foreground': '#475569',
                'editorLineNumber.activeForeground': '#94a3b8',
              }
            });
          }}
          value={code}
          onChange={(val) => onChange(val || '')}
          loading={
            <div className={styles.loadingOverlay}>
              <div className="spin" style={{ width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
              <span>Loading Monaco Editor...</span>
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: fontSize,
            fontFamily: "var(--font-mono)",
            automaticLayout: true,
            tabSize: tabSize,
            insertSpaces: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
          }}
        />
      </div>
    </div>
  );
};
export default CodeEditor;
