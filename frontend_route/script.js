document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById('chatForm');
    const chatHistory = document.getElementById('chat-history');
    const fileInput = document.getElementById('fileInput');
    const textInput = document.getElementById('textInput');
    const welcomeScreen = document.getElementById('welcome-screen');
    const uploadBtn = document.getElementById('upload-btn');

    let conversationState = 'AWAITING_FILE'; 

    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };


    const hideWelcomeScreen = () => {
        if (welcomeScreen) welcomeScreen.style.display = 'none';
    };

    const addUserMessage = (text) => {
        hideWelcomeScreen();
        const msgHtml = `<div class="message user-message"><div class="message-content">${escapeHtml(text)}</div></div>`;
        chatHistory.insertAdjacentHTML('beforeend', msgHtml);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const addBotMessage = (htmlContent) => {
        hideWelcomeScreen();
        const msgHtml = `<div class="message bot-message"><div class="message-content">${htmlContent}</div></div>`;
        chatHistory.insertAdjacentHTML('beforeend', msgHtml);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const setInputMode = (mode) => {
        if (mode === 'text') {
            textInput.disabled = false;
            textInput.placeholder = "How can I help you today?";
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.pointerEvents = 'none';
            textInput.focus();
        } else {
            textInput.disabled = true;
            textInput.placeholder = "Upload a PDF using the + button...";
            uploadBtn.style.opacity = '1';
            uploadBtn.style.pointerEvents = 'auto';
        }
    };

 
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0 && conversationState === 'AWAITING_FILE') {
            chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    });

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // STATE 1: UPLOADING FILE
        if (conversationState === 'AWAITING_FILE') {
            if (fileInput.files.length === 0) return;
            
            const formData = new FormData();
            formData.append('file_name', fileInput.files[0]);
            
            addUserMessage(`📄 ${fileInput.files[0].name}`);
            addBotMessage(`<p style="color: #888;">Processing document...</p>`);

            try {
                const response = await fetch('/uploads', { method: 'POST', body: formData });
                if (!response.ok) throw new Error("Upload failed.");
                const data = await response.json();

                const chunksHtml = data.chunks.map((c, i) => `
                    <div class="chunk-card">
                        <div class="chunk-meta"><span>Chunk ${i + 1} | ${escapeHtml(c.section)}</span></div>
                        <pre style="margin: 0; font-family: monospace; color: #AAA; white-space: pre-wrap;">${escapeHtml(c.text)}</pre>
                    </div>
                `).join('');

                addBotMessage(`
                    <p style="color: #DDD; font-weight: 500;">Extracted ${data.chunks_count} chunks.</p>
                    <div style="max-height: 200px; overflow-y: auto; margin-top: 10px;">${chunksHtml}</div>
                    <p style="margin-top: 15px;">Do you want to query the Vector Knowledge Base directly before talking to the LLM? (Yes/No)</p>
                `);

                conversationState = 'AWAITING_VECTOR_DECISION';
                setInputMode('text');

            } catch (err) {
                addBotMessage(`<p style="color: #ff6b6b;">Error: ${err.message}</p>`);
            }
        }

        // STATE 2: DECIDING TO USE VECTOR SEARCH OR NOT
        else if (conversationState === 'AWAITING_VECTOR_DECISION') {
            const input = textInput.value.trim().toLowerCase();
            if (!input) return;
            
            addUserMessage(textInput.value);
            textInput.value = '';

            if (input === 'yes' || input === 'y') {
                addBotMessage("<p>What exactly would you like to search for in the vectors?</p>");
                conversationState = 'AWAITING_VECTOR_QUERY';
            } else {
                addBotMessage("<p>Skipped vector search. What question would you like to ask the LLM?</p>");
                conversationState = 'AWAITING_LLM_QUESTION';
            }
        }

        // STATE 3: PERFORMING VECTOR SEARCH
        else if (conversationState === 'AWAITING_VECTOR_QUERY') {
            const query = textInput.value.trim();
            if (!query) return;

            addUserMessage(query);
            textInput.value = '';
            
            addBotMessage(`<p style="color: #888;">Searching FAISS index...</p>`);

            try {
                const response = await fetch(`/search?query=${encodeURIComponent(query)}&limit=3`);
                if (!response.ok) throw new Error("Search failed.");
                const data = await response.json();

                if (data.results.length === 0) {
                    addBotMessage("<p>No matches found in the index. What question do you have for the LLM?</p>");
                } else {
                    const resultsHtml = data.results.map((r, i) => `
                        <div class="chunk-card">
                            <div class="chunk-meta"><span>Match ${i + 1} | L2: ${r.distance.toFixed(4)}</span></div>
                            <p style="margin: 0; color: #CCC;">${escapeHtml(r.text)}</p>
                        </div>
                    `).join('');
                    
                    addBotMessage(`
                        <p>Here are the top matches:</p>
                        <div style="max-height: 250px; overflow-y: auto;">${resultsHtml}</div>
                        <p style="margin-top: 15px;">Now, what question would you like to ask the LLM?</p>
                    `);
                }
                
                conversationState = 'AWAITING_LLM_QUESTION';

            } catch (err) {
                addBotMessage(`<p style="color: #ff6b6b;">Error: ${err.message}</p>`);
                conversationState = 'AWAITING_LLM_QUESTION';
            }
        }

        // STATE 4: FULL RAG LLM QUERY ( In LOOPS)
        else if (conversationState === 'AWAITING_LLM_QUESTION') {
            const query = textInput.value.trim();
            if (!query) return;

            addUserMessage(query);
            textInput.value = '';

            addBotMessage(`<p style="color: #888;">Generating AI response...</p>`);

            try {
                const response = await fetch(`/ask?query=${encodeURIComponent(query)}&limit=3`);
                if (!response.ok) throw new Error("RAG generation failed.");
                const data = await response.json();

                const sourcesHtml = data.sources.map((s, i) => `<li style="margin-bottom: 4px;">[${i + 1}] ${escapeHtml(s.filename)} - ${escapeHtml(s.section)}</li>`).join('');

                addBotMessage(`
                    <p style="white-space: pre-wrap; color: #FFF;">${escapeHtml(data.answer)}</p>
                    ${data.sources.length > 0 ? `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #333;"><p style="font-size: 0.8rem; color: #888; margin-bottom: 5px;">Sources used:</p><ul style="padding-left:15px; margin:0; font-size: 0.8rem; color: #888;">${sourcesHtml}</ul></div>` : ''}
                `);
                
            } catch (err) {
                addBotMessage(`<p style="color: #ff6b6b;">Error: ${err.message}</p>`);
            }
        }
    });

    setInputMode('file');
});