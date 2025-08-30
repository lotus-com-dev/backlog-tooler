import React, { useState, useCallback, useImperativeHandle } from 'react';
import type { SortToggleButtonRef, SortToggleButtonProps } from '@/ui/components/sort-toggle-button/types';
import '@/ui/components/sort-toggle-button/styles.css';

export const SortToggleButton = React.forwardRef<SortToggleButtonRef, SortToggleButtonProps>(
  ({ onToggle, initialSortOrder }, ref) => {
    const [isAscending, setIsAscending] = useState(initialSortOrder);

    const handleToggle = useCallback(() => {
      onToggle();
    }, [onToggle]);

    useImperativeHandle(ref, () => ({
      updateSortOrder: (newIsAscending: boolean) => {
        setIsAscending(newIsAscending);
      }
    }), []);

    return (
      <div className="sort-toggle-container">
        <div className="sort-toggle-wrapper">
          <label className="sort-toggle-switch">
            <input
              type="checkbox"
              checked={!isAscending}
              onChange={handleToggle}
              className="sort-toggle-input"
            />
            <span className="sort-toggle-slider">
              <span className="sort-toggle-option sort-toggle-option--left">古い順</span>
              <span className="sort-toggle-option sort-toggle-option--right">新しい順</span>
            </span>
          </label>
        </div>
      </div>
    );
  }
);

SortToggleButton.displayName = 'SortToggleButton';