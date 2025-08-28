interface CommentItem extends HTMLLIElement {
  querySelector(selector: '.user-icon-set__sub-line a'): HTMLAnchorElement | null;
}

type SortOrder = 'asc' | 'desc';

function initializeSortButton(): void {
  const targetSelector = 'dl.filter-nav';
  
  const observer = setInterval(() => {
    const targetElement = document.querySelector<HTMLDListElement>(targetSelector);
    
    if (targetElement) {
      clearInterval(observer);
      addSortToggleButtonAndExpand(targetElement);
    }
  }, 500);
}

function addSortToggleButtonAndExpand(filterNav: HTMLDListElement): void {
  if (document.getElementById('sort-toggle-button')) {
    return;
  }
  
  const commentList = document.querySelector<HTMLUListElement>('ul.comment-list__items');
  if (!commentList) return;
  
  const expandButton = document.querySelector<HTMLButtonElement>('button[aria-label="過去のコメントを展開"]');
  if (expandButton) {
    expandButton.click();
  }
  
  const newDd = document.createElement('dd');
  newDd.className = 'filter-nav__item';
  newDd.innerHTML = `
    <button type="button" class="filter-nav__link" id="sort-toggle-button" aria-pressed="false">
      <span class="filter-nav__text">古い順で表示</span>
    </button>
  `;
  filterNav.appendChild(newDd);
  
  const sortToggleButton = document.getElementById('sort-toggle-button') as HTMLButtonElement;
  
  const getTimestamp = (item: CommentItem): number => {
    const timeElement = item.querySelector('.user-icon-set__sub-line a');
    return timeElement ? new Date(timeElement.textContent?.trim() || '').getTime() : 0;
  };
  
  let currentSortOrder: SortOrder = 'desc';
  const initialComments = Array.from(commentList.querySelectorAll<CommentItem>('li.comment-item'));
  
  if (initialComments.length >= 2) {
    const firstCommentTime = getTimestamp(initialComments[0]);
    const lastCommentTime = getTimestamp(initialComments[initialComments.length - 1]);
    
    if (firstCommentTime < lastCommentTime) {
      currentSortOrder = 'asc';
    }
  }
  
  console.log(`現在のコメントの並び順を「${currentSortOrder}」と判断しました。`);
  
  sortToggleButton.addEventListener('click', () => {
    const commentItems = Array.from(commentList.querySelectorAll<CommentItem>('li.comment-item'));
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
    
    commentItems.sort((a, b) => {
      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);
      return currentSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });
    
    commentItems.forEach(item => commentList.appendChild(item));
    
    const buttonText = sortToggleButton.querySelector<HTMLSpanElement>('.filter-nav__text');
    if (buttonText) {
      if (currentSortOrder === 'asc') {
        buttonText.textContent = '古い順で表示';
        sortToggleButton.setAttribute('aria-pressed', 'true');
      } else {
        buttonText.textContent = '新しい順で表示';
        sortToggleButton.setAttribute('aria-pressed', 'false');
      }
    }
  });
}

initializeSortButton();