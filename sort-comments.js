/**
 * 目的のHTML要素が出現するまで待機し、ボタン追加等の初期化処理を呼び出す。
 */
function initializeSortButton() {
    const targetSelector = 'dl.filter-nav';

    const observer = setInterval(() => {
        const targetElement = document.querySelector(targetSelector);

        if (targetElement) {
            clearInterval(observer);
            addSortToggleButtonAndExpand(targetElement);
        }
    }, 500);
}

/**
 * ページ上にソートボタンを追加し、コメントを展開し、ソート機能を設定する。
 * @param {HTMLElement} filterNav - ボタンを追加する親要素 (dl.filter-nav)
 */
function addSortToggleButtonAndExpand(filterNav) {
    if (document.getElementById('sort-toggle-button')) {
        return;
    }

    const commentList = document.querySelector('ul.comment-list__items');
    if (!commentList) return;

    const expandButton = document.querySelector('button[aria-label="過去のコメントを展開"]');
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

    const sortToggleButton = document.getElementById('sort-toggle-button');

    const getTimestamp = (item) => {
        const timeElement = item.querySelector('.user-icon-set__sub-line a');
        return timeElement ? new Date(timeElement.textContent.trim()).getTime() : 0;
    };

    // **現在のコメントの並び順をDOMから自動で判別する**
    let currentSortOrder = 'desc'; // デフォルトは降順（新しい順）
    const initialComments = Array.from(commentList.querySelectorAll('li.comment-item'));
    if (initialComments.length >= 2) {
        const firstCommentTime = getTimestamp(initialComments[0]);
        const lastCommentTime = getTimestamp(initialComments[initialComments.length - 1]);
        // **最初のコメントが最後のコメントより古い場合、初期状態は昇順（古い順）と判断**
        if (firstCommentTime < lastCommentTime) {
            currentSortOrder = 'asc';
        }
    }
    console.log('現在のコメントの並び順を「' + currentSortOrder + '」と判断しました。');

    sortToggleButton.addEventListener('click', () => {
        const commentItems = Array.from(commentList.querySelectorAll('li.comment-item'));
        currentSortOrder = (currentSortOrder === 'desc') ? 'asc' : 'desc';

        commentItems.sort((a, b) => {
            const timeA = getTimestamp(a);
            const timeB = getTimestamp(b);
            return (currentSortOrder === 'asc') ? (timeA - timeB) : (timeB - timeA);
        });

        commentItems.forEach(item => commentList.appendChild(item));

        const buttonText = sortToggleButton.querySelector('.filter-nav__text');
        if (currentSortOrder === 'asc') {
            buttonText.textContent = '古い順で表示';
            sortToggleButton.setAttribute('aria-pressed', 'true');
        } else {
            buttonText.textContent = '新しい順で表示';
            sortToggleButton.setAttribute('aria-pressed', 'false');
        }
    });
}

// 初期化関数を実行
initializeSortButton();