import os
from fastapi import UploadFile, HTTPException

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
CHUNK_SIZE = 64 * 1024            # 64 KB blocks

os.makedirs(UPLOAD_DIR, exist_ok=True)

async def save_pdf_file(file_name: UploadFile) -> str:
    """Saves the uploaded streaming file blocks to disk."""
    import uuid
    _, file_extension = os.path.splitext(file_name.filename)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    current_file_size = 0
    with open(saved_file_path, "wb") as buffer:
        while chunk := await file_name.read(CHUNK_SIZE):
            current_file_size += len(chunk)
            if current_file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="File too large."
                )
            buffer.write(chunk)
            
    return unique_filename, saved_file_path