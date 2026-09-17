document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('pdfForm');
  const responseDiv = document.getElementById('response');

  // Helper function to safely escape raw PDF text from XSS and HTML breaks
  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const formData = new FormData(form);
    
    try {
      responseDiv.innerHTML = `<p style="color: blue;">Uploading and processing document...</p>`;
      
      const response = await fetch('/uploads', {
        method: 'POST',
        body: formData 
      });
      
      // Extract detailed server-side error validation message strings
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown server error occurred." }));
        throw new Error(errorData.detail || `HTTP Error ${response.status}`);
      }
      
      const data = await response.json();
      
      const chunksHtml = data.chunks.map((chunk, index) => `
        <div style="background: #ffffff; border-left: 4px solid #8b5cf6; margin-bottom: 14px; padding: 14px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: left;">
         <div style="font-size: 0.8em; color: #4b5563; font-weight: bold; margin-bottom: 8px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 4px; display: flex; justify-content: space-between;">
           <span>CHUNK ID: ${index + 1} | 📂 SECTION: "${escapeHtml(chunk.section)}"</span>
           <span style="background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 0.9em;">🧬 Embed Dimensions: ${chunk.embedding_dimensions}</span>
         </div>
         <pre style="margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; color: #111827; background: #f9fafb; padding: 8px; border-radius: 4px;">${escapeHtml(chunk.text)}</pre>
        </div>
      `).join('');
      
      // Update DOM preserving raw layout formatting 
      responseDiv.innerHTML = `
       <div style="border-top: 2px solid #d1d5db; margin-top: 25px; padding-top: 15px;">
         <p style="color: #2563eb; font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">✔ Extraction & Chunking Complete</p>
         <p style="margin: 0 0 15px 0; color: #4b5563;">File: <strong>${escapeHtml(data.filename)}</strong> | Extracted Total Chunks: <strong style="color: #111827;">${data.chunks_count}</strong></p>
         <div style="max-height: 500px; overflow-y: auto; background: #f3f4f6; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          ${chunksHtml}
         </div>
       </div>
      `;
      
    } catch (error) {
      responseDiv.innerHTML = `<p style="color: red; font-weight: bold;">Error: ${escapeHtml(error.message)}</p>`;
    }
  });
});