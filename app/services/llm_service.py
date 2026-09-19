import ollama

class LLMService:
    def __init__(self, model: str = "phi3"):
        # You can swap this to "mistral", "phi3", etc., depending on what you pulled in Ollama
        self.model = model
        self.client = ollama.AsyncClient()

    async def generate_rag_response(self, context: str, question: str) -> str:
        """Phase 7: Injects context and question into a strict system prompt."""
        
        prompt = (
            "You are a helpful assistant analyzing document excerpts.\n"
            "Answer the question using ONLY the provided context below.\n"
            "If the answer is not contained in the context, explicitly state: "
            "'I cannot answer this based on the provided documents.'\n\n"
            "CONTEXT:\n"
            f"{context}\n\n"
            "QUESTION:\n"
            f"{question}\n\n"
            "ANSWER:"
        )
        
        response = await self.client.generate(
            model=self.model,
            prompt=prompt,
            stream=False
        )
        
        return response["response"]