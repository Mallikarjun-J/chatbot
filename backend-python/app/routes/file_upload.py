"""
File upload and analysis routes for storing documents in database
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime
import hashlib
import io
from ..middleware.auth import get_current_user
from ..database import get_database
from ..services.documentExtractor import (
    extract_pdf_text, extract_image_text, extract_placement_data,
    calculate_content_hash
)
import PyPDF2
from PIL import Image
import pytesseract

router = APIRouter()


async def analyze_file_content(file_content: bytes, filename: str, file_type: str) -> dict:
    """Analyze file content and extract relevant information"""
    analysis = {
        'filename': filename,
        'file_type': file_type,
        'size_bytes': len(file_content),
        'text_content': '',
        'metadata': {},
        'extracted_data': {}
    }
    
    try:
        if file_type == 'pdf' or filename.lower().endswith('.pdf'):
            # Extract text from PDF
            pdf_bytes = io.BytesIO(file_content)
            reader = PyPDF2.PdfReader(pdf_bytes)
            
            analysis['metadata']['num_pages'] = len(reader.pages)
            
            text = ""
            for page in reader.pages[:50]:  # Limit to 50 pages
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                except:
                    continue
            
            analysis['text_content'] = text.strip()
            
            # Extract placement data if relevant
            if any(keyword in text.lower() for keyword in ['placement', 'company', 'package', 'lpa', 'recruited']):
                analysis['extracted_data']['placement'] = extract_placement_data(text)
        
        elif file_type == 'image' or filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
            # Extract text from image using OCR
            image = Image.open(io.BytesIO(file_content))
            
            analysis['metadata']['format'] = image.format
            analysis['metadata']['size'] = image.size
            analysis['metadata']['mode'] = image.mode
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            text = pytesseract.image_to_string(image, lang='eng')
            analysis['text_content'] = text.strip()
            
            # Extract placement data if relevant
            if any(keyword in text.lower() for keyword in ['placement', 'company', 'package', 'lpa', 'recruited']):
                analysis['extracted_data']['placement'] = extract_placement_data(text)
        
        elif file_type == 'text' or filename.lower().endswith(('.txt', '.md', '.csv')):
            # Plain text file
            text = file_content.decode('utf-8', errors='ignore')
            analysis['text_content'] = text.strip()
        
        else:
            # Unknown file type - store as binary
            analysis['text_content'] = f"Binary file: {filename}"
    
    except Exception as e:
        analysis['error'] = str(e)
    
    return analysis


@router.post("/api/files/upload")
async def upload_and_analyze_file(
    file: UploadFile = File(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload file, analyze content, and store in database"""
    from loguru import logger
    
    if current_user.get("role") not in ["Admin", "Teacher"]:
        raise HTTPException(status_code=403, detail="Only Admin and Teachers can upload files")
    
    try:
        # Read file content
        content = await file.read()
        
        # Determine file type
        file_type = 'unknown'
        if file.filename.lower().endswith('.pdf'):
            file_type = 'pdf'
        elif file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
            file_type = 'image'
        elif file.filename.lower().endswith(('.txt', '.md', '.csv')):
            file_type = 'text'
        elif file.filename.lower().endswith(('.doc', '.docx')):
            file_type = 'document'
        
        logger.info(f"Analyzing file: {file.filename} ({file_type})")
        
        # Analyze file content
        analysis = await analyze_file_content(content, file.filename, file_type)
        
        # Calculate content hash for duplicate detection
        content_hash = calculate_content_hash(analysis['text_content'])
        
        # Parse tags
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()] if tags else []
        
        # Prepare document for storage
        db = get_database()
        
        # Check for duplicate
        existing = await db.uploaded_files.find_one({'contentHash': content_hash})
        if existing:
            return {
                'success': False,
                'message': 'Duplicate file detected - content already exists in database',
                'existing_file': existing.get('filename'),
                'uploaded_at': existing.get('uploadedAt')
            }
        
        # Store in uploaded_files collection
        document = {
            'filename': file.filename,
            'originalFilename': file.filename,
            'fileType': file_type,
            'category': category or 'general',
            'description': description or '',
            'tags': tag_list,
            'size': len(content),
            'contentHash': content_hash,
            'textContent': analysis['text_content'][:10000],  # Limit stored text
            'fullTextLength': len(analysis['text_content']),
            'metadata': analysis.get('metadata', {}),
            'extractedData': analysis.get('extracted_data', {}),
            'uploadedBy': current_user.get('email'),
            'uploadedByRole': current_user.get('role'),
            'uploadedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        # Add to database
        result = await db.uploaded_files.insert_one(document)
        
        logger.info(f"✓ File stored: {file.filename} ({len(content)} bytes)")
        
        return {
            'success': True,
            'message': f'File uploaded and analyzed successfully',
            'file_id': str(result.inserted_id),
            'filename': file.filename,
            'file_type': file_type,
            'size': len(content),
            'text_extracted': len(analysis['text_content']),
            'has_placement_data': bool(analysis.get('extracted_data', {}).get('placement')),
            'placement_data': analysis.get('extracted_data', {}).get('placement', {})
        }
    
    except Exception as e:
        logger.error(f"File upload error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


@router.post("/api/files/bulk-upload")
async def bulk_upload_files(
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload multiple files at once"""
    from loguru import logger
    
    if current_user.get("role") not in ["Admin", "Teacher"]:
        raise HTTPException(status_code=403, detail="Only Admin and Teachers can upload files")
    
    results = {
        'success': [],
        'failed': [],
        'duplicates': []
    }
    
    for file in files:
        try:
            content = await file.read()
            file_type = 'pdf' if file.filename.lower().endswith('.pdf') else 'image' if file.filename.lower().endswith(('.jpg', '.png')) else 'document'
            
            analysis = await analyze_file_content(content, file.filename, file_type)
            content_hash = calculate_content_hash(analysis['text_content'])
            
            db = get_database()
            existing = await db.uploaded_files.find_one({'contentHash': content_hash})
            
            if existing:
                results['duplicates'].append(file.filename)
                continue
            
            document = {
                'filename': file.filename,
                'fileType': file_type,
                'category': category or 'general',
                'size': len(content),
                'contentHash': content_hash,
                'textContent': analysis['text_content'][:10000],
                'metadata': analysis.get('metadata', {}),
                'extractedData': analysis.get('extracted_data', {}),
                'uploadedBy': current_user.get('email'),
                'uploadedAt': datetime.utcnow()
            }
            
            await db.uploaded_files.insert_one(document)
            results['success'].append(file.filename)
            logger.info(f"✓ Uploaded: {file.filename}")
        
        except Exception as e:
            results['failed'].append({'filename': file.filename, 'error': str(e)})
            logger.error(f"✗ Failed: {file.filename} - {e}")
    
    return {
        'success': True,
        'message': f"Uploaded {len(results['success'])} files successfully",
        'results': results
    }


@router.get("/api/files/list")
async def list_uploaded_files(
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all uploaded files with optional filters"""
    db = get_database()
    
    query = {}
    if category:
        query['category'] = category
    if file_type:
        query['fileType'] = file_type
    
    files = []
    cursor = db.uploaded_files.find(query).sort('uploadedAt', -1).limit(100)
    
    async for doc in cursor:
        files.append({
            'id': str(doc['_id']),
            'filename': doc.get('filename'),
            'fileType': doc.get('fileType'),
            'category': doc.get('category'),
            'description': doc.get('description', ''),
            'tags': doc.get('tags', []),
            'size': doc.get('size'),
            'uploadedBy': doc.get('uploadedBy'),
            'uploadedAt': doc.get('uploadedAt'),
            'hasPlacementData': bool(doc.get('extractedData', {}).get('placement'))
        })
    
    return {
        'success': True,
        'files': files,
        'count': len(files)
    }


@router.get("/api/files/{file_id}")
async def get_file_details(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about a specific file"""
    from bson import ObjectId
    db = get_database()
    
    try:
        file_doc = await db.uploaded_files.find_one({'_id': ObjectId(file_id)})
        
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            'success': True,
            'file': {
                'id': str(file_doc['_id']),
                'filename': file_doc.get('filename'),
                'fileType': file_doc.get('fileType'),
                'category': file_doc.get('category'),
                'description': file_doc.get('description', ''),
                'tags': file_doc.get('tags', []),
                'size': file_doc.get('size'),
                'textContent': file_doc.get('textContent', ''),
                'fullTextLength': file_doc.get('fullTextLength'),
                'metadata': file_doc.get('metadata', {}),
                'extractedData': file_doc.get('extractedData', {}),
                'uploadedBy': file_doc.get('uploadedBy'),
                'uploadedAt': file_doc.get('uploadedAt')
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")


@router.delete("/api/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an uploaded file"""
    from bson import ObjectId
    
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admin can delete files")
    
    db = get_database()
    
    try:
        result = await db.uploaded_files.delete_one({'_id': ObjectId(file_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            'success': True,
            'message': 'File deleted successfully'
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")
