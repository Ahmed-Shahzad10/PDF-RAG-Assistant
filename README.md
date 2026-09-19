# Local RAG PDF Question Answering System

A local **Retrieval-Augmented Generation (RAG)** application that allows users to upload PDF documents, extract and structurally chunk their content, generate embeddings, store them in a **FAISS vector database**, and ask natural language questions using a locally running **Phi-3 LLM through Ollama**.

The project is designed to demonstrate a complete end-to-end RAG pipeline using Python and FastAPI without relying on paid LLM APIs.

---

## Features

- Upload PDF documents
- Extract text from PDFs
- Structure-aware document chunking
- Generate local embeddings using `nomic-embed-text`
- Store and persist vectors using FAISS
- Semantic similarity search
- Generate answers using local `Phi-3`
- Display retrieved source chunks
- Track document IDs, filenames, sections, and chunk indexes
- Persistent FAISS index and metadata
- Simple browser-based frontend
- HTML escaping to reduce XSS risks when displaying document content
- No external LLM API required

---

## Architecture

                         ┌─────────────────────┐
                         │     PDF Upload      │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    PDF Processing   │
                         │      PyMuPDF        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Structural Chunking│
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Embeddings     │
                         │  nomic-embed-text   │
                         │      via Ollama     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    FAISS Vector DB  │
                         │    + Metadata       │
                         └─────────────────────┘


                             User Question
                                  │
                                  ▼
                        ┌─────────────────────┐
                        │ Query Embedding     │
                        │ nomic-embed-text    │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │ FAISS Similarity    │
                        │ Search              │
                        └──────────┬──────────┘
                                   │
                                   ▼    
                        ┌─────────────────────┐
                        │ Top-K Relevant      │
                        │ Document Chunks     │
                        └──────────┬──────────┘
                                   │
                                   ▼ 
                        ┌─────────────────────┐
                        │ Context Assembly    │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │ Phi-3 LLM           │
                        │ via Ollama          │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │ Answer + Sources    │
                        └─────────────────────┘


---

## Tech Stack
Backend: Python, FastAPI, Uvicorn

Document Processing: PyMuPDF

Embeddings: Ollama, nomic-embed-text (768-dimensional embeddings)

Vector Database: FAISS (IndexFlatL2)

Local LLM: Phi-3 (Served locally through Ollama)

Frontend: HTML, CSS, JavaScript

Storage: FAISS binary index, Pickle metadata storage, Local PDF storage

---

## Project Structure
```text
Plaintext
RAG/
│
├── app/
│   ├── models/
│   │
│   ├── routes/
│   │   └── upload.py
│   │
│   ├── services/
│   │   ├── chunking_service.py
│   │   ├── embedding_service.py
│   │   ├── llm_service.py
│   │   ├── pdf_service.py
│   │   └── vector_service.py
│   │
│   └── main.py
│
├── frontend_route/
│   ├── index.html
│   ├── script.js
│   └── beauty.css
│
├── uploads/
│
├── vector_store/
│   ├── faiss_index.bin
│   └── metadata.pkl
│
├── tests/
│
├── .gitignore
└── README.md



---

## How It Works

1. PDF Upload
The user uploads a PDF through the web interface.
The FastAPI /uploads endpoint executes:
PDF → Validation → Save locally → Extract text → Structural chunking → Generate embeddings → Store vectors in FAISS

2. Document Chunking
The extracted document is divided into meaningful chunks rather than treating the entire PDF as one large block.
Each chunk contains information such as:

JSON
{
    "section": "...",
    "text": "..."
}
This allows the retrieval system to preserve document structure and provide useful source information later.

3. Embedding Generation
Each chunk is converted into a numerical vector using nomic-embed-text through Ollama.
Document Chunk → nomic-embed-text → 768-dimensional vector
These vectors represent the semantic meaning of the document chunks.

4. FAISS Vector Storage
The generated embeddings are stored using FAISS (faiss.IndexFlatL2). The project also stores metadata alongside the vectors.
Example metadata:

JSON
{
    "id": 0,
    "document_id": "...",
    "filename": "example.pdf",
    "section": "Introduction",
    "chunk_index": 0,
    "text": "..."
}
The FAISS index and metadata are persisted locally. This means the vector database can be loaded again when the application starts.

5. Semantic Search
When the user enters a search query (e.g., "What is the payment policy?"), the query is first converted into an embedding.
Question → nomic-embed-text → Query Vector → FAISS → Top-K Similar Chunks
The application returns the most semantically relevant document chunks.

Full RAG Pipeline
The /ask endpoint performs the complete RAG process.
User Question → Query Embedding → FAISS Retrieval → Top-K Relevant Chunks → Context Assembly → Phi-3 → Generated Answer → Answer + Sources

The LLM is instructed to answer only using the retrieved document context. If the answer is not present in the provided context, the model is instructed to respond:
"I cannot answer this based on the provided documents."

---

## Why Local Models?
This project uses Ollama instead of a cloud LLM API.

Advantages:

- No API key required

- No per token API cost

- Documents remain on the local machine

- Can work without sending document content to an external LLM provider

- Easy to swap models (e.g., LLMService(model="phi3") can be changed to another Ollama-supported model).

--- 

## Installation
1. Clone the repository
Bash
git clone https://github.com/Ahmed-Shahzad10/PDF-RAG-Assistant.git
cd PDF-RAG-Assistant
2. Create a virtual environment
Windows

Bash
python -m venv venv
venv\Scripts\activate
Linux / macOS

Bash
python3 -m venv venv
source venv/bin/activate
3. Install dependencies
Bash
pip install fastapi uvicorn python-multipart pymupdf numpy faiss-cpu ollama
4. Install Ollama
Install Ollama from https://ollama.com/.
Then download the required models:

Bash
ollama pull nomic-embed-text
ollama pull phi3
Make sure Ollama is running:

Bash
ollama serve
Run the Application
From the project root:

Bash
uvicorn main:app --reload
The application should be available at: [http://127.0.0.1:8000](http://127.0.0.1:8000)
Open the URL in your browser.

API Endpoints
Upload PDF
POST /uploads
Uploads and processes a PDF document.
(Upload → PDF extraction → Chunking → Embeddings → FAISS indexing)

Vector Search
GET /search?query=your_question&limit=3
Returns the most semantically similar chunks from the FAISS index.

Full RAG Question Answering
GET /ask?query=your_question&limit=3
Runs the full pipeline (Embedding → FAISS retrieval → Context assembly → Phi-3 generation) and returns:

JSON
{
    "question": "What is the payment policy?",
    "answer": "...",
    "sources": []
}
User Interface
The frontend provides three main operations:

Upload Document: Upload and process a PDF.

Query Vector Knowledge Base: Search the FAISS index and inspect the retrieved chunks.

Ask the LLM: Run the complete RAG pipeline and receive an answer with source references.

Privacy
The project is designed around a local processing workflow. PDFs, embeddings, FAISS vectors, and LLM inference can remain on the local machine when using Ollama. No external LLM API is required for the current implementation.

Current Limitations
This is a functional RAG MVP and there are several areas that can be improved:

Retrieval: Currently uses IndexFlatL2. No reranking stage. Retrieval quality depends heavily on chunk quality.

Chunking: Can be further optimized. Tables and complex PDF layouts may require specialized processing.

LLM: Phi-3 is a lightweight local model. Larger models may provide better generation quality at the cost of additional memory and compute.

Storage: Metadata currently uses Pickle. No user/document management layer or database for application-level document records.

Production: Authentication, rate limiting, and background task processing for large documents are not implemented.

Project Goal
The primary goal of this project is to demonstrate how a complete Retrieval-Augmented Generation system can be built from scratch using locally hosted models.

Instead of directly asking an LLM (Question → LLM → Answer), the application uses:
Question → Embedding → Vector Search → Relevant Knowledge → Context → LLM → Grounded Answer

This reduces the need to place the entire document inside the LLM prompt and allows the model to answer questions based on specific retrieved sections of the uploaded documents.

---

## Author
Ahmed Shahzad

BS Computer Science

Interested in:

AI Engineering

Generative AI

RAG Systems

Python Backend Development

FastAPI

Machine Learning

AI Automation

⭐ If you find this project useful, feel free to star the repository and explore the implementation!