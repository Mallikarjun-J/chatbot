"""
ML-based Content Classifier
Classifies scraped content into categories: announcement, placement, event, examination, holiday, document
Uses both traditional ML (sklearn) and deep learning approaches
"""

import pickle
import os
from typing import List, Dict, Tuple, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from loguru import logger
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

from app.config import settings
from app.database import db


# Download NLTK data (run once)
try:
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('punkt', quiet=True)
except:
    pass


class ContentClassifier:
    """
    Hybrid content classifier using both traditional ML and deep learning
    """
    
    # Category definitions with enhanced keywords
    CATEGORIES = {
        'placement': [
            'placement', 'job', 'recruitment', 'interview', 'company', 'hiring',
            'career', 'campus drive', 'off-campus', 'internship', 'offer',
            'package', 'ctc', 'lpa', 'selected', 'shortlisted', 'ppo', 'recruit',
            'placed', 'recruiting', 'recruiter', 'hr', 'human resource',
            'salary', 'lakhs', 'compensation', 'benefits', 'joining',
            'campus hire', 'pool campus', 'super dream', 'dream',
            'placement cell', 'placement office', 'placement drive',
            'highest package', 'average package', 'companies visited',
            'pre-placement', 'ppt', 'written test', 'group discussion',
            'technical round', 'hr round', 'shortlist', 'eligible'
        ],
        'event': [
            'event', 'workshop', 'seminar', 'webinar', 'conference', 'symposium',
            'fest', 'celebration', 'competition', 'hackathon', 'cultural',
            'sports', 'tech fest', 'cultural fest', 'annual day', 'function',
            'ceremony', 'inauguration', 'guest lecture', 'talk', 'felicitation'
        ],
        'examination': [
            'exam', 'examination', 'test', 'assessment', 'quiz', 'mid-term',
            'end-sem', 'semester exam', 'internal', 'cie', 'see', 'viva',
            'practical exam', 'hall ticket', 'admit card', 'exam schedule',
            'revaluation', 'supplementary', 'results', 'marks', 'grade'
        ],
        'holiday': [
            'holiday', 'vacation', 'leave', 'off', 'closed', 'reopen',
            'reopening', 'semester break', 'festive', 'public holiday',
            'national holiday', 'festival'
        ],
        'document': [
            'download', 'pdf', 'form', 'application', 'document',
            'certificate', 'bonafide', 'transcript', 'marksheet', 'syllabus',
            'timetable', 'circular', 'notice', 'upload', 'submit'
        ]
    }
    
    def __init__(self):
        self.model_path = settings.CLASSIFIER_MODEL
        self.sklearn_model: Optional[Pipeline] = None
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        
        # Will be loaded if transformer model exists
        self.transformer_tokenizer = None
        self.transformer_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
    
    def preprocess_text(self, text: str) -> str:
        """Preprocess text for classification"""
        # Convert to lowercase
        text = text.lower()
        
        # Tokenize
        tokens = nltk.word_tokenize(text)
        
        # Remove stopwords and lemmatize
        tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token.isalnum() and token not in self.stop_words
        ]
        
        return ' '.join(tokens)
    
    def keyword_based_classification(self, text: str) -> Tuple[str, float]:
        """
        Fast keyword-based classification
        Returns (category, confidence_score)
        """
        text_lower = text.lower()
        scores = {category: 0 for category in self.CATEGORIES}
        
        for category, keywords in self.CATEGORIES.items():
            for keyword in keywords:
                if keyword in text_lower:
                    scores[category] += 1
        
        # Find max score
        max_category = max(scores, key=scores.get)
        max_score = scores[max_category]
        
        # If no keywords matched, default to announcement
        if max_score == 0:
            return 'announcement', 0.3
        
        # Calculate confidence (normalize by max possible score)
        confidence = min(max_score / 10, 1.0)  # Cap at 1.0
        
        return max_category, confidence
    
    async def train_sklearn_model(self, training_data: List[Dict]):
        """
        Train scikit-learn model
        
        Args:
            training_data: List of dicts with 'text' and 'label' keys
        """
        if len(training_data) < 10:
            logger.warning("Not enough training data for sklearn model")
            return
        
        logger.info(f"Training sklearn classifier with {len(training_data)} samples")
        
        # Prepare data
        texts = [self.preprocess_text(item['text']) for item in training_data]
        labels = [item['label'] for item in training_data]
        
        # Create pipeline
        self.sklearn_model = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=5000, ngram_range=(1, 2))),
            ('clf', RandomForestClassifier(n_estimators=100, random_state=42))
        ])
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels, test_size=0.2, random_state=42
        )
        
        # Train
        self.sklearn_model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.sklearn_model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        logger.info(f"Sklearn model accuracy: {accuracy:.3f}")
        logger.info(f"Classification report:\n{classification_report(y_test, y_pred)}")
        
        # Save model
        await self.save_model()
    
    async def save_model(self):
        """Save the sklearn model to disk"""
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.sklearn_model, f)
            logger.info(f"Model saved to {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    async def load_model(self):
        """Load the sklearn model from disk"""
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    self.sklearn_model = pickle.load(f)
                logger.info(f"Model loaded from {self.model_path}")
            else:
                logger.warning("No trained model found. Will use keyword-based classification.")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
    
    def classify_with_sklearn(self, text: str) -> Tuple[str, float]:
        """
        Classify using sklearn model
        Returns (category, confidence_score)
        """
        if not self.sklearn_model:
            return self.keyword_based_classification(text)
        
        try:
            processed_text = self.preprocess_text(text)
            predicted_label = self.sklearn_model.predict([processed_text])[0]
            
            # Get probability scores
            probabilities = self.sklearn_model.predict_proba([processed_text])[0]
            confidence = float(max(probabilities))
            
            return predicted_label, confidence
        except Exception as e:
            logger.error(f"Sklearn classification failed: {e}")
            return self.keyword_based_classification(text)
    
    async def classify(self, text: str, title: str = "") -> Dict:
        """
        Main classification method - uses hybrid approach
        
        Args:
            text: Content text to classify
            title: Title text (optional, given more weight)
            
        Returns:
            Dict with category, confidence, method used, and detailed scores
        """
        combined_text = f"{title} {title} {text}"  # Title gets double weight
        
        # Method 1: Keyword-based (fast, always available)
        keyword_category, keyword_confidence = self.keyword_based_classification(combined_text)
        
        # Method 2: sklearn model (if trained)
        if self.sklearn_model:
            sklearn_category, sklearn_confidence = self.classify_with_sklearn(combined_text)
            
            # Ensemble: average the confidences if categories match
            if keyword_category == sklearn_category:
                final_category = keyword_category
                final_confidence = (keyword_confidence + sklearn_confidence) / 2
                method = "hybrid_ensemble"
            else:
                # Use the one with higher confidence
                if sklearn_confidence > keyword_confidence:
                    final_category = sklearn_category
                    final_confidence = sklearn_confidence
                    method = "sklearn"
                else:
                    final_category = keyword_category
                    final_confidence = keyword_confidence
                    method = "keyword"
        else:
            final_category = keyword_category
            final_confidence = keyword_confidence
            method = "keyword_only"
        
        return {
            "category": final_category,
            "confidence": final_confidence,
            "method": method,
            "scores": {
                "keyword": (keyword_category, keyword_confidence),
                "sklearn": (sklearn_category, sklearn_confidence) if self.sklearn_model else None
            }
        }
    
    async def classify_batch(self, items: List[Dict]) -> List[Dict]:
        """
        Classify multiple items in batch
        
        Args:
            items: List of dicts with 'text' and 'title' keys
            
        Returns:
            List of classification results
        """
        results = []
        for item in items:
            result = await self.classify(
                text=item.get('text', ''),
                title=item.get('title', '')
            )
            results.append(result)
        
        return results
    
    async def auto_train_from_db(self):
        """
        Automatically train model from labeled data in database
        """
        logger.info("Auto-training classifier from database...")
        
        try:
            # Fetch training data from ml_training_data collection
            training_docs = await db.ml_training_data.find({}).to_list(length=10000)
            
            if len(training_docs) < 20:
                logger.warning("Not enough training data in database. Need at least 20 samples.")
                return
            
            # Prepare training data
            training_data = [
                {
                    'text': doc['text'],
                    'label': doc['label']
                }
                for doc in training_docs
            ]
            
            # Train sklearn model
            await self.train_sklearn_model(training_data)
            
            logger.info("✅ Auto-training completed successfully")
            
        except Exception as e:
            logger.error(f"Auto-training failed: {e}")
