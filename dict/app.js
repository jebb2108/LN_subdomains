// DOM references (initialized on DOMContentLoaded)
let wordsListElement;
let notificationElement;
let loadingOverlay;
let wordsLoading;

// state
let currentUserId = null;
let isRecording = false;
let recognition = null;
let currentWords = [];
let currentCardIndex = 0;

// API base — используем origin текущей страницы (чтобы не было CORS проблем при том же хосте)
const API_BASE_URL = window.location.origin || 'https://dict.lllang.site';

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

// --- Load words ---
async function loadWords() {
    if (!currentUserId) {
        showNotification('user_id не определен', 'error');
        return;
    }

    console.info('loadWords: user_id=', currentUserId);
    if (wordsLoading) wordsLoading.style.display = 'flex';

    const url = `${API_BASE_URL}/api/words?user_id=${encodeURIComponent(currentUserId)}&_=${Date.now()}`;
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
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
        currentWords = Array.isArray(data) ? data : [];

        // Сортируем слова по алфавиту
        currentWords.sort((a, b) => {
            const wordA = (a.word || '').toLowerCase();
            const wordB = (b.word || '').toLowerCase();
            return wordA.localeCompare(wordB);
        });

        displayCurrentCard();

    } catch (err) {
        console.error('loadWords error:', err);
        showNotification('Ошибка загрузки слов. Проверьте консоль.', 'error');
    } finally {
        if (wordsLoading) wordsLoading.style.display = 'none';
    }
}

// --- Display current card ---
function displayCurrentCard() {
    const wordCard = document.getElementById('wordCard');
    const emptyState = document.getElementById('emptyState');
    const cardCounter = document.getElementById('cardCounter');
    const deleteCardBtn = document.getElementById('deleteCardBtn');
    
    console.log('Display current card, words count:', currentWords.length); // Для отладки
    
    if (currentWords.length === 0) {
        if (wordCard) wordCard.style.display = 'none';
        if (deleteCardBtn) deleteCardBtn.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (wordCard) wordCard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    const currentWord = currentWords[currentCardIndex];
    
    // Обновляем содержимое карточки
    const cardWordElement = document.getElementById('cardWord');
    const cardTranslationElement = document.getElementById('cardTranslation');
    const cardPosElement = document.getElementById('cardPos');
    
    if (cardWordElement) cardWordElement.textContent = currentWord.word || '';
    if (cardTranslationElement) cardTranslationElement.textContent = currentWord.translation || '';
    if (cardPosElement) cardPosElement.textContent = getPartOfSpeechName(currentWord.part_of_speech || '');
    
    // Устанавливаем ID слова для кнопки удаления и показываем ее
    if (deleteCardBtn && currentWord.id) {
        deleteCardBtn.setAttribute('data-word-id', currentWord.id);
        deleteCardBtn.style.display = 'flex';
    }
    
    // Контекст
    const contextContainer = document.getElementById('cardContextContainer');
    const contextElement = document.getElementById('cardContext');
    if (currentWord.context && contextContainer && contextElement) {
        contextElement.textContent = currentWord.context;
        contextContainer.style.display = 'block';
    } else if (contextContainer) {
        contextContainer.style.display = 'none';
    }
    
    // Аудио
    const audioContainer = document.getElementById('cardAudioContainer');
    const audioBtn = document.getElementById('playAudioBtn');
    if (currentWord.audio_url && audioContainer && audioBtn) {
        audioBtn.onclick = () => playAudio(currentWord.audio_url);
        audioBtn.disabled = false;
        audioContainer.style.display = 'block';
    } else if (audioContainer) {
        audioContainer.style.display = 'none';
    }
    
    // Счетчик
    if (cardCounter) {
        cardCounter.textContent = `${currentCardIndex + 1} / ${currentWords.length}`;
    }
    
    // Обновляем состояние кнопок навигации
    const prevBtn = document.getElementById('prevWordBtn');
    const nextBtn = document.getElementById('nextWordBtn');
    if (prevBtn) prevBtn.disabled = currentCardIndex === 0;
    if (nextBtn) nextBtn.disabled = currentCardIndex === currentWords.length - 1;
    
    // Анимация появления
    if (wordCard) {
        wordCard.classList.remove('fade-out');
        wordCard.classList.add('fade-in');
    }
}

// --- Play audio ---
function playAudio(audioUrl) {
    const audioBtn = document.getElementById('playAudioBtn');
    const icon = audioBtn.querySelector('i');
    
    try {
        const audio = new Audio(audioUrl);
        audioBtn.disabled = true;
        icon.className = 'fas fa-volume-up';
        
        audio.play().then(() => {
            audio.onended = () => {
                audioBtn.disabled = false;
                icon.className = 'fas fa-play';
            };
        }).catch(error => {
            console.error('Error playing audio:', error);
            showNotification('Ошибка воспроизведения аудио', 'error');
            audioBtn.disabled = false;
            icon.className = 'fas fa-play';
        });
    } catch (error) {
        console.error('Error with audio:', error);
        showNotification('Ошибка с аудиофайлом', 'error');
        audioBtn.disabled = false;
        icon.className = 'fas fa-play';
    }
}

// --- Navigation functions ---
function nextWord() {
    if (currentCardIndex < currentWords.length - 1) {
        const wordCard = document.getElementById('wordCard');
        wordCard.classList.remove('fade-in');
        wordCard.classList.add('fade-out');
        
        setTimeout(() => {
            currentCardIndex++;
            displayCurrentCard();
        }, 200);
    }
}

function prevWord() {
    if (currentCardIndex > 0) {
        const wordCard = document.getElementById('wordCard');
        wordCard.classList.remove('fade-in');
        wordCard.classList.add('fade-out');
        
        setTimeout(() => {
            currentCardIndex--;
            displayCurrentCard();
        }, 200);
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
    const partOfSpeechSelect = document.getElementById('partOfSpeech');
    const contextInput = document.getElementById('context');
    const isPublicToggle = document.getElementById('wordPublic');
    
    if (!wordInput || !translationInput || !partOfSpeechSelect) return;

    const word = wordInput.value.trim();
    const translation = translationInput.value.trim();
    const partOfSpeech = partOfSpeechSelect.value;
    const context = contextInput ? contextInput.value.trim() : '';
    const isPublic = isPublicToggle ? isPublicToggle.checked : false;

    if (!word || !translation) {
        showNotification('Пожалуйста, заполните все обязательные поля', 'error');
        return;
    }

    if (!partOfSpeech){
        showNotification('Пожалуйста, выберете часть речи', 'error');
        return;
    }

    if (!currentUserId) {
        showNotification('Ошибка: Не указан user_id', 'error');
        return;
    }

    const payload = { 
        user_id: currentUserId, 
        word: word.toLowerCase(), 
        part_of_speech: partOfSpeech, 
        translation,
        is_public: isPublic,
        context: context
    };
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
        if (contextInput) contextInput.value = '';
        if (isPublicToggle) isPublicToggle.checked = false;
        
        // Останавливаем запись голоса если активна
        const voiceRecordBtn = document.getElementById('voiceRecordBtn');
        if (voiceRecordBtn && voiceRecordBtn.classList.contains('active')) {
            voiceRecordBtn.classList.remove('active');
            const icon = voiceRecordBtn.querySelector('i');
            icon.classList.remove('fa-stop');
            icon.classList.add('fa-microphone');
            if (recognition) {
                recognition.stop();
            }
        }
        
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
        
        // Перезагружаем слова и обновляем интерфейс
        await loadWords();
        
        const activePage = document.querySelector('.page.active');
        if (activePage && activePage.id === 'all-words') {
            // Если остались слова, сбрасываем индекс на 0
            if (currentWords.length > 0) {
                currentCardIndex = 0;
                displayCurrentCard();
            }
        }
        if (document.getElementById('statistics')?.classList.contains('active')) await loadStatistics();
    } catch (err) {
        console.error('deleteWord error:', err);
        showNotification('Ошибка при удалении слова', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// --- Navigation bookmarks with smooth carousel animation ---
function setupBookmarks() {
    const bookmarks = document.querySelectorAll('.bookmark');
    const sidebar = document.querySelector('.bookmarks-sidebar');
    
    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', function() {
            // Если уже активна - ничего не делаем
            if (this.classList.contains('active')) return;
            
            const clickedBookmark = this;
            const allBookmarks = Array.from(sidebar.children);
            const clickedIndex = allBookmarks.indexOf(clickedBookmark);
            
            // Убираем активность у всех
            bookmarks.forEach(b => b.classList.remove('active'));
            // Добавляем активность текущей
            this.classList.add('active');

            // Переключаем страницы
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

            const pageId = this.getAttribute('data-page');
            const pageElement = document.getElementById(pageId);
            if (pageElement) pageElement.classList.add('active');

            if (pageId === 'all-words') loadWords();
            if (pageId === 'statistics') loadStatistics();
            
            // Плавная анимация карусели
            animateBookmarkCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar);
        });
    });
}

function animateBookmarkCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar) {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Мобильная анимация - горизонтальная
        animateMobileCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar);
    } else {
        // Десктопная анимация - вертикальная
        animateDesktopCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar);
    }
}

function animateDesktopCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar) {
    const bookmarksAbove = allBookmarks.slice(0, clickedIndex);
    const bookmarksBelow = allBookmarks.slice(clickedIndex + 1);
    
    // Новый порядок: кликнутая закладка + все ниже + все выше
    const newOrder = [clickedBookmark, ...bookmarksBelow, ...bookmarksAbove];
    
    // Помечаем все закладки как анимируемые
    allBookmarks.forEach(bookmark => {
        bookmark.classList.add('animating');
    });
    
    // Анимация для закладок выше - уходят вверх
    bookmarksAbove.forEach((bookmark, index) => {
        bookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s, opacity 0.5s ease ${index * 0.1}s`;
        bookmark.classList.add('desktop-slide-up');
    });
    
    // Анимация для закладок ниже - сдвигаются вверх
    bookmarksBelow.forEach((bookmark, index) => {
        const delay = (bookmarksAbove.length + index) * 0.1;
        bookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`;
        bookmark.style.transform = `translateY(-${clickedBookmark.offsetHeight}px)`;
    });
    
    // Анимация для кликнутой закладка - поднимается наверх
    clickedBookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${bookmarksAbove.length * 0.1}s`;
    clickedBookmark.style.transform = `translateY(-${clickedIndex * clickedBookmark.offsetHeight}px)`;
    
    // После завершения анимации перестраиваем DOM
    setTimeout(() => {
        sidebar.innerHTML = '';
        newOrder.forEach(bookmark => {
            // Сбрасываем стили
            bookmark.style.transition = '';
            bookmark.style.transform = '';
            bookmark.style.opacity = '';
            bookmark.classList.remove('animating', 'desktop-slide-up', 'desktop-slide-down');
            sidebar.appendChild(bookmark);
        });
    }, 500 + Math.max(bookmarksAbove.length, bookmarksBelow.length) * 100);
}

function animateMobileCarousel(clickedBookmark, clickedIndex, allBookmarks, sidebar) {
    const bookmarksLeft = allBookmarks.slice(0, clickedIndex);
    const bookmarksRight = allBookmarks.slice(clickedIndex + 1);
    
    // Новый порядок: кликнутая закладка + все справа + все слева
    const newOrder = [clickedBookmark, ...bookmarksRight, ...bookmarksLeft];
    
    // Помечаем все закладки как анимируемые
    allBookmarks.forEach(bookmark => {
        bookmark.classList.add('animating');
    });
    
    // Анимация для закладок слева - уходят влево
    bookmarksLeft.forEach((bookmark, index) => {
        bookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s, opacity 0.5s ease ${index * 0.1}s`;
        bookmark.classList.add('mobile-slide-left');
    });
    
    // Анимация для закладок справа - сдвигаются влево
    bookmarksRight.forEach((bookmark, index) => {
        const delay = (bookmarksLeft.length + index) * 0.1;
        bookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`;
        bookmark.style.transform = `translateX(-${clickedBookmark.offsetWidth * clickedIndex}px)`;
    });
    
    // Анимация для кликнутой закладки - сдвигается влево
    clickedBookmark.style.transition = `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${bookmarksLeft.length * 0.1}s`;
    clickedBookmark.style.transform = `translateX(-${clickedBookmark.offsetWidth * clickedIndex}px)`;
    
    // После завершения анимации перестраиваем DOM
    setTimeout(() => {
        sidebar.innerHTML = '';
        newOrder.forEach(bookmark => {
            // Сбрасываем стили
            bookmark.style.transition = '';
            bookmark.style.transform = '';
            bookmark.style.opacity = '';
            bookmark.classList.remove('animating', 'mobile-slide-left', 'mobile-slide-right');
            sidebar.appendChild(bookmark);
        });
        
        // Прокручиваем к активной закладке
        clickedBookmark.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 500 + Math.max(bookmarksLeft.length, bookmarksRight.length) * 100);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    userIdElement = document.getElementById('userId');
    wordsListElement = document.getElementById('wordsList');
    notificationElement = document.getElementById('notification');
    loadingOverlay = document.getElementById('loadingOverlay');
    wordsLoading = document.getElementById('wordsLoading');

    // 🔄 УЛУЧШЕННАЯ ИНИЦИАЛИЗАЦИЯ С ИЗВЛЕЧЕНИЕМ ИЗ URL
    function initializeFromURL() {
        console.log('🔄 Извлечение данных из URL...');
        
        try {
            // Получаем параметры из hash
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const tgWebAppData = hashParams.get('tgWebAppData');
            
            if (tgWebAppData) {
                console.log('✅ tgWebAppData найден в URL');
                
                // Парсим tgWebAppData
                const dataParams = new URLSearchParams(tgWebAppData);
                const userParam = dataParams.get('user');
                
                if (userParam) {
                    // Декодируем и парсим JSON с пользователем
                    const decodedUser = decodeURIComponent(userParam);
                    const userData = JSON.parse(decodedUser);
                    
                    console.log('👤 Данные пользователя из URL:', userData);
                    
                    if (userData && userData.id) {
                        const userId = String(userData.id);
                        console.log('✅ USER ID извлечен из URL:', userId);
                        return userId;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при извлечении данных из URL:', error);
        }
        
        return null;
    }

    // 🔄 ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ TELEGRAM WEBAPP С FALLBACK
    function loadTelegramWebApp() {
        return new Promise((resolve) => {
            // Если Telegram уже загружен, используем его
            if (window.Telegram?.WebApp) {
                console.log('✅ Telegram WebApp уже загружен');
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
                
                if (tg.initDataUnsafe?.user?.id) {
                    resolve(String(tg.initDataUnsafe.user.id));
                    return;
                }
            }
            
            // Если не загружен, пробуем загрузить скрипт
            console.log('🔄 Попытка загрузки Telegram WebApp скрипта...');
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-web-app.js';
            script.onload = () => {
                console.log('✅ Telegram WebApp скрипт загружен');
                if (window.Telegram?.WebApp) {
                    const tg = window.Telegram.WebApp;
                    tg.ready();
                    tg.expand();
                    
                    if (tg.initDataUnsafe?.user?.id) {
                        resolve(String(tg.initDataUnsafe.user.id));
                    } else {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            script.onerror = () => {
                console.error('❌ Ошибка загрузки Telegram WebApp скрипта');
                resolve(null);
            };
            document.head.appendChild(script);
            
            // Таймаут на случай, если скрипт не загрузится
            setTimeout(() => {
                resolve(null);
            }, 2000);
        });
    }

    // 🔄 ОСНОВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ
    async function initializeApp() {
        let userId = null;
    
        // 1. Пробуем загрузить Telegram WebApp
        userId = await loadTelegramWebApp();
    
        // 2. Если не получилось, извлекаем из URL
        if (!userId) {
            userId = initializeFromURL();
        }
    
        // 3. Устанавливаем user_id
        if (userId) {
            currentUserId = userId;
            console.log('🎉 USER ID установлен:', currentUserId);
        
            // Обновляем URL
            updateUrlWithUserId(currentUserId);
        
            // Загружаем данные
            loadWords();
            loadStatistics();
        } else {
            // 4. Если user_id не найден
            console.error('❌ Не удалось определить user_id');
            showNotification('Ошибка: Не удалось определить ID пользователя', 'error');
        }
    
        // Инициализируем остальные компоненты
        setupEventListeners();
        initializeCustomComponents();
        initializeVoiceRecognition();
    }

    // 🔄 ФУНКЦИЯ ОБНОВЛЕНИЯ URL
    function updateUrlWithUserId(userId) {
        try {
            const url = new URL(window.location);
            url.searchParams.set('user_id', userId);
            window.history.replaceState({}, '', url);
            console.log('🔗 URL обновлен:', url.toString());
        } catch (e) {
            console.warn('Не удалось обновить URL:', e);
        }
    }

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

        // Обработчики для навигации по карточкам
        document.getElementById('nextWordBtn')?.addEventListener('click', nextWord);
        document.getElementById('prevWordBtn')?.addEventListener('click', prevWord);

        // Обработчик для кнопки удаления на карточке
        document.getElementById('deleteCardBtn')?.addEventListener('click', function() {
            const wordId = this.getAttribute('data-word-id');
            if (wordId) {
                deleteWord(wordId);
            }
        });
    }

    // 🔄 ИНИЦИАЛИЗАЦИЯ КАСТОМНЫХ КОМПОНЕНТОВ
    function initializeCustomComponents() {
        const partOfSpeechDisplay = document.getElementById('partOfSpeechDisplay');
        const partOfSpeechSelect = document.getElementById('partOfSpeech');
        const options = Array.from(partOfSpeechSelect.options);
    
        // Находим опцию с подсказкой (первая опция с пустым value)
        const hintOption = options.find(opt => opt.value === '');
        const speechOptions = options.filter(opt => opt.value !== ''); // Только реальные части речи
    
        let isHintMode = true;

        if (partOfSpeechDisplay) {
            // Устанавливаем начальную подсказку
            partOfSpeechDisplay.querySelector('span').textContent = hintOption.text;
            partOfSpeechSelect.value = hintOption.value;

            partOfSpeechDisplay.addEventListener('click', function() {
                let selectedOption;
            
                if (isHintMode) {
                    // Первый клик - переходим к первой реальной части речи
                    selectedOption = speechOptions[0];
                    isHintMode = false;
                } else {
                    // Последующие клики - циклически перебираем реальные части речи
                    const currentIndex = speechOptions.findIndex(opt => opt.value === partOfSpeechSelect.value);
                    const nextIndex = (currentIndex + 1) % speechOptions.length;
                    selectedOption = speechOptions[nextIndex];
                }
            
                partOfSpeechDisplay.querySelector('span').textContent = selectedOption.text;
                partOfSpeechSelect.value = selectedOption.value;
            
                this.classList.add('active');
                setTimeout(() => {
                    this.classList.remove('active');
                }, 300);
            });
        }

        // Обработчик для кнопки приватности
        const wordPublic = document.getElementById('wordPublic');
        if (wordPublic) {
            wordPublic.addEventListener('change', function() {
                const privacyBtn = this.closest('.privacy-btn');
                if (this.checked) {
                    privacyBtn.title = 'Публичное слово (видят все)';
                    showNotification('Слово будет публичным', 'success');
                } else {
                    privacyBtn.title = 'Приватное слово (только для вас)';
                    showNotification('Слово будет приватным', 'success');
                }
                console.log('Word visibility:', this.checked ? 'public' : 'private');
            });
        }
    }

    // 🔄 ИНИЦИАЛИЗАЦИЯ ГОЛОСОВОГО ВВОДА
    function initializeVoiceRecognition() {
        const voiceRecordBtn = document.getElementById('voiceRecordBtn');
        if (!voiceRecordBtn) return;

        // Проверяем поддержку браузером
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            voiceRecordBtn.style.display = 'none';
            showNotification('Голосовой ввод не поддерживается вашим браузером', 'error');
            return;
        }

        // Создаем экземпляр распознавания речи
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US'; // Распознаем английскую речь

        voiceRecordBtn.addEventListener('click', toggleVoiceRecording);
        
        recognition.onstart = function() {
            isRecording = true;
            voiceRecordBtn.classList.add('active');
            voiceRecordBtn.innerHTML = '<i class="fas fa-stop"></i>';
            showNotification('Говорите сейчас...', 'success');
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            const wordInput = document.getElementById('newWord');
            if (wordInput) {
                wordInput.value = transcript;
                showNotification(`Распознано: "${transcript}"`, 'success');
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'Ошибка распознавания речи';
            if (event.error === 'not-allowed') {
                errorMessage = 'Разрешите доступ к микрофону';
            } else if (event.error === 'audio-capture') {
                errorMessage = 'Микрофон не найден';
            }
            showNotification(errorMessage, 'error');
        };

        // В функции initializeVoiceRecognition обновляем onend:
        recognition.onend = function() {
        // Дублируем остановку на случай, если запись закончилась сама
        if (isRecording) {
            isRecording = false;
            const voiceRecordBtn = document.getElementById('voiceRecordBtn');
            if (voiceRecordBtn) {
                voiceRecordBtn.classList.remove('active');
                voiceRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    };
    }

    // 🔄 ПЕРЕКЛЮЧЕНИЕ РЕЖИМА ЗАПИСИ ГОЛОСА
    function toggleVoiceRecording() {
        if (!recognition) return;
        
        if (isRecording) {
            isRecording = false
            const voiceRecordBtn = document.getElementById('voiceRecordBtn');
            if (voiceRecordBtn) {
                voiceRecordBtn.classList.remove('active');
                voiceRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                showNotification('Ошибка запуска записи', 'error');
            }
        }
    }

    // Запускаем инициализацию
    initializeApp();
});