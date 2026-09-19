import ollama

EMBEDDING_MODEL = "nomic-embed-text"

class EmbeddingService:
    def __init__(self, model: str = EMBEDDING_MODEL):
        self.model = model
        self.client = ollama.AsyncClient()

    async def embed_text(self, text: str) -> list:
        """Vectorizes a single input text query block."""
        response = await self.client.embed(
            model=self.model,
            input=text
        )
        # Note: Newer Ollama SDKs use 'embeddings' (plural key) containing a list of vectors
        return response["embeddings"][0]

    async def generate_embeddings(self, structured_chunks: list) -> list:
        """Processes an array list of document chunks during parsing cycles."""
        for chunk in structured_chunks:
            chunk["embedding"] = await self.embed_text(chunk["text"])
        return structured_chunks