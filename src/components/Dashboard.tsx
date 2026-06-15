import React from 'react';
import type { Challenge, Section } from '../services/supabase';
import { Award, CheckCircle, FolderLock, Sparkles, PlayCircle } from 'lucide-react';
import styles from './Dashboard.module.css';

interface DashboardProps {
  challenges: Challenge[];
  sections: Section[];
  solvedIds: string[];
  completionDetails: { challenge_id: string; section_id?: string; score?: number }[];
  userId: string;
  onSelectSection: (sectionId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  sections,
  solvedIds,
  completionDetails,
  userId,
  onSelectSection,
}) => {
  const totalSections = sections.length;
  const totalSolvedQuestions = solvedIds.length;

  // Calculate completed sections strictly matching section ID
  const completedSections = sections.filter((s) => {
    const solvedInThisSect = s.challenge_ids.filter((cid) => 
      completionDetails.some((d) => d.challenge_id === cid && d.section_id === s.id)
    ).length;
    const testSubmittedKey = `deveval_test_submitted_${userId}_${s.id}`;
    const testDisqualifiedKey = `deveval_test_disqualified_${userId}_${s.id}`;
    const testTimeupKey = `deveval_test_timeup_${userId}_${s.id}`;
    
    return solvedInThisSect >= s.required_count ||
      localStorage.getItem(testSubmittedKey) === 'true' ||
      localStorage.getItem(testDisqualifiedKey) === 'true' ||
      localStorage.getItem(testTimeupKey) === 'true';
  });

  const completedCount = completedSections.length;
  const sectionSolveRate = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div className={`${styles.dashboard} animate-fade-in`}>
      {/* Top Banner */}
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeContent}>
          <h1 className={styles.welcomeTitle}>DevEval Assessments</h1>
          <p className={styles.welcomeText}>
            Select a practice section or assessment below. Complete the required questions quota to clear each module.
          </p>
        </div>
      </div>

      {/* Main Scorecards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--accent-primary)' }}>
            <FolderLock size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>
              {completedCount} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/ {totalSections}</span>
            </span>
            <span className={styles.statLabel}>Modules Cleared</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--success)' }}>
            <CheckCircle size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{totalSolvedQuestions}</span>
            <span className={styles.statLabel}>Total Solutions Saved</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--accent-secondary)' }}>
            <Award size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{sectionSolveRate}%</span>
            <span className={styles.statLabel}>Module Accuracy</span>
          </div>
        </div>
      </div>

      {/* Sections Cards Grid Layout */}
      <h2 className={styles.sectionTitle}>
        <PlayCircle size={20} style={{ color: 'var(--accent-primary)' }} />
        Active Testing Sections
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {sections.map((section) => {
          // Calculate completions for this section strictly by matching section ID
          const solvedInThisSect = section.challenge_ids.filter((cid) => 
            completionDetails.some((d) => d.challenge_id === cid && d.section_id === section.id)
          ).length;
          const required = section.required_count;
          const pct = Math.min(Math.round((solvedInThisSect / required) * 100), 100);
          
          const testSubmittedKey = `deveval_test_submitted_${userId}_${section.id}`;
          const testDisqualifiedKey = `deveval_test_disqualified_${userId}_${section.id}`;
          const testTimeupKey = `deveval_test_timeup_${userId}_${section.id}`;
          
          const isCompleted = solvedInThisSect >= required ||
            localStorage.getItem(testSubmittedKey) === 'true' ||
            localStorage.getItem(testDisqualifiedKey) === 'true' ||
            localStorage.getItem(testTimeupKey) === 'true';

          return (
            <div
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              style={{
                background: 'var(--bg-secondary)',
                border: isCompleted ? '1px solid var(--success)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
                boxShadow: isCompleted ? '0 0 10px rgba(16, 185, 129, 0.05)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = isCompleted ? 'var(--success)' : 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = isCompleted ? 'var(--success)' : 'var(--border-color)';
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {section.name}
                </h3>
                {isCompleted ? (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: 'var(--success)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Completed 🎉
                  </span>
                ) : (
                  section.randomize && (
                    <span
                      style={{
                        background: 'var(--accent-primary-glow)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Assigned questions are shuffled uniquely for you"
                    >
                      <Sparkles size={10} />
                      Randomized
                    </span>
                  )
                )}
              </div>

              {/* Progress and status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Required Quota</span>
                  <span style={{ fontWeight: 'bold', color: isCompleted ? 'var(--success)' : 'var(--text-primary)' }}>
                    {solvedInThisSect} / {required} solved
                  </span>
                </div>
                
                <div className={styles.distProgressBg}>
                  <div
                    className={styles.distProgressFill}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isCompleted ? 'var(--success)' : 'var(--accent-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Footer details */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px',
                  marginTop: '4px',
                }}
              >
                <span>
                  Pool size:{' '}
                  {section.given_count && section.given_count > 0 && section.given_count < section.challenge_ids.length
                    ? `${section.given_count} problems (drawn from ${section.challenge_ids.length})`
                    : `${section.challenge_ids.length} problems`}
                </span>
                <span>Category: Practice Module</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default Dashboard;
