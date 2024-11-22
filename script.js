let conversationHistory = [];
let settings = {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024
};

async function initPuter() {
    try {
        await puter.init();
        console.log('Puter initialized successfully');
    } catch (error) {
        console.error('Puter initialization error:', error);
        const messagesContainer = document.getElementById('chat-messages');
        const errorMessage = createMessageElement(
            'Failed to initialize AI service. Please refresh the page.', 
            false
        );
        errorMessage.classList.add('error-message');
        messagesContainer.appendChild(errorMessage);
    }
}

function loadFromStorage() {
    const savedHistory = localStorage.getItem('chatHistory');
    const savedSettings = localStorage.getItem('chatSettings');
    
    if (savedHistory) {
        conversationHistory = JSON.parse(savedHistory);
        conversationHistory.forEach(msg => {
            const messageElement = createMessageElement(
                msg.content, 
                msg.role === 'user'
            );
            document.getElementById('chat-messages').appendChild(messageElement);
        });
    }

    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        document.getElementById('temperature').value = settings.temperature;
        document.getElementById('temperature-value').textContent = settings.temperature;
        document.getElementById('top-p').value = settings.topP;
        document.getElementById('top-p-value').textContent = settings.topP;
        document.getElementById('max-tokens').value = settings.maxTokens;
    }
}

function saveSettings() {
    localStorage.setItem('chatSettings', JSON.stringify(settings));
}

function createMessageElement(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    let processedContent = content;

    codeBlocks.forEach((block) => {
        const code = block.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
        const language = block.match(/```(\w+)?/)?.[1] || '';
        
        const codeHtml = `
            <div class="code-block">
                <button class="copy-button" onclick="copyCode(this)">Copy</button>
                <pre><code class="language-${language}">${code}</code></pre>
            </div>
        `;
        
        processedContent = processedContent.replace(block, codeHtml);
    });

    messageDiv.innerHTML = processedContent;
    
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    return messageDiv;
}

function copyCode(button) {
    const codeBlock = button.nextElementSibling.querySelector('code');
    navigator.clipboard.writeText(codeBlock.textContent);
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = 'Copy';
    }, 2000);
}

function createRetryButton(message) {
    const button = document.createElement('button');
    button.textContent = 'Retry';
    button.className = 'retry-button';
    button.onclick = () => {
        const input = document.getElementById('user-input');
        input.value = message;
        sendMessage();
    };
    return button;
}

async function sendMessage() {
    const input = document.getElementById('user-input');
    const messagesContainer = document.getElementById('chat-messages');
    const message = input.value.trim();

    if (!message) return;

    try {
        // Добавляем сообщение пользователя
        const userMessageElement = createMessageElement(message, true);
        messagesContainer.appendChild(userMessageElement);
        
        // Добавляем в историю
        conversationHistory.push({ role: 'user', content: message });
        localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));

        input.value = '';

        // Создаём элемент для индикатора загрузки
        const loadingElement = document.createElement('div');
        loadingElement.className = 'message ai-message loading-indicator';
        loadingElement.textContent = 'Thinking...';
        messagesContainer.appendChild(loadingElement);

        // Прокручиваем к индикатору загрузки
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const response = await puter.ai.chat({
            model: 'claude-3-5-sonnet',
            messages: conversationHistory,
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxTokens,
            stream: true
        });

        // Удаляем индикатор загрузки
        messagesContainer.removeChild(loadingElement);

        let aiMessage = '';
        const aiMessageElement = createMessageElement('', false);
        messagesContainer.appendChild(aiMessageElement);

        for await (const chunk of response) {
            aiMessage += chunk;
            aiMessageElement.innerHTML = aiMessage;
            
            aiMessageElement.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Добавляем ответ в историю
        conversationHistory.push({ role: 'assistant', content: aiMessage });
        localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
        
    } catch (error) {
        console.error('Error details:', error);
        
        // Создаём элемент для сообщения об ошибке
        const errorMessage = createMessageElement(
            `Error: ${error.message || 'Failed to get response from AI. Please try again.'}`, 
            false
        );
        errorMessage.classList.add('error-message');
        
        // Добавляем кнопку повтора
        const retryButton = createRetryButton(message);
        errorMessage.appendChild(retryButton);
        
        messagesContainer.appendChild(errorMessage);
        
        // Прокручиваем к сообщению об ошибке
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initPuter();
    loadFromStorage();

    // Настройки
    document.getElementById('settings-toggle').addEventListener('click', () => {
        document.getElementById('settings-content').classList.toggle('hidden');
    });

    // Закрытие настроек при клике вне панели
    document.addEventListener('click', (e) => {
        const settingsPanel = document.querySelector('.settings-panel');
        const settingsContent = document.getElementById('settings-content');
        if (!settingsPanel.contains(e.target) && !settingsContent.classList.contains('hidden')) {
            settingsContent.classList.add('hidden');
        }
    });

    document.getElementById('temperature').addEventListener('input', (e) => {
        settings.temperature = parseFloat(e.target.value);
        document.getElementById('temperature-value').textContent = settings.temperature;
        saveSettings();
    });

    document.getElementById('top-p').addEventListener('input', (e) => {
        settings.topP = parseFloat(e.target.value);
        document.getElementById('top-p-value').textContent = settings.topP;
        saveSettings();
    });

    document.getElementById('max-tokens').addEventListener('change', (e) => {
        settings.maxTokens = parseInt(e.target.value);
        saveSettings();
    });

    // Очистка истории
    document.getElementById('clear-history').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat history?')) {
            conversationHistory = [];
            localStorage.removeItem('chatHistory');
            document.getElementById('chat-messages').innerHTML = '';
        }
    });

    // Отправка сообщений
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
