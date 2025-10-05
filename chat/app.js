// Получаем room_id из URL
const pathParts = window.location.pathname.split('/');
const roomId = pathParts[pathParts.length - 1];
const token = new URLSearchParams(window.location.search).get('token');

// Переменные для хранения состояния
let userName = '';
let userInfoReceived = false;
let pendingMessages = [];
let sessionTimer;

// Подключаемся к Socket.IO серверу
const socket = io({
    query: {
        token: token,
        room_id: roomId
    }
});

// Получаем информацию о пользователе от сервера
socket.on('user_info', function(data) {
    userName = data.username;
    userInfoReceived = true;
    
    // Обрабатываем сообщения, которые пришли до получения информации о пользователе
    processPendingMessages();
});

// Обработчик нового сообщения от сервера
socket.on('new_message', function(data) {
    if (userInfoReceived) {
        addMessageToChat(data, data.sender === userName);
    } else {
        pendingMessages.push(data);
    }
});

// Обработчик истории сообщений при подключении
socket.on('message_history', function(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';

    if (userInfoReceived) {
        messages.forEach(msg => {
            addMessageToChat(msg, msg.sender === userName);
        });
    } else {
        pendingMessages = messages;
    }
});

// Установка соединения
socket.on('connect', function() {
    // Устанавливаем таймер блокировки чата через 15 минут
    sessionTimer = setTimeout(() => {
        endSession();
    }, 900000);
});

// Обработчик завершения сессии от сервера
socket.on('session_ended', function(data) {
    endSession();
    
    // Очищаем таймер, так как сессия уже завершена
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
});

// Функция для обработки ожидающих сообщений
function processPendingMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (pendingMessages.length > 0) {
        container.innerHTML = '';
        
        pendingMessages.forEach(msg => {
            addMessageToChat(msg, msg.sender === userName);
        });
        
        pendingMessages = [];
    }
}

// Функция завершения сессии
function endSession() {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = 'Сессия завершена. Чат заблокирован.';
    container.appendChild(sessionEndedMessage);
    container.scrollTop = container.scrollHeight;
}

// Функция добавления сообщения в чат
function addMessageToChat(messageData, isMyMessage = false) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    let messageTime;
    const date = new Date(messageData.created_at);
    
    if (isNaN(date.getTime())) { // Проверка на Invalid Date
        console.error("Invalid date:", messageData.created_at);
        messageTime = "только что";
    } else {
        messageTime = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    messageDiv.innerHTML = `
        <div class="message-content">${messageData.text}</div>
        <div class="message-info">
            ${isMyMessage ? 'Вы' : messageData.sender} • ${messageTime}
        </div>
    `;

    container.appendChild(messageDiv);
    // Прокручиваем к последнему сообщению
    container.scrollTop = container.scrollHeight;
}

// Функция отправки сообщения
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (message) {
        socket.emit('send_message', message);
        messageInput.value = '';
    }
}

// Отправка сообщения при нажатии Enter
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});