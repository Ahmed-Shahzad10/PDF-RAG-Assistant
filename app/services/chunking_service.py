import pymupdf4llm
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

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