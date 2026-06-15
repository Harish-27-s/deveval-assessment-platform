import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './SplitPane.module.css';

interface SplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
  initialSize?: number; // percentage (0 - 100)
  minSize?: number; // percentage
  maxSize?: number; // percentage
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  leftPane,
  rightPane,
  direction = 'horizontal',
  initialSize = 50,
  minSize = 20,
  maxSize = 80,
}) => {
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      let newSize = 50;

      if (direction === 'horizontal') {
        const offset = e.clientX - containerRect.left;
        newSize = (offset / containerRect.width) * 100;
      } else {
        const offset = e.clientY - containerRect.top;
        newSize = (offset / containerRect.height) * 100;
      }

      // Constrain size
      if (newSize < minSize) newSize = minSize;
      if (newSize > maxSize) newSize = maxSize;

      setSize(newSize);
    },
    [isDragging, direction, minSize, maxSize]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    }

    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging, onDrag, stopDrag]);

  const isHorizontal = direction === 'horizontal';

  const containerClass = isHorizontal ? styles.container : styles.containerRow;
  const dividerClass = isHorizontal
    ? `${styles.divider} ${isDragging ? styles.dividerActive : ''}`
    : `${styles.dividerRow} ${isDragging ? styles.dividerRowActive : ''}`;

  const leftStyle: React.CSSProperties = isHorizontal
    ? { width: `${size}%` }
    : { height: `${size}%` };

  const rightStyle: React.CSSProperties = isHorizontal
    ? { width: `${100 - size}%` }
    : { height: `${100 - size}%` };

  return (
    <div ref={containerRef} className={containerClass}>
      <div className={isHorizontal ? styles.pane : styles.paneRow} style={leftStyle}>
        {leftPane}
      </div>
      <div className={dividerClass} onMouseDown={startDrag} />
      <div className={isHorizontal ? styles.pane : styles.paneRow} style={rightStyle}>
        {rightPane}
      </div>
    </div>
  );
};
export default SplitPane;
