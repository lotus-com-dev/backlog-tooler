export interface SortToggleButtonRef {
  updateSortOrder: (isAscending: boolean) => void;
}

export interface SortToggleButtonProps {
  onToggle: () => void;
  initialSortOrder: boolean;
}