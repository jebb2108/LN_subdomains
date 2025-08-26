// Объявляем переменные для DOM-элементов (без инициализации)
let userIdElement;
let wordsListElement;
let notificationElement;
let loadingOverlay;
let wordsLoading;
let bookmarksHint;

// Переменные состояния
let currentUserId = null;

// Базовый URL API
const API_BASE_URL = 'https://dict.lllang.site';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем DOM-элементы после загрузки страницы
    userIdElement = document.getElementById('userId');
    wordsListElement = document.getElementById('wordsList');
    notificationElement = document.getElementById('notification');
    loadingOverlay = document.getElementById('loadingOverlay');
    wordsLoading = document.getElementById('wordsLoading');
    bookmarksHint = document.querySelector('.bookmarks-hint');

    // 1. Проверка инициализации Telegram WebApp
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();

        const initData = Telegram.WebApp.initDataUnsafe;
        if (initData && initData.user && initData.user.id) {
            currentUserId = initData.user.id.toString();
            if (userIdElement) userIdElement.textContent = currentUserId;
        }
    }

    // 2. Получаем параметры URL (резервный способ)
    if (!currentUserId) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        if (urlUserId) {
            currentUserId = urlUserId;
            if (userIdElement) userIdElement.textContent = currentUserId;
        }
    }

    // 3. Обработка отсутствия user_id
    if (!currentUserId) {
        showNotification('Ошибка: Не указан ID пользователя', 'error');
        if (userIdElement) userIdElement.textContent = 'не определен';
        return;
    }

    // Делегирование для удаления
    if (wordsListElement) {
        wordsListElement.addEventListener('click', function(event) {
            const btn = event.target.closest('.delete-btn');
            if (!btn) return;
            const wordId = btn.getAttribute('data-id');
            deleteWord(wordId);
        });
    }

    // Настройка закладок
    setupBookmarks();

    // Назначаем обработчики кнопок
    document.getElementById('addWordBtn')?.addEventListener('click', addWord);
    document.getElementById('searchBtn')?.addEventListener('click', findTranslation);
    document.getElementById('refreshWordsBtn')?.addEventListener('click', loadWords);

    // Обработчик для подсказки закладок
    if (bookmarksHint) {
        bookmarksHint.addEventListener('click', function() {
            this.style.display = 'none';
        });
    }

    // Загружаем слова при открытии страницы
    loadWords();
});

// Настройка закладок
function setupBookmarks() {
    const bookmarks = document.querySelectorAll('.bookmark');
    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', function() {
            bookmarks.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });

            const pageId = this.getAttribute('data-page');
            const pageElement = document.getElementById(pageId);
            if (pageElement) {
                pageElement.classList.add('active');
            }

            if (pageId === 'all-words') {
                loadWords();
            }
            if (pageId === 'statistics') {
                loadStatistics();
            }
        });
    });
}

// Загрузка слов пользователя
async function loadWords() {
    if (!currentUserId) {
        showNotification('ID пользователя не определен', 'error');
        return;
    }

    try {
        // Показываем индикатор загрузки
        if (wordsLoading) wordsLoading.style.display = 'flex';
        if (wordsListElement) wordsListElement.innerHTML = '';

        // Добавляем timestamp для избежания кэширования
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE_URL}/api/words?user_id=${currentUserId}&_=${timestamp}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();
        const words = Array.isArray(data) ? data : [];

        if (!wordsListElement) return;

        if (words.length === 0) {
            wordsListElement.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px;">Словарь пуст. Начните добавлять слова!</td></tr>';
        } else {
            words.forEach(word => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHTML(word.word)}</td>
                    <td>${escapeHTML(getPartOfSpeechName(word.part_of_speech))}</td>
                    <td>${escapeHTML(word.translation)}</td>
                    <td class="actions">
                        <button class="delete-btn" data-id="${escapeHTML(word.id.toString())}">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </td>
                `;
                wordsListElement.appendChild(row);
            });
        }

    } catch (error) {
        console.error('Ошибка загрузки слов:', error);
        showNotification('Ошибка загрузки слов. Проверьте консоль для подробностей.', 'error');
    } finally {
        if (wordsLoading) wordsLoading.style.display = 'none';
    }
}

// Загрузка статистики
async function loadStatistics() {
    if (!currentUserId) return;

    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/stats?user_id=${currentUserId}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const stats = await response.json();
        statsContent.innerHTML = `
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; min-width: 120px;">
                    <div style="font-size: 2rem; color: #2e7d32; font-weight: bold;">${escapeHTML(String(stats.total_words || 0))}</div>
                    <div>Всего слов</div>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; min-width: 120px;">
                    <div style="font-size: 2rem; color: #2e7d32; font-weight: bold;">${escapeHTML(String(stats.nouns || 0))}</div>
                    <div>Существительных</div>
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; min-width: 120px;">
                    <div style="font-size: 2rem; color: #2e7d32; font-weight: bold;">${escapeHTML(String(stats.verbs || 0))}</div>
                    <div>Глаголов</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        statsContent.innerHTML = '<div style="color: red;">Ошибка загрузки статистики</div>';
    }
}

// Добавление нового слова
async function addWord() {
    const wordInput = document.getElementById('newWord');
    const translationInput = document.getElementById('translation');

    if (!wordInput || !translationInput) return;

    const word = wordInput.value.trim().toLowerCase();
    const partOfSpeech = document.getElementById('partOfSpeech').value;
    const translation = translationInput.value.trim();

    if (!word || !translation) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }

    if (!currentUserId) {
        showNotification('Ошибка: Не указан ID пользователя', 'error');
        return;
    }

    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const response = await fetch(`${API_BASE_URL}/api/words`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUserId,
                word: word,
                part_of_speech: partOfSpeech,
                translation: translation
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Ошибка сервера');
        }

        wordInput.value = '';
        translationInput.value = '';
        showNotification(`Слово "${escapeHTML(word)}" добавлено в словарь!`, 'success');

        // Обновляем данные на активных страницах
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'all-words') {
            await loadWords();
        }
        if (document.getElementById('statistics')?.classList.contains('active')) {
            await loadStatistics();
        }
    } catch (error) {
        console.error('Ошибка добавления слова:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// Поиск перевода
async function findTranslation() {
    const searchWordInput = document.getElementById('searchWord');
    if (!searchWordInput) return;

    const word = searchWordInput.value.trim().toLowerCase();
    if (!word) {
        showNotification('Введите слово для поиска', 'error');
        return;
    }

    if (!currentUserId) {
        showNotification('Ошибка: Не указан ID пользователя', 'error');
        return;
    }

    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const response = await fetch(
             `${API_BASE_URL}/api/words/search?user_id=${currentUserId}&word=${encodeURIComponent(word)}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const result = await response.json();
        const searchResult = document.getElementById('searchResult');

        if (!searchResult) return;

        if (result && result.word) {
            document.getElementById('resultWord').textContent = result.word;
            document.getElementById('resultPos').textContent = getPartOfSpeechName(result.part_of_speech);
            document.getElementById('resultTranslation').textContent = result.translation;
            searchResult.style.display = 'block';
        } else {
            document.getElementById('resultWord').textContent = word;
            document.getElementById('resultPos').textContent = 'не найдено';
            document.getElementById('resultTranslation').textContent = 'Слово не найдено в словаре';
            searchResult.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка поиска слова:', error);
        showNotification('Ошибка при поиске слова', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// Удаление слова
async function deleteWord(wordId) {
    if (!confirm('Вы уверены, что хотите удалить это слово?')) return;

    if (!currentUserId || !wordId) {
        showNotification('Ошибка: Не указан ID пользователя или слова', 'error');
        return;
    }

    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const response = await fetch(`${API_BASE_URL}/api/words/${wordId}?user_id=${currentUserId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        showNotification('Слово успешно удалено', 'success');

        // Обновляем только активные страницы
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'all-words') {
            await loadWords();
        }
        if (document.getElementById('statistics')?.classList.contains('active')) {
            await loadStatistics();
        }
    } catch (error) {
        console.error('Ошибка удаления слова:', error);
        showNotification('Ошибка при удалении слова', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// Вспомогательные функции
function getPartOfSpeechName(code) {
    const names = {
        'noun': 'Существительное',
        'verb': 'Глагол',
        'adjective': 'Прилагательное',
        'adverb': 'Наречие',
        'other': 'Другое'
    };
    return names[code] || code;
}

function showNotification(message, type) {
    if (!notificationElement) return;

    notificationElement.textContent = message;
    notificationElement.className = `notification ${type} show`;
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}