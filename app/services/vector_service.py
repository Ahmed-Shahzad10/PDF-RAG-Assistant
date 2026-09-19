import os
import numpy as np
import faiss
import pickle

class VectorService:
    def __init__(self, index_dir: str = "vector_store", dimension: int = 768):
        """Initializes the FAISS vector service layer using explicit file mappings."""
        self.index_dir = index_dir
        self.dimension = dimension
        self.index_path = os.path.join(self.index_dir, "faiss_index.bin")
        self.metadata_path = os.path.join(self.index_dir, "metadata.pkl")
        
        self.index = None
        self.metadata = []
        
        os.makedirs(self.index_dir, exist_ok=True)
        self.load_index()

    def add_vectors(self, chunks: list, document_id: str, filename: str):
        """Appends multiple processed text chunk matrices into index arrays safely."""
        if not chunks:
            return

        embeddings = []
        for idx, chunk in enumerate(chunks):
            embeddings.append(chunk["embedding"])
            
            # Form metadata tracking map including global ID and dynamic index offsets
            global_id = len(self.metadata)
            self.metadata.append({
                "id": global_id,
                "document_id": document_id,
                "filename": filename,
                "section": chunk.get("section", "General Content"),
                "chunk_index": idx,
                "text": chunk.get("text", "")
            })

        np_embeddings = np.asarray(embeddings, dtype="float32")
        self.index.add(np_embeddings)
        self.save_index()

    def save_index(self):
        """Persists the updated index and tracking metadata binaries safely onto disk."""
        faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, "wb") as f:
            pickle.dump(self.metadata, f)

    def load_index(self):
        """Reads file pointers once from disk into your application environment cache block."""
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.metadata_path, "rb") as f:
                self.metadata = pickle.load(f)
        else:
            self.index = faiss.IndexFlatL2(self.dimension)
            self.metadata = []

    def search(self, query_vector: list, top_k: int = 3) -> list:
        """Executes raw mathematical vector queries directly against the active index space."""
        if not self.index or self.index.ntotal == 0:
            return []

        np_query = np.array([query_vector]).astype("float32")
        distances, indices = self.index.search(np_query, top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.metadata):
                meta = self.metadata[idx]
                results.append({
                    "id": meta["id"],
                    "document_id": meta["document_id"],
                    "filename": meta["filename"],
                    "section": meta["section"],
                    "chunk_index": meta["chunk_index"],
                    "text": meta["text"],
                    "distance": float(dist)
                })
        return results