let conversationHistory = [];
let settings = {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024
};

async function initPuter() {
    try {
        await puter.init();
        // После успешной инициализации включаем элементы ввода
        document.getElementById('user-input').disabled = false;
        document.getElementById('send-button').disabled = false;
    } catch (error) {
        console.error('Failed to initialize Puter:', error);
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

async function sendMessage() {
    const input = document.getElementById('user-input');
    const messagesContainer = document.getElementById('chat-messages');
    const message = input.value.trim();

    if (!message) return;

    try {
        const userMessageElement = createMessageElement(message, true);
        messagesContainer.appendChild(userMessageElement);
        
        conversationHistory.push({ role: 'user', content: message });
        localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));

        input.value = '';

        const loadingElement = document.createElement('div');
        loadingElement.className = 'message ai-message loading-indicator';
        loadingElement.textContent = 'Thinking...';
        messagesContainer.appendChild(loadingElement);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const response = await puter.ai.chat({
            model: 'claude-3-5-sonnet',
            messages: conversationHistory,
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxTokens,
            stream: true
        });

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

        conversationHistory.push({ role: 'assistant', content: aiMessage });
        localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
        
    } catch (error) {
        console.error('Error:', error);
        const errorMessage = createMessageElement(
            'Failed to get response. Please try again.',
            false
        );
        errorMessage.classList.add('error-message');
        messagesContainer.appendChild(errorMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initPuter();
    loadFromStorage();

    document.getElementById('settings-toggle').addEventListener('click', () => {
        document.getElementById('settings-content').classList.toggle('hidden');
    });

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

    document.getElementById('clear-history').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat history?')) {
            conversationHistory = [];
            localStorage.removeItem('chatHistory');
            document.getElementById('chat-messages').innerHTML = '';
        }
    });

    document.getElementById('send-button').addEventListener('click', sendMessage);
    
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
