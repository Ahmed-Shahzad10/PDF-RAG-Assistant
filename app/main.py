from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pymupdf4llm  # Phase 1
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter  # Phase 2
import ollama  # Phase 3: Local embedding engine
import uuid
import os

UPLOAD_DIR = "uploads" 
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB 
CHUNK_SIZE = 64 * 1024          # 64 KB blocks
EMBEDDING_MODEL = "nomic-embed-text"

app = FastAPI()
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_advanced_structural_chunking(file_path: str, max_chars: int = 1000, overlap: int = 150):
    """Phase 2: Markdown text -> Header Isolation -> Text Window Split -> Metadata"""
    markdown_text = pymupdf4llm.to_markdown(file_path)
    
    headers_to_split_on = [
        ("#", "Header_1"),
        ("##", "Header_2"),
        ("###", "Header_3"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    section_docs = markdown_splitter.split_text(markdown_text)
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chars,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    final_processed_chunks = []
    
    for doc in section_docs:
        headers = []
        if "Header_1" in doc.metadata: headers.append(doc.metadata["Header_1"])
        if "Header_2" in doc.metadata: headers.append(doc.metadata["Header_2"])
        if "Header_3" in doc.metadata: headers.append(doc.metadata["Header_3"])
        
        section_path = " > ".join(headers) if headers else "General Content"
        sub_chunks = text_splitter.split_text(doc.page_content)
        
        for sub_txt in sub_chunks:
            if not sub_txt.strip():
                continue
                
            final_processed_chunks.append({
                "section": section_path,
                "text": sub_txt.strip()
            })
            
    return final_processed_chunks

@app.post("/uploads")
async def uploading_pdf(file_name: UploadFile = File(...)):
    if file_name.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid file type. Only PDFs are allowed."
        )
    
    _, file_extension = os.path.splitext(file_name.filename)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    current_file_size = 0
    structured_chunks = []
    
    try:
        # Save file to server
        with open(saved_file_path, "wb") as buffer:
            while chunk := await file_name.read(CHUNK_SIZE):
                current_file_size += len(chunk)
                if current_file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File too large."
                    )
                buffer.write(chunk)
                
        # Phase 1 & 2: Process Chunking Structure
        try:
            structured_chunks = run_advanced_structural_chunking(saved_file_path, max_chars=1000)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Parsing Error: Invalid document structure layout."
            )
            
        # Phase 3: Generate Local Embeddings using Async Ollama Client
        try:
            # Explicitly initializing the async client resolves the connection block
            async_client = ollama.AsyncClient()
            
            for chunk in structured_chunks:
                response = await async_client.embed(
                    model=EMBEDDING_MODEL,
                    input=chunk["text"]
                )
                # Note: Newer Ollama SDKs use 'embeddings' (plural key) containing a list of vectors
                chunk["embedding"] = response["embeddings"][0]
                
        except Exception as ollama_err:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Ollama embedding engine offline. Make sure 'ollama serve' is running. Error: {str(ollama_err)}"
            )
            
    except Exception as e:
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Internal server error.")
    
    ui_chunks = [
        {
            "section": c["section"], 
            "text": c["text"], 
            "embedding_dimensions": len(c["embedding"])
        } for c in structured_chunks
    ]
    
    return {
        "filename": file_name.filename,
        "unique_filename": unique_filename,  
        "status": "success",
        "chunks_count": len(structured_chunks),
        "chunks": ui_chunks
    }

app.mount("/", StaticFiles(directory="frontend_route", html=True), name="frontend")
