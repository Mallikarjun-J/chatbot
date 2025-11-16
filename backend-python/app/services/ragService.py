"""
RAG (Retrieval Augmented Generation) Service
Combines semantic search with LLM for accurate answers
"""

from typing import Dict, List, Optional
from app.services.vectorStore import vector_store
from app.config import settings
from openai import OpenAI

class RAGService:
    def __init__(self):
        """Initialize RAG service with Gemini (preferred) or OpenAI"""
        # Always use Gemini if available (better for this use case)
        gemini_key = settings.GEMINI_API_KEY
        self.use_openai = False
        
        if gemini_key:
            # Use Gemini
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel('models/gemini-2.5-flash')
        elif settings.OPENAI_API_KEY:
            # Fallback to OpenAI if Gemini not available
            self.use_openai = True
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = "gpt-4o-mini"  # Use available model
    
    def query(self, question: str, n_results: int = 5) -> Dict:
        """
        Answer question using RAG
        1. Retrieve relevant context from vector store
        2. Generate answer using LLM with context
        """
        
        # Step 1: Retrieve relevant context
        search_results = vector_store.search(question, n_results=n_results)
        
        if not search_results['documents']:
            return {
                'answer': "I couldn't find relevant information in the placement database.",
                'sources': [],
                'confidence': 'low'
            }
        
        # Step 2: Build context from retrieved documents
        context = self._build_context(search_results)
        
        # Step 3: Generate answer with LLM
        prompt = self._build_prompt(question, context)
        
        if self.use_openai:
            answer = self._generate_with_openai(prompt)
        else:
            answer = self._generate_with_gemini(prompt)
        
        return {
            'answer': answer,
            'sources': search_results['metadatas'],
            'retrieved_documents': search_results['documents'],
            'confidence': 'high' if search_results['distances'][0] < 0.5 else 'medium'
        }
    
    def _build_context(self, search_results: Dict) -> str:
        """Build context string from search results"""
        contexts = []
        for i, (doc, metadata) in enumerate(zip(search_results['documents'], search_results['metadatas'])):
            contexts.append(f"[Source {i+1}]\n{doc}\n")
        
        return "\n".join(contexts)
    
    def _build_prompt(self, question: str, context: str) -> str:
        """Build prompt for LLM"""
        return f"""You are a helpful assistant for college placement information. Use the context below to answer the question accurately.

Context:
{context}

Question: {question}

CRITICAL FORMATTING RULES:
1. Use **bold headings** with emojis: **## 📊 Title**
2. ALWAYS add a blank line after each section
3. ALWAYS add a blank line before each new heading
4. Use markdown tables for branch-wise data
5. Add blank line after tables
6. Use **bold** for numbers

Table format:
| Branch | Placed | Placement % | Highest CTC | Average CTC |
|--------|--------|-------------|-------------|-------------|
| CSE    |153/203 | 75.37%      | 33.0 LPA    | 9.31 LPA |

EXAMPLE OUTPUT FORMAT:

**## 📊 Overall Statistics**

• Total Students: **1027**
• Students Placed: **658**

**## 💼 Branch-wise Placement Data**

[Table here]

**## 🏆 Key Insights**

• Best branch: CIVIL **83.87%**

Remember: Blank line after EVERY section!

Answer:"""
    
    def _generate_with_openai(self, prompt: str) -> str:
        """Generate answer using OpenAI"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a helpful placement information assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content
    
    def _generate_with_gemini(self, prompt: str) -> str:
        """Generate answer using Gemini"""
        response = self.gemini_model.generate_content(prompt)
        return response.text

# Global instance
rag_service = RAGService()
