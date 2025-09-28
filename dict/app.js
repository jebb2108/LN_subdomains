// ====== app.js ======

// DOM references (initialized on DOMContentLoaded)
let userIdElement;
let wordsListElement;
let notificationElement;
let loadingOverlay;
let wordsLoading;
let bookmarksHint;

// state
let currentUserId = null;

// API base — используем origin текущей страницы (чтобы не было CORS проблем при том же хосте)
const API_BASE_URL = window.location.origin || 'https://dict.lllang.site';

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // 🔍 === БЫСТРАЯ ДИАГНОСТИКА - НАЧАЛО ===
    console.log('🚀 Страница загружена, начинаем диагностику...');
    
    // Создаем элементы диагностики, если их нет
    if (!document.getElementById('debugPanel')) {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = 'display: none; position: fixed; top: 10px; right: 10px; width: 400px; height: 300px; background: rgba(0,0,0,0.9); color: #00ff00; overflow: auto; z-index: 10000; font-size: 12px; padding: 10px; border-radius: 8px; border: 1px solid #00ff00; font-family: monospace;';
        document.body.appendChild(debugPanel);
    }
    
    if (!document.getElementById('toggleDebug')) {
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggleDebug';
        toggleButton.textContent = 'DEBUG';
        toggleButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10001; background: #ff4444; color: white; border: none; padding: 10px 15px; border-radius: 5px; font-weight: bold; cursor: pointer;';
        document.body.appendChild(toggleButton);
    }
    
    const debugPanel = document.getElementById('debugPanel');
    const toggleButton = document.getElementById('toggleDebug');
    const logs = [];
    
    // Функция для добавления лога в панель
    function addLog(level, args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        logs.push(logEntry);
        
        if (debugPanel) {
            // Показываем только последние 50 сообщений
            const recentLogs = logs.slice(-50);
            debugPanel.innerHTML = recentLogs.join('<br>');
            debugPanel.scrollTop = debugPanel.scrollHeight;
        }
        
        // Также сохраняем в localStorage для последующего анализа
        try {
            localStorage.setItem('last_debug_logs', JSON.stringify(logs.slice(-100)));
        } catch (e) {
            // Игнорируем ошибки localStorage
        }
    }
    
    // Перехватываем console методы
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    
    console.log = function(...args) {
        originalConsole.log.apply(console, args);
        addLog('LOG', args);
    };
    
    console.error = function(...args) {
        originalConsole.error.apply(console, args);
        addLog('ERROR', args);
    };
    
    console.warn = function(...args) {
        originalConsole.warn.apply(console, args);
        addLog('WARN', args);
    };
    
    console.info = function(...args) {
        originalConsole.info.apply(console, args);
        addLog('INFO', args);
    };
    
    // Обработчик кнопки debug
    toggleButton.addEventListener('click', () => {
        if (debugPanel.style.display === 'none') {
            debugPanel.style.display = 'block';
            toggleButton.textContent = 'HIDE DEBUG';
            toggleButton.style.background = '#44ff44';
        } else {
            debugPanel.style.display = 'none';
            toggleButton.textContent = 'DEBUG';
            toggleButton.style.background = '#ff4444';
        }
    });
    
    // Логируем ключевую информацию о Telegram WebApp
    console.log('=== TELEGRAM WEBAPP DIAGNOSTICS ===');
    console.log('Window location:', window.location.href);
    console.log('User agent:', navigator.userAgent);
    
    if (typeof Telegram === 'undefined') {
        console.error('❌ Telegram object is UNDEFINED');
        console.error('Приложение открыто не в Telegram или WebApp не загрузился');
    } else {
        console.log('✅ Telegram object is available');
        
        if (!Telegram.WebApp) {
            console.error('❌ Telegram.WebApp is UNDEFINED');
        } else {
            console.log('✅ Telegram.WebApp is available');
            const tg = Telegram.WebApp;
            
            // Инициализируем WebApp
            try {
                tg.ready();
                tg.expand();
                console.log('✅ WebApp инициализирован');
            } catch (e) {
                console.error('❌ Ошибка инициализации WebApp:', e);
            }
            
            console.log('📊 WebApp version:', tg.version);
            console.log('📱 Platform:', tg.platform);
            console.log('🎨 Theme params:', tg.themeParams);
            console.log('🔗 initData:', tg.initData);
            console.log('👤 initDataUnsafe:', tg.initDataUnsafe);
            console.log('🆔 User object:', tg.initDataUnsafe?.user);
            console.log('🔍 User ID:', tg.initDataUnsafe?.user?.id);
            
            if (tg.initDataUnsafe?.user?.id) {
                console.log('✅ USER ID НАЙДЕН:', tg.initDataUnsafe.user.id);
            } else {
                console.error('❌ USER ID НЕ НАЙДЕН в initDataUnsafe.user');
                console.log('💡 Проверьте:');
                console.log('   - Открыт ли Mini App через бота');
                console.log('   - Нажата ли кнопка START в боте');
                console.log('   - Авторизован ли пользователь');
            }
        }
    }
    
    console.log('=== ДИАГНОСТИКА ЗАВЕРШЕНА ===');

    // 🔄 ФУНКЦИЯ ДЛЯ НАСТРОЙКИ ОСТАЛЬНЫХ СЛУШАТЕЛЕЙ СОБЫТИЙ
    function setupEventListeners() {
        // Делегирование удаления
        if (wordsListElement) {
            wordsListElement.addEventListener('click', (event) => {
                const btn = event.target.closest('.delete-btn');
                if (!btn) return;
                const wordId = btn.getAttribute('data-id');
                deleteWord(wordId);
            });
        }

        setupBookmarks();

        document.getElementById('addWordBtn')?.addEventListener('click', addWord);
        document.getElementById('searchBtn')?.addEventListener('click', findTranslation);
        document.getElementById('refreshWordsBtn')?.addEventListener('click', loadWords);

        if (bookmarksHint) {
            bookmarksHint.addEventListener('click', function() { 
                this.style.display = 'none'; 
            });
        }
    }

    // 🔄 ФУНКЦИЯ ОБНОВЛЕНИЯ URL
    function updateUrlWithUserId(userId) {
        try {
            const url = new URL(window.location);
            
            // Устанавливаем параметр user_id
            url.searchParams.set('user_id', userId);
            
            // Меняем URL без перезагрузки страницы
            window.history.replaceState({}, '', url.toString());
            console.log('🔗 URL обновлен с user_id:', url.toString());
        } catch (e) {
            console.warn('Не удалось обновить URL:', e);
        }
    }

    // 🔄 ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ
    function initializeApp() {
        let userId = null;

        // 1. Пробуем получить user_id из Telegram WebApp
        userId = initializeTelegramWebApp();

        // 2. Если не получилось, проверяем URL параметры
        if (!userId) {
            const urlParams = new URLSearchParams(window.location.search);
            userId = urlParams.get('user_id');
            
            if (userId) {
                userId = String(userId);
                console.log('✅ user_id получен из URL:', userId);
            }
        }

        // 3. Если нашли user_id, устанавливаем его
        if (userId) {
            currentUserId = userId;
            if (userIdElement) {
                userIdElement.textContent = currentUserId;
            }
            
            // Обновляем URL с полученным user_id
            updateUrlWithUserId(currentUserId);
            console.log('🎉 Текущий user_id:', currentUserId);
            
            // Загружаем данные
            loadWords();
            loadStatistics();
        } else {
            // 4. Если user_id не найден
            console.error('❌ Не удалось определить user_id');
            showNotification('Ошибка: Не указан user_id', 'error');
            if (userIdElement) {
                userIdElement.textContent = 'не определен';
            }
        }

        // Инициализируем остальные компоненты
        setupEventListeners();
    }

    // Запускаем инициализацию
    initializeApp();
});

// --- Navigation bookmarks ---
function setupBookmarks() {
    const bookmarks = document.querySelectorAll('.bookmark');
    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', function() {
            bookmarks.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            const pageId = this.getAttribute('data-page');
            const pageElement = document.getElementById(pageId);
            if (pageElement) pageElement.classList.add('active');

            if (pageId === 'all-words') loadWords();
            if (pageId === 'statistics') loadStatistics();
        });
    });
}

// --- Helpers ---
function showNotification(message, type='success') {
    if (!notificationElement) return;
    notificationElement.textContent = message;
    notificationElement.className = `notification ${type} show`;
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 3500);
}

function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isSameOrigin(url) {
    try {
        const u = new URL(url, window.location.href);
        return u.origin === window.location.origin;
    } catch (e) {
        return false;
    }
}

// --- Load words ---
async function loadWords() {
    if (!currentUserId) {
        showNotification('user_id не определен', 'error');
        return;
    }

    console.info('loadWords: user_id=', currentUserId);
    if (wordsLoading) wordsLoading.style.display = 'flex';
    if (wordsListElement) wordsListElement.innerHTML = '';

    const url = `${API_BASE_URL}/api/words?user_id=${encodeURIComponent(currentUserId)}&_=${Date.now()}`;
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            // include credentials only if same origin
            credentials: isSameOrigin(API_BASE_URL) ? 'include' : 'omit'
        });

        console.info('loadWords: status', response.status);
        const text = await response.text();
        if (!response.ok) {
            console.error('loadWords: server responded with error', response.status, text);
            throw new Error(`Ошибка сервера (${response.status})`);
        }

        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error('Неверный формат JSON от сервера'); }

        console.debug('loadWords: data', data);
        const words = Array.isArray(data) ? data : [];

        if (!wordsListElement) {
            console.warn('loadWords: element with id="wordsList" not found in DOM');
            return;
        }

        if (words.length === 0) {
            wordsListElement.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Словарь пуст. Начните добавлять слова!</td></tr>';
            return;
        }

        // build rows
        const fragment = document.createDocumentFragment();
        words.forEach(item => {
            const id = item?.id ?? '';
            const w = item?.word ?? '';
            const pos = item?.part_of_speech ?? '';
            const trn = item?.translation ?? '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHTML(w)}</td>
                <td>${escapeHTML(getPartOfSpeechName(pos))}</td>
                <td>${escapeHTML(trn)}</td>
                <td class="actions">
                    <button class="delete-btn" data-id="${escapeHTML(String(id))}">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </td>
            `;
            fragment.appendChild(row);
        });

        wordsListElement.appendChild(fragment);

    } catch (err) {
        console.error('loadWords error:', err);
        showNotification('Ошибка загрузки слов. Проверьте консоль.', 'error');
    } finally {
        if (wordsLoading) wordsLoading.style.display = 'none';
    }
}

// --- Load statistics ---
async function loadStatistics() {
    if (!currentUserId) return;
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;

    const url = `${API_BASE_URL}/api/stats?user_id=${encodeURIComponent(currentUserId)}&_=${Date.now()}`;
    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: isSameOrigin(API_BASE_URL) ? 'include' : 'omit' });
        if (!response.ok) {
            const txt = await response.text().catch(()=>'');
            throw new Error(`Ошибка HTTP: ${response.status} ${txt}`);
        }
        const stats = await response.json();
        statsContent.innerHTML = `
            <div style="display:flex; gap:20px; justify-content:center; flex-wrap:wrap; margin-top:20px;">
                <div style="background:#e8f5e9; padding:15px; border-radius:10px; min-width:120px;">
                    <div style="font-size:2rem; color:#2e7d32; font-weight:bold;">${escapeHTML(String(stats.total_words ?? 0))}</div>
                    <div>Всего слов</div>
                </div>
                <div style="background:#e8f5e9; padding:15px; border-radius:10px; min-width:120px;">
                    <div style="font-size:2rem; color:#2e7d32; font-weight:bold;">${escapeHTML(String(stats.nouns ?? 0))}</div>
                    <div>Существительных</div>
                </div>
                <div style="background:#e8f5e9; padding:15px; border-radius:10px; min-width:120px;">
                    <div style="font-size:2rem; color:#2e7d32; font-weight:bold;">${escapeHTML(String(stats.verbs ?? 0))}</div>
                    <div>Глаголов</div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('loadStatistics error:', err);
        statsContent.innerHTML = '<div style="color:red;">Ошибка загрузки статистики</div>';
    }
}

// --- Add word ---
async function addWord() {
    const wordInput = document.getElementById('newWord');
    const translationInput = document.getElementById('translation');
    const posEl = document.getElementById('partOfSpeech');
    if (!wordInput || !translationInput || !posEl) return;

    const word = wordInput.value.trim();
    const translation = translationInput.value.trim();
    const partOfSpeech = posEl.value;

    if (!word || !translation) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }

    if (!currentUserId) {
        showNotification('Ошибка: Не указан user_id', 'error');
        return;
    }

    const payload = { user_id: currentUserId, word: word.toLowerCase(), part_of_speech: partOfSpeech, translation };
    const url = `${API_BASE_URL}/api/words`;

    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
            credentials: isSameOrigin(API_BASE_URL) ? 'include' : 'omit'
        });

        const text = await response.text().catch(()=>null);
        if (!response.ok) {
            console.error('addWord bad response', response.status, text);
            let msg = `Ошибка сервера (${response.status})`;
            try {
                const json = text ? JSON.parse(text) : null;
                if (json && (json.error || json.message)) msg = json.error || json.message;
            } catch (e) { if (text) msg = text; }
            throw new Error(msg);
        }

        // success
        wordInput.value = '';
        translationInput.value = '';
        showNotification(`Слово "${escapeHTML(word)}" добавлено!`, 'success');

        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'all-words') await loadWords();
        if (document.getElementById('statistics')?.classList.contains('active')) await loadStatistics();

    } catch (err) {
        console.error('addWord error:', err);
        showNotification(`Ошибка: ${err.message || err}`, 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Find translation ---
async function findTranslation() {
    const searchWordInput = document.getElementById('searchWord');
    if (!searchWordInput) return;

    const word = searchWordInput.value.trim();
    if (!word) { showNotification('Введите слово для поиска', 'error'); return; }
    if (!currentUserId) { showNotification('Ошибка: Не указан user_id', 'error'); return; }

    const url = `${API_BASE_URL}/api/words/search?user_id=${encodeURIComponent(currentUserId)}&word=${encodeURIComponent(word)}`;
    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        const response = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: isSameOrigin(API_BASE_URL) ? 'include' : 'omit' });

        const text = await response.text().catch(()=>null);
        if (!response.ok) {
            console.error('findTranslation bad response', response.status, text);
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const result = text ? JSON.parse(text) : null;
        const searchResult = document.getElementById('searchResult');
        if (!searchResult) return;

        if (result && result.word) {
            document.getElementById('resultWord').textContent = result.word;
            document.getElementById('resultPos').textContent = getPartOfSpeechName(result.part_of_speech);
            document.getElementById('resultTranslation').textContent = result.translation;
        } else {
            document.getElementById('resultWord').textContent = word;
            document.getElementById('resultPos').textContent = 'не найдено';
            document.getElementById('resultTranslation').textContent = 'Слово не найдено в словаре';
        }
        searchResult.style.display = 'block';

    } catch (err) {
        console.error('findTranslation error:', err);
        showNotification('Ошибка при поиске слова', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Delete word ---
async function deleteWord(wordId) {
    if (!wordId) { showNotification('Ошибка: не указан ID слова', 'error'); return; }
    if (!confirm('Вы уверены, что хотите удалить это слово?')) return;
    if (!currentUserId) { showNotification('Ошибка: Не указан user_id', 'error'); return; }

    const url = `${API_BASE_URL}/api/words/${encodeURIComponent(wordId)}?user_id=${encodeURIComponent(currentUserId)}`;
    try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        const response = await fetch(url, { method: 'DELETE', headers: { 'Accept': 'application/json' }, credentials: isSameOrigin(API_BASE_URL) ? 'include' : 'omit' });
        const text = await response.text().catch(()=>null);
        if (!response.ok) {
            console.error('deleteWord bad response', response.status, text);
            throw new Error(`Ошибка удаления (${response.status})`);
        }
        showNotification('Слово успешно удалено', 'success');
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'all-words') await loadWords();
        if (document.getElementById('statistics')?.classList.contains('active')) await loadStatistics();
    } catch (err) {
        console.error('deleteWord error:', err);
        showNotification('Ошибка при удалении слова', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Utilities ---
function getPartOfSpeechName(code) {
    const names = {
        'noun': 'Существительное',
        'verb': 'Глагол',
        'adjective': 'Прилагательное',
        'adverb': 'Наречие',
        'other': 'Другое'
    };
    return names[code] || code || '';
}