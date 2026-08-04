from fastapi import FastAPI, UploadFile , File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
import io


app = FastAPI()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.post("/uploads")
async def uploading_pdf(file_name: UploadFile = File(...)):
    # Read the file content into memory
    file_bytes = await file_name.read()
    
    # Load the bytes into pypdf to get page count
    pdf_stream = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_stream)
    page_count = len(reader.pages)
    
    return {
        "filename": file_name.filename,
        "pages": page_count,
        "status": "success"
    }


app.mount("/", StaticFiles(directory="frontend_route", html=True), name="frontend")