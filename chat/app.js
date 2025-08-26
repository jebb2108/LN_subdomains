let sessionTimer;

// Получаем токен из URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Подключаемся с токеном
let socket = io('http://localhost:4000', {
    query: { token: token }
});

// Установка имени пользователя при подключении
socket.on('connect', function() {
    socket.emit('set_username', userName);

    // Устанавливаем таймер блокировки чата через 15 минут
    sessionTimer = setTimeout(() => {
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendButton').disabled = true;

        // Добавляем сообщение о завершении сессии
        const container = document.getElementById('messagesContainer');
        const sessionEndedMessage = document.createElement('div');
        sessionEndedMessage.className = 'session-ended-message';
        sessionEndedMessage.textContent = 'Сессия завершена. Чат заблокирован.';
        container.appendChild(sessionEndedMessage);
        container.scrollTop = container.scrollHeight;
    }, 900000); // 15 минут в миллисекундах
});

// Обработчик нового сообщения от сервера
socket.on('new_message', function (data) {
    addMessageToChat(data, data.sender === userName);
});

// Обработчик истории сообщений при подключении
socket.on('message_history', function (messages) {
    const container = document.getElementById('messagesContainer');
    // Очищаем системное сообщение
    container.innerHTML = '';

    messages.forEach(msg => {
        addMessageToChat(msg, msg.sender === userName);
    });
});

// Обработчик завершения сессии от сервера
socket.on('session_ended', function(data) {
    // Блокируем чат при получении события от сервера
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendButton').disabled = true;

    // Добавляем сообщение о завершении сессии
    const container = document.getElementById('messagesContainer');
    const sessionEndedMessage = document.createElement('div');
    sessionEndedMessage.className = 'session-ended-message';
    sessionEndedMessage.textContent = 'Сессия завершена. Чат заблокирован.';
    container.appendChild(sessionEndedMessage);
    container.scrollTop = container.scrollHeight;

    // Очищаем таймер, так как сессия уже завершена
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
});

// Функция добавления сообщения в чат
function addMessageToChat(messageData, isMyMessage = false) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;

    // Форматируем время
    const messageTime = new Date(messageData.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

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