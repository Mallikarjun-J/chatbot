"""
Sentence Embeddings Service using Sentence-Transformers
For semantic search and similarity matching
"""

import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Optional
from loguru import logger

from app.config import settings


class EmbeddingService:
    """
    Service for generating sentence embeddings
    Used for semantic search in knowledge base
    """
    
    def __init__(self, model_name: str = None):
        self.model_name = model_name or settings.EMBEDDINGS_MODEL
        self.model: Optional[SentenceTransformer] = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    async def load_model(self):
        """Load the sentence transformer model"""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name, device=self.device)
            logger.info(f"✅ Embedding model loaded on {self.device}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Encode texts into embeddings
        
        Args:
            texts: List of text strings to encode
            batch_size: Batch size for encoding
            
        Returns:
            numpy array of embeddings
        """
        if not self.model:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        return embeddings
    
    def encode_single(self, text: str) -> List[float]:
        """
        Encode a single text into embedding
        
        Args:
            text: Text string to encode
            
        Returns:
            List of floats representing the embedding
        """
        if not self.model:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        embedding = self.model.encode(
            text,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        return embedding.tolist()
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Similarity score (0-1)
        """
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)
        
        # Cosine similarity
        similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        
        return float(similarity)
    
    def find_most_similar(
        self,
        query_embedding: List[float],
        candidate_embeddings: List[List[float]],
        top_k: int = 5
    ) -> List[tuple]:
        """
        Find most similar embeddings to query
        
        Args:
            query_embedding: Query embedding vector
            candidate_embeddings: List of candidate embedding vectors
            top_k: Number of top results to return
            
        Returns:
            List of (index, similarity_score) tuples
        """
        similarities = []
        for idx, candidate in enumerate(candidate_embeddings):
            sim = self.compute_similarity(query_embedding, candidate)
            similarities.append((idx, sim))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]
    
    async def semantic_search(
        self,
        query: str,
        documents: List[dict],
        top_k: int = 5,
        threshold: float = 0.5
    ) -> List[dict]:
        """
        Perform semantic search on documents
        
        Args:
            query: Search query
            documents: List of documents with 'embeddings' field
            top_k: Number of results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of relevant documents with similarity scores
        """
        if not documents:
            return []
        
        # Encode query
        query_embedding = self.encode_single(query)
        
        # Extract embeddings from documents
        doc_embeddings = []
        valid_docs = []
        
        for doc in documents:
            if 'embeddings' in doc and doc['embeddings']:
                doc_embeddings.append(doc['embeddings'])
                valid_docs.append(doc)
        
        if not doc_embeddings:
            return []
        
        # Find most similar
        similar_indices = self.find_most_similar(
            query_embedding,
            doc_embeddings,
            top_k=top_k
        )
        
        # Filter by threshold and return results
        results = []
        for idx, score in similar_indices:
            if score >= threshold:
                doc = valid_docs[idx].copy()
                doc['similarity_score'] = score
                results.append(doc)
        
        return results
