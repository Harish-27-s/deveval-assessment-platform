import React, { useState, useEffect } from 'react';
import type { Challenge } from '../data/challenges';
import type { RunResult, RunnerResponse } from '../services/runner-js';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Terminal, Play, HelpCircle } from 'lucide-react';
import styles from './OutputConsole.module.css';

interface OutputConsoleProps {
  challenge: Challenge;
  results: RunnerResponse | null;
  isRunning: boolean;
  onRunCustom: (inputArgs: any[]) => void;
  customResult: RunResult | null;
  customError: string | null;
  isCustomRunning: boolean;
}

// Deep equality check for comparing actual output against expected output
export const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
};

export const OutputConsole: React.FC<OutputConsoleProps> = ({
  challenge,
  results,
  isRunning,
  onRunCustom,
  customResult,
  customError,
  isCustomRunning,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'console' | 'custom'>('tests');
  const [expandedTcs, setExpandedTcs] = useState<Set<number>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [customInputErr, setCustomInputErr] = useState<string | null>(null);

  // Load default custom input when challenge changes
  useEffect(() => {
    if (challenge && challenge.testCases.length > 0) {
      // Preload first test case's input as the initial custom input template formatted as one argument per line
      const defaultLines = challenge.testCases[0].input.map(arg => {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      }).join('\n');
      setCustomInput(defaultLines);
      setCustomInputErr(null);
    }
    // Switch to tests tab
    setActiveTab('tests');
    setExpandedTcs(new Set([1])); // Expand first test case by default
  }, [challenge]);

  const toggleExpand = (id: number) => {
    const next = new Set(expandedTcs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedTcs(next);
  };

  const handleRunCustom = () => {
    try {
      setCustomInputErr(null);
      const trimmed = customInput.trim();
      if (!trimmed) {
        throw new Error('Please enter input parameters.');
      }

      // 1. Try parsing as a single outer JSON array of arguments (backwards compatibility fallback)
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            onRunCustom(parsed);
            return;
          }
        } catch (e) {
          // If outer parse fails, it might be separate line-based values where line 1 starts with [ and ends with ]
        }
      }

      // 2. Line-by-line parsing
      const lines = customInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const parsedArgs = lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          // If it fails to parse as JSON (e.g. unquoted string), treat as raw string
          return line;
        }
      });

      onRunCustom(parsedArgs);
    } catch (err: any) {
      setCustomInputErr(err.message || 'Invalid input formatting.');
    }
  };

  // Calculate pass rates
  const runResults = results?.results || [];
  const testCases = challenge.testCases;
  
  // Align run result with static testCase to verify correctness
  const evaluatedResults = testCases.map((tc) => {
    const runRes = runResults.find((r) => r.id === tc.id);
    if (!runRes) return null;
    
    // Check if the actual output matches expected output
    const isCorrect = runRes.success && deepEqual(runRes.output, tc.expectedOutput);
    return {
      ...tc,
      ...runRes,
      isCorrect
    };
  });

  const validEvaluated = evaluatedResults.filter(Boolean) as NonNullable<typeof evaluatedResults[number]>[];
  const totalCases = validEvaluated.length;
  const passedCases = validEvaluated.filter((tc) => tc.isCorrect).length;
  const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0;

  return (
    <div className={styles.consoleContainer}>
      <div className={styles.tabsHeader}>
        <div className={styles.tabsLeft}>
          <button
            className={`${styles.tab} ${activeTab === 'tests' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            Test Cases
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'console' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('console')}
          >
            Console Logs {results?.logs && results.logs.length > 0 && `(${results.logs.length})`}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'custom' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Input
          </button>
        </div>

        <div className={styles.statusIndicator}>
          {isRunning && (
            <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="spin" style={{ width: '12px', height: '12px', border: '2px solid transparent', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
              Running...
            </span>
          )}
          {!isRunning && results && (
            results.success ? (
              <span style={{ color: 'var(--success)' }}>Tests Completed</span>
            ) : (
              <span style={{ color: 'var(--error)' }}>Runtime Error</span>
            )
          )}
        </div>
      </div>

      <div className={styles.contentBody}>
        {/* TAB 1: TEST CASES */}
        {activeTab === 'tests' && (
          <div style={{ height: '100%' }}>
            {!results && !isRunning && (
              <div className={styles.emptyState}>
                <Terminal size={32} />
                <p>Run your code to execute the test cases.</p>
              </div>
            )}

            {isRunning && (
              <div className={styles.emptyState}>
                <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
                <p>Running code against challenge test cases...</p>
              </div>
            )}

            {!isRunning && results && (
              <div>
                {/* Global Runner Errors e.g., SyntaxError */}
                {results.error && (
                  <div className={styles.errorBlock}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
                      <AlertCircle size={16} />
                      Execution Error
                    </div>
                    {results.error}
                  </div>
                )}

                {/* Test case list */}
                {results.results && (
                  <>
                    <div className={styles.summary}>
                      <div>
                        <div className={styles.summaryTitle}>
                          {passedCases === totalCases ? (
                            <span style={{ color: 'var(--success)' }}>All Test Cases Passed! 🎉</span>
                          ) : (
                            <span>{passedCases} / {totalCases} Test Cases Passed</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Score: {passRate}%
                        </div>
                      </div>
                      <div className={styles.progressBarBg}>
                        <div
                          className={styles.progressBarFill}
                          style={{
                            width: `${passRate}%`,
                            backgroundColor: passRate === 100 ? 'var(--success)' : 'var(--warning)',
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.testCasesList}>
                      {validEvaluated.map((tc, index) => {
                        const isExpanded = expandedTcs.has(tc.id);
                        
                        return (
                          <div key={tc.id} className={styles.tcItem}>
                            <div className={styles.tcHeader} onClick={() => toggleExpand(tc.id)}>
                              <div className={styles.tcTitle}>
                                {tc.isCorrect ? (
                                  <CheckCircle size={16} className={styles.tcPassed} />
                                ) : (
                                  <AlertCircle size={16} className={styles.tcFailed} />
                                )}
                                <span>
                                  Test Case {index + 1} {tc.isHidden && '(Hidden)'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className={styles.tcTime}>{tc.duration}ms</span>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className={styles.tcDetails}>
                                {tc.isHidden ? (
                                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    This is a hidden test case. Inputs and outputs are kept confidential.
                                  </div>
                                ) : (
                                  <>
                                    <div className={styles.codeParam}>
                                      <span className={styles.codeParamLabel}>Input Arguments:</span>
                                      <div className={styles.codeValue}>
                                        {tc.input.map((arg, idx) => (
                                          <div key={idx} style={{ marginBottom: idx < tc.input.length - 1 ? '4px' : 0 }}>
                                            {typeof arg === 'object' ? JSON.stringify(arg) : String(arg)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className={styles.codeParam}>
                                      <span className={styles.codeParamLabel}>Expected Output:</span>
                                      <div className={`${styles.codeValue} ${styles.codeValueMatch}`}>
                                        {typeof tc.expectedOutput === 'object'
                                          ? JSON.stringify(tc.expectedOutput)
                                          : String(tc.expectedOutput)}
                                      </div>
                                    </div>

                                    <div className={styles.codeParam}>
                                      <span className={styles.codeParamLabel}>Your Output:</span>
                                      <div
                                        className={`${styles.codeValue} ${
                                          tc.isCorrect ? styles.codeValueMatch : styles.codeValueMismatch
                                        }`}
                                      >
                                        {tc.error ? (
                                          <div style={{ color: 'var(--error)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', lineHeight: '1.4' }}>
                                            {tc.error}
                                          </div>
                                        ) : typeof tc.output === 'object' ? (
                                          JSON.stringify(tc.output)
                                        ) : (
                                          String(tc.output)
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONSOLE LOGS */}
        {activeTab === 'console' && (
          <div className={styles.terminalOutput}>
            {results?.logs && results.logs.length > 0 ? (
              results.logs.map((log, idx) => (
                <div key={idx} className={styles.terminalLine}>
                  {log}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No console statements outputted during execution. (Use console.log() in JavaScript or print() in Python)
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CUSTOM INPUT */}
        {activeTab === 'custom' && (
          <div className={styles.customInputWrapper}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Provide input parameters. Enter each parameter on a new line (e.g. arrays as <code style={{color:'var(--accent-primary)'}}>[1, 2, 3]</code>, numbers as <code style={{color:'var(--accent-primary)'}}>6</code>):
            </div>
            
            <textarea
              className={styles.customTextarea}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={`[1, 2, 3]\n6`}
            />

            {customInputErr && <div className={styles.errorBlock} style={{ margin: 0 }}>{customInputErr}</div>}
            {customError && <div className={styles.errorBlock} style={{ margin: 0 }}>Runtime Error: {customError}</div>}

            <div className={styles.customActions}>
              <button
                className={`${styles.customTextarea ? styles.tcPassed : ''}`}
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onClick={handleRunCustom}
                disabled={isCustomRunning}
              >
                <Play size={14} className={isCustomRunning ? 'spin' : ''} />
                Run Custom Test
              </button>
              
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={12} /> Format: One parameter per line
              </span>
            </div>

            {customResult && (
              <div className={styles.customResult}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Execution Result:
                </div>
                <div className={styles.tcDetails} style={{ padding: 0, border: 'none', background: 'transparent' }}>
                  <div className={styles.codeParam}>
                    <span className={styles.codeParamLabel}>Output:</span>
                    <div className={styles.codeValue} style={{ borderColor: 'var(--border-focus)' }}>
                      {customResult.error ? (
                        <div style={{ color: 'var(--error)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', lineHeight: '1.4' }}>
                          {customResult.error}
                        </div>
                      ) : typeof customResult.output === 'object' ? (
                        JSON.stringify(customResult.output)
                      ) : (
                        String(customResult.output)
                      )}
                    </div>
                  </div>
                  <div className={styles.codeParam}>
                    <span className={styles.codeParamLabel}>Execution Duration:</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {customResult.duration}ms
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default OutputConsole;
