import React, { useState } from 'react';
import type { Challenge } from '../data/challenges';
import { Search, Home, CheckCircle } from 'lucide-react';
import styles from './ChallengeList.module.css';

interface ChallengeListProps {
  challenges: Challenge[];
  solvedIds: string[];
  selectedId: string | null;
  onSelectChallenge: (id: string | null) => void;
}

export const ChallengeList: React.FC<ChallengeListProps> = ({
  challenges,
  solvedIds,
  selectedId,
  onSelectChallenge,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [part1Expanded, setPart1Expanded] = useState(true);
  const [part2Expanded, setPart2Expanded] = useState(true);

  const filtered = challenges.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Split challenges list dynamically into two parts
  const halfLength = Math.ceil(filtered.length / 2);
  const part1Challenges = filtered.slice(0, halfLength);
  const part2Challenges = filtered.slice(halfLength);

  const renderChallengeItem = (challenge: Challenge) => {
    const isSelected = challenge.id === selectedId;
    const isSolved = solvedIds.includes(challenge.id);
    const diffClass =
      challenge.difficulty === 'Easy'
        ? styles.diffEasy
        : challenge.difficulty === 'Medium'
        ? styles.diffMedium
        : challenge.difficulty === 'Hard'
        ? styles.diffHard
        : challenge.difficulty === 'Advanced'
        ? styles.diffAdvanced
        : styles.diffExpert;

    return (
      <div
        key={challenge.id}
        className={`${styles.item} ${isSelected ? styles.itemActive : ''}`}
        onClick={() => onSelectChallenge(challenge.id)}
      >
        <div className={styles.itemTop}>
          <span className={styles.itemTitle}>
            {challenge.title}
            {isSolved && (
              <CheckCircle size={14} className={styles.solvedCheck} fill="rgba(16, 185, 129, 0.15)" />
            )}
          </span>
        </div>
        <div className={styles.itemBottom}>
          <span className={styles.category}>{challenge.category}</span>
          <span className={`${styles.diffBadge} ${diffClass}`}>{challenge.difficulty}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <button className={styles.homeBtn} onClick={() => onSelectChallenge(null)}>
          <Home size={16} />
          <span>Dashboard</span>
        </button>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.list} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        {filtered.length > 0 ? (
          <>
            {/* Part 1 Group */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                onClick={() => setPart1Expanded(!part1Expanded)} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  cursor: 'pointer', 
                  padding: '10px 12px', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid var(--border-color)', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)',
                  userSelect: 'none'
                }}
              >
                <span>📂 Part 1: Initial ({part1Challenges.length})</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{part1Expanded ? '▼' : '►'}</span>
              </div>
              {part1Expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {part1Challenges.map(renderChallengeItem)}
                </div>
              )}
            </div>

            {/* Part 2 Group */}
            {part2Challenges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div 
                  onClick={() => setPart2Expanded(!part2Expanded)} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    padding: '10px 12px', 
                    background: 'var(--bg-tertiary)', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid var(--border-color)', 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    userSelect: 'none'
                  }}
                >
                  <span>📂 Part 2: Final ({part2Challenges.length})</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{part2Expanded ? '▼' : '►'}</span>
                </div>
                {part2Expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {part2Challenges.map(renderChallengeItem)}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>No problems found</div>
        )}
      </div>
    </div>
  );
};
export default ChallengeList;
