document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('pdfForm');
  const responseDiv = document.getElementById('response');

  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    
    const formData = new FormData(form);
    
    try {
      responseDiv.textContent = "Uploading and processing...";
      
      const response = await fetch('/uploads', {
        method: 'POST',
        body: formData 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update the DOM with your backend data
      responseDiv.innerHTML = `
        <p style="color: green;">Status: ${data.status}</p>
        <p>File: <strong>${data.filename}</strong></p>
        <p>Total Pages: <strong>${data.pages}</strong></p>
      `;
      
    } catch (error) {
      responseDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
  });
});