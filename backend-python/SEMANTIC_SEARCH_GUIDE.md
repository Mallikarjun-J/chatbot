# Semantic Search & RAG Implementation Guide

## 🎯 What Was Built

A complete **Semantic Search with RAG (Retrieval Augmented Generation)** system for intelligent querying of placement data using natural language.

## 📁 Files Created

1. **`app/services/embeddingService.py`** - Converts text to vector embeddings
2. **`app/services/vectorStore.py`** - ChromaDB integration for storing/searching embeddings
3. **`app/services/ragService.py`** - RAG system combining search + LLM
4. **`app/routes/semanticSearch.py`** - API endpoints
5. **`index_placement_data.py`** - Script to index existing data
6. **`requirements-ml.txt`** - Additional dependencies

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```powershell
cd backend-python
pip install chromadb langchain langchain-community openai tiktoken faiss-cpu
```

Or install from file:
```powershell
pip install -r requirements-ml.txt
```

### Step 2: Add API Key (Optional)

For best results, add OpenAI API key to `.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

Without OpenAI, it will use Google Gemini (already configured).

### Step 3: Index Your Placement Data

This creates vector embeddings of your placement data:

```powershell
python index_placement_data.py
```

Expected output:
```
📊 Indexing Placement Data into Vector Store
Found 1 placement documents
✓ Prepared: Unique Company List_18.07.2025.pdf (2500+ chars)
✅ Successfully indexed 1 placement documents!
```

### Step 4: Start Server

```powershell
python main.py
```

## 🔍 How to Use

### Via API

**Endpoint:** `POST /api/semantic-search/query`

**Request:**
```json
{
  "question": "Which branch has the best placement percentage?",
  "n_results": 5
}
```

**Response:**
```json
{
  "answer": "CIVIL has the best placement percentage at 83.87%, followed by AI&ML at 81.03% and ISE at 81.25%.",
  "sources": [...],
  "retrieved_documents": [...],
  "confidence": "high"
}
```

### Example Queries

Try these natural language questions:

- "Which branch has the best placement percentage?"
- "What is the highest package offered?"
- "How many companies participated in 2025?"
- "What is the average salary for CSE branch?"
- "Show me the 5-year placement trend"
- "Compare CSE and ISE placement statistics"
- "What are the internship statistics?"
- "Which branch has the lowest placement percentage?"

### Other Endpoints

**Get Statistics:**
```
GET /api/semantic-search/stats
```

**Raw Search (no LLM):**
```
POST /api/semantic-search/search
```

**Health Check:**
```
GET /api/semantic-search/health
```

## 🧠 How It Works

### 1. **Embedding Generation**
- Text → 384-dimensional vectors using `all-MiniLM-L6-v2`
- Fast and accurate for semantic similarity

### 2. **Vector Storage**
- ChromaDB stores embeddings persistently
- Enables fast similarity search

### 3. **RAG Process**
```
User Question
    ↓
Generate Query Embedding
    ↓
Search Similar Documents (ChromaDB)
    ↓
Retrieve Top 5 Relevant Contexts
    ↓
Build Prompt with Context + Question
    ↓
LLM Generates Answer (OpenAI/Gemini)
    ↓
Return Answer + Sources
```

### 4. **Why This Works**
- **Semantic Understanding**: Finds answers even if keywords don't match
- **Context-Aware**: LLM sees relevant data before answering
- **Accurate**: Reduces hallucination by grounding in your data
- **Fast**: Embeddings enable quick retrieval

## 📊 Benefits

✅ **Natural Language Queries** - No need for exact keywords
✅ **Accurate Answers** - Based on your actual data
✅ **Source Attribution** - Shows which documents were used
✅ **Fast** - Optimized for quick responses
✅ **Scalable** - Add more documents easily

## 🔧 Troubleshooting

### Issue: "Import chromadb could not be resolved"
**Solution:** Run `pip install chromadb`

### Issue: "No documents indexed"
**Solution:** Run `python index_placement_data.py`

### Issue: "OpenAI API error"
**Solution:** 
- Add `OPENAI_API_KEY` to `.env`, OR
- System will automatically use Gemini as fallback

### Issue: "ChromaDB not persisting"
**Solution:** Check that `./chroma_db` directory exists and has write permissions

## 📈 Next Steps

### Add More Data Sources
Run the indexing script after adding:
- More placement records
- Company details
- Student success stories
- Internship data

### Integrate with Frontend
```typescript
// Example React integration
const response = await fetch('/api/semantic-search/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: userQuery,
    n_results: 5
  })
});
const data = await response.json();
console.log(data.answer);
```

### Customize
- Adjust `n_results` for more/fewer sources
- Modify prompt in `ragService.py` for different answer styles
- Use different embedding models in `embeddingService.py`

## 🎓 Technical Details

**Embedding Model:** `all-MiniLM-L6-v2`
- Size: 384 dimensions
- Speed: ~14,200 sentences/sec
- Quality: Excellent for general search

**Vector Database:** ChromaDB
- Persistent storage
- Fast similarity search
- Metadata filtering

**LLM Options:**
1. OpenAI GPT-4 Turbo (if API key provided)
2. Google Gemini Pro (fallback)

## 📞 Support

If you encounter issues:
1. Check logs for error messages
2. Verify all dependencies installed
3. Ensure MongoDB is running
4. Confirm data is indexed (`/api/semantic-search/stats`)

---

**Built for:** Campus Aura Chatbot Project
**Date:** November 16, 2025
**Status:** ✅ Production Ready
