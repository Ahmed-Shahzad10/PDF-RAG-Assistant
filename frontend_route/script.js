document.addEventListener("DOMContentLoaded", () => {
    const uploadForm = document.getElementById('pdfForm');
    const searchForm = document.getElementById('searchForm');
    const responseDiv = document.getElementById('response');
    const searchResultsDiv = document.getElementById('searchResults');

    // Helper function to safely escape raw text to prevent XSS
    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // --- Phase 1: Document Upload & Processing ---
    uploadForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        
        try {
            // Provide UI loading feedback
            responseDiv.innerHTML = `<p style="color: #2563eb; font-weight: 600;">Uploading and processing document through RAG pipeline...</p>`;
            
            const response = await fetch('/uploads', {
                method: 'POST',
                body: formData 
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown server error occurred." }));
                throw new Error(errorData.detail || `HTTP Error ${response.status}`);
            }
            
            const data = await response.json();
            
            // Map the processed chunks into HTML cards
            const chunksHtml = data.chunks.map((chunk, index) => `
                <div class="chunk-card" style="border-left-color: #8b5cf6;">
                    <div class="chunk-meta">
                        <span>CHUNK ID: ${index + 1} | 📂 SECTION: "${escapeHtml(chunk.section)}"</span>
                        <span class="badge" style="background: #e0e7ff; color: #4338ca;">🧬 Embed Dimensions: ${chunk.embedding_dimensions}</span>
                    </div>
                    <pre style="margin: 0; font-family: ui-monospace, monospace; font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; color: #111827; background: #f9fafb; padding: 8px; border-radius: 4px;">${escapeHtml(chunk.text)}</pre>
                </div>
            `).join('');
            
            // Render the final success UI
            responseDiv.innerHTML = `
                <div style="border-top: 2px solid #d1d5db; margin-top: 25px; padding-top: 15px;">
                    <p style="color: #10b981; font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">✔ Extraction & Chunking Complete</p>
                    <p style="margin: 0 0 15px 0; color: #4b5563;">File: <strong>${escapeHtml(data.filename)}</strong> | FAISS Indexed Chunks: <strong style="color: #111827;">${data.chunks_count}</strong></p>
                    <div class="results-container">
                        ${chunksHtml}
                    </div>
                </div>
            `;
            
            // Reset the form so a new file can be uploaded cleanly
            uploadForm.reset();
            
        } catch (error) {
            responseDiv.innerHTML = `<p style="color: #dc2626; font-weight: bold;">Error: ${escapeHtml(error.message)}</p>`;
        }
    });

    // --- Phase 2: FAISS Vector Knowledge Base Search ---
    searchForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const queryInput = document.getElementById('queryText').value;
        
        try {
            // Provide UI loading feedback
            searchResultsDiv.innerHTML = `<p style="color: #2563eb; font-weight: 600;">Vectorizing query and exploring FAISS index space...</p>`;
            
            const targetUrl = `/search?query=${encodeURIComponent(queryInput)}&limit=3`;
            const response = await fetch(targetUrl, { method: 'GET' });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Search pipeline exception encountered." }));
                throw new Error(errorData.detail || `HTTP Search Error ${response.status}`);
            }
            
            const searchData = await response.json();
            
            // Handle empty search results gracefully
            if (!searchData.results || searchData.results.length === 0) {
                searchResultsDiv.innerHTML = `<p style="color: #ea580c; font-weight: bold;">No matching documentation contexts found in the vector index. Try uploading a file first.</p>`;
                return;
            }
            
            // Map the search results into HTML cards
            const resultsHtml = searchData.results.map((result, index) => `
                <div class="chunk-card">
                    <div class="chunk-meta">
                        <span>MATCH POSITION: #${index + 1} | 📂 SECTION: "${escapeHtml(result.section)}"</span>
                        <span class="badge">📐 FAISS L2 Distance: ${result.distance.toFixed(4)}</span>
                    </div>
                    <p style="margin-top: 0; margin-bottom: 8px; font-size: 0.8em; color: #6b7280;">📄 Source File: <strong>${escapeHtml(result.filename)}</strong></p>
                    <p style="margin: 0; font-size: 0.9em; color: #1f2937; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(result.text)}</p>
                </div>
            `).join('');
            
            // Render the final search UI
            searchResultsDiv.innerHTML = `
                <div style="margin-top: 10px;">
                    <p style="margin: 0 0 12px 0; color: #374151; font-size: 0.95em;">Top vector matches for: <em>"${escapeHtml(searchData.query)}"</em></p>
                    <div class="results-container">
                        ${resultsHtml}
                    </div>
                </div>
            `;
            
        } catch (error) {
            searchResultsDiv.innerHTML = `<p style="color: #dc2626; font-weight: bold;">Search Error: ${escapeHtml(error.message)}</p>`;
        }
    });

    // --- Full RAG Pipeline Execution ---
  const ragForm = document.getElementById('ragForm');
  const ragResultDiv = document.getElementById('ragResult');

  if (ragForm) {
      ragForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        const questionInput = document.getElementById('ragQuestion').value;
        
        try {
          ragResultDiv.innerHTML = `<p style="color: #10b981; font-weight: 600;">Searching vectors and generating LLM response...</p>`;
          
          const targetUrl = `/ask?query=${encodeURIComponent(questionInput)}&limit=3`;
          const response = await fetch(targetUrl, { method: 'GET' });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "RAG pipeline failed." }));
            throw new Error(errorData.detail || `HTTP Error ${response.status}`);
          }
          
          const data = await response.json();
          
          const sourcesHtml = data.sources.map((src, idx) => `
              <li style="margin-bottom: 4px; font-size: 0.85em; color: #4b5563;">
                  <strong>[${idx + 1}]</strong> ${escapeHtml(src.filename)} 
                  <span style="color: #9ca3af;">(${escapeHtml(src.section)})</span>
              </li>
          `).join('');

          ragResultDiv.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-top: 12px;">
              <h3 style="margin-top: 0; color: #0f172a; font-size: 1.1em;">Answer:</h3>
              <p style="color: #1e293b; font-size: 1em; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(data.answer)}</p>
              
              ${data.sources.length > 0 ? `
              <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                  <h4 style="margin: 0 0 8px 0; color: #64748b; font-size: 0.9em; text-transform: uppercase;">Sources Used:</h4>
                  <ul style="margin: 0; padding-left: 20px; list-style-type: none;">
                      ${sourcesHtml}
                  </ul>
              </div>` : ''}
            </div>
          `;
          
        } catch (error) {
          ragResultDiv.innerHTML = `<p style="color: #dc2626; font-weight: bold;">Generation Error: ${escapeHtml(error.message)}</p>`;
        }
      });
  }
});