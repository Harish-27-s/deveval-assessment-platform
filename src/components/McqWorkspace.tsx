import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Challenge } from '../data/challenges';

interface McqWorkspaceProps {
  challenge: Challenge;
  selectedAnswer: string;
  onSaveAnswer: (answer: string) => void;
}

export const McqWorkspace: React.FC<McqWorkspaceProps> = ({
  challenge,
  selectedAnswer,
  onSaveAnswer,
}) => {
  const [localAnswer, setLocalAnswer] = useState(selectedAnswer);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setLocalAnswer(selectedAnswer);
  }, [selectedAnswer, challenge.id]);

  const handleSelectOption = (option: string) => {
    setLocalAnswer(option);
    setSaveStatus('saving');
    onSaveAnswer(option);
    setTimeout(() => {
      setSaveStatus('saved');
    }, 400);
  };

  const options = challenge.mcqOptions || [];

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Section: Warm-up MCQ
        </span>
        
        {saveStatus !== 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            {saveStatus === 'saving' ? (
              <>
                <span className="spin" style={{ width: '12px', height: '12px', border: '2px solid transparent', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--success)', fontWeight: 500 }}>Response Saved</span>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Question:
        </h3>
        
        <p 
          style={{ 
            fontSize: '1rem', 
            lineHeight: '1.6', 
            color: 'var(--text-primary)', 
            background: 'var(--bg-primary)', 
            padding: '16px', 
            borderRadius: 'var(--radius-sm)', 
            border: '1px solid var(--border-color)',
            marginBottom: '24px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {challenge.description}
        </p>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Select the correct option:
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {options.map((option, index) => {
            const isSelected = localAnswer === option;
            return (
              <div
                key={index}
                onClick={() => handleSelectOption(option)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  background: isSelected ? 'rgba(148, 163, 184, 0.08)' : 'var(--bg-primary)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {isSelected ? (
                    <CheckCircle2 size={20} style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>
                <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {option}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Selected Option: {localAnswer ? <strong>{localAnswer}</strong> : <em>None selected</em>}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          *Answers are automatically saved to prevent data loss.
        </span>
      </div>
    </div>
  );
};
export default McqWorkspace;
