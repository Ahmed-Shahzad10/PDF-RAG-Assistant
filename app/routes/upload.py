from fastapi import APIRouter, UploadFile, File, HTTPException, status
import os
from app.services.pdf_service import save_pdf_file
from app.services.chunking_service import run_advanced_structural_chunking
from app.services.embedding_service import EmbeddingService
from app.services.vector_service import VectorService
from app.services.llm_service import LLMService

router = APIRouter()

# --- Single Persistent Service Allocations (Loads from disk once on boot) ---
embedding_service = EmbeddingService()
vector_store = VectorService(dimension=768)
llm_service = LLMService(model="phi3")

@router.post("/uploads")
async def uploading_pdf(file_name: UploadFile = File(...)):
    if file_name.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid file type. Only PDFs are allowed."
        )
        
    saved_file_path = None
    try:
        unique_filename, saved_file_path = await save_pdf_file(file_name)
                
        # Phase 1 & 2: Process Chunking Structure
        try:
            structured_chunks = run_advanced_structural_chunking(saved_file_path, max_chars=1000)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Parsing Error: Invalid document structure layout."
            )
            
        # Phase 3: Generate Local Embeddings using Service instance method
        try:
            structured_chunks = await embedding_service.generate_embeddings(structured_chunks)
        except Exception as ollama_err:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Ollama embedding engine offline. Make sure 'ollama serve' is running. Error: {str(ollama_err)}"
            )

        # Phase 4: Add tracking metrics safely to vector system storage instance
        try:
            vector_store.add_vectors(
                chunks=structured_chunks, 
                document_id=unique_filename, 
                filename=file_name.filename
            )
        except Exception as faiss_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to index vectors into FAISS: {str(faiss_err)}"
            )
            
    except Exception as e:
        if saved_file_path and os.path.exists(saved_file_path):
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


@router.get("/search")
async def search_documents(query: str, limit: int = 3):
    """
    RAG Pipeline Interface Route:
    Decoupled workflow layer passing isolated service items cleanly.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query string text cannot be empty.")
        
    try:
        # Step 1: Query string converted to float vector matrix array via embedding abstraction
        query_vector = await embedding_service.embed_text(query)
        
        # Step 2: Query vector fed right into preloaded FAISS retrieval architecture index mapping 
        matches = vector_store.search(query_vector, top_k=limit)
        
        return {
            "query": query, 
            "results": matches
        }
        
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"The vector retrieval pipeline operation failed: {str(err)}"
        )


@router.get("/ask")
async def ask_rag_pipeline(query: str, limit: int = 3):
    """
    Full RAG Execution: Vector Search -> Context Assembly -> LLM Generation
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        # Phase 5: Query -> Embedding -> FAISS
        query_vector = await embedding_service.embed_text(query)
        matches = vector_store.search(query_vector, top_k=limit)
        
        if not matches:
            return {
                "question": query,
                "answer": "No relevant document contexts found in the vector index to answer this question.",
                "sources": []
            }

        # Phase 6: Retrieved Chunks -> Context
        # We explicitly format the raw chunks into a single, structured text block
        context_blocks = []
        for match in matches:
            block = f"[Source: {match['filename']} | Section: {match['section']}]\n{match['text']}"
            context_blocks.append(block)
            
        full_context = "\n\n---\n\n".join(context_blocks)
        
        # Phase 7: Context + Question -> LLM
        answer = await llm_service.generate_rag_response(context=full_context, question=query)
        
        return {
            "question": query,
            "answer": answer,
            "sources": matches
        }
        
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG generation failed: {str(err)}"
        )