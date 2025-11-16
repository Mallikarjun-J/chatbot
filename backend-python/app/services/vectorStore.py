"""
Vector Store Service using ChromaDB
Stores and retrieves document embeddings
"""

import chromadb
from chromadb.config import Settings
from typing import List, Dict, Optional
from app.services.embeddingService import get_embedding_service
import json
import os

class VectorStore:
    def __init__(self, persist_directory: str = "./chroma_db"):
        """Initialize ChromaDB client"""
        # Ensure directory exists
        os.makedirs(persist_directory, exist_ok=True)
        
        # Lazy load embedding service
        self.embedding_service = None
        
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection for placements
        self.placement_collection = self.client.get_or_create_collection(
            name="placement_data",
            metadata={"description": "Placement statistics and information"}
        )
    
    def add_document(self, doc_id: str, text: str, metadata: Dict):
        """Add document to vector store"""
        if self.embedding_service is None:
            self.embedding_service = get_embedding_service()
        embedding = self.embedding_service.embed_text(text)
        
        self.placement_collection.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata]
        )
    
    def add_documents_batch(self, documents: List[Dict]):
        """Add multiple documents"""
        if self.embedding_service is None:
            self.embedding_service = get_embedding_service()
        ids = [doc['id'] for doc in documents]
        texts = [doc['text'] for doc in documents]
        metadatas = [doc['metadata'] for doc in documents]
        
        embeddings = self.embedding_service.embed_batch(texts)
        
        self.placement_collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
    
    def search(self, query: str, n_results: int = 5) -> Dict:
        """Search for similar documents"""
        if self.embedding_service is None:
            self.embedding_service = get_embedding_service()
        query_embedding = self.embedding_service.embed_text(query)
        
        results = self.placement_collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        
        return {
            'ids': results['ids'][0],
            'documents': results['documents'][0],
            'metadatas': results['metadatas'][0],
            'distances': results['distances'][0]
        }
    
    def get_collection_count(self) -> int:
        """Get number of documents in collection"""
        return self.placement_collection.count()

# Global instance
vector_store = VectorStore()
