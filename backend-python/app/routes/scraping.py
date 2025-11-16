"""
Web scraping routes for college website knowledge base - Enhanced with priority crawling and document extraction
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional, Dict, List, Set, Tuple
import httpx
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse, urlunparse, quote
from ..middleware.auth import get_current_user
from ..database import get_database
from ..services.documentExtractor import (
    extract_pdf_text, extract_image_text, extract_placement_data,
    is_recent_document, calculate_content_hash, is_duplicate_content
)

router = APIRouter()

# Keywords for classification
CLASSIFICATION_KEYWORDS = {
    'placements': ['placement', 'job', 'recruit', 'career', 'company', 'interview', 'offer', 'salary', 'campus placement', 'package', 'lpa', 'hired', 'training', 'internship', 'recruiter', 'tpo', 'corporate', 'industry', 'employer', 'ctc', 'stipend', 'ppo', 'selection', 'drive'],
    'events': ['event', 'workshop', 'seminar', 'conference', 'fest', 'competition', 'cultural', 'tech fest', 'symposium'],
    'examinations': ['exam', 'test', 'assessment', 'evaluation', 'quiz', 'mid-term', 'final', 'internal', 'viva'],
    'holidays': ['holiday', 'vacation', 'break', 'leave', 'closed', 'off', 'reopen'],
    'documents': ['form', 'application', 'document', 'certificate', 'download', 'pdf', 'attachment', 'file', 'circular'],
    'departments': ['department', 'cse', 'ece', 'mechanical', 'civil', 'faculty', 'hod', 'professor', 'staff'],
    'admissions': ['admission', 'intake', 'eligibility', 'fee', 'scholarship', 'cutoff', 'entrance', 'apply', 'enroll'],
    'facilities': ['library', 'lab', 'hostel', 'canteen', 'sports', 'infrastructure', 'facility', 'accommodation'],
    'academics': ['syllabus', 'curriculum', 'course', 'program', 'semester', 'credit', 'regulation', 'autonomous'],
    'contact': ['contact', 'email', 'phone', 'address', 'location', 'principal', 'office']
}

# High-priority page patterns (weighted scoring) - PLACEMENTS IS CRITICAL!
HIGH_PRIORITY_PATTERNS = {
    'placements': {'keywords': ['placement', 'training-and-placement', 'tpoffice', 'career', 'recruitment', 'placed', 'recruiter', 'tpo', 'campus-placement', 'job', 'internship', 'corporate', 'industry', 'package', 'offer'], 'weight': 150},  # HIGHEST PRIORITY!
    'admissions': {'keywords': ['admission', 'admissions', 'enroll', 'join', 'apply', 'intake', 'how-to-apply'], 'weight': 100},
    'autonomous': {'keywords': ['autonomous', 'autonomy', 'regulation', 'syllabus', 'curriculum'], 'weight': 90},
    'hostel': {'keywords': ['hostel', 'accommodation', 'residence', 'dormitory', 'hostel-facility'], 'weight': 85},
    'faculty': {'keywords': ['faculty', 'staff', 'teachers', 'professors', 'hod', 'faculty-profile'], 'weight': 80},
    'circulars': {'keywords': ['circular', 'notification', 'notice', 'announcement', 'latest'], 'weight': 75}
}

def normalize_url(url: str) -> str:
    """Normalize URL to prevent duplicates"""
    parsed = urlparse(url)
    # Remove fragments, normalize scheme and netloc, remove trailing slash
    normalized = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        parsed.path.rstrip('/') or '/',
        parsed.params,
        parsed.query,
        ''  # Remove fragment
    ))
    return normalized

def encode_document_url(url: str) -> str:
    """Properly encode document URLs to handle spaces and special characters"""
    parsed = urlparse(url)
    # Encode the path part, preserving the directory structure
    encoded_path = quote(parsed.path, safe='/')
    encoded_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        encoded_path,
        parsed.params,
        parsed.query,
        parsed.fragment
    ))
    return encoded_url

def calculate_page_priority(url: str, title: str) -> int:
    """Calculate priority score for a page based on URL and title"""
    text = (url + ' ' + title).lower()
    priority = 0
    
    for category, config in HIGH_PRIORITY_PATTERNS.items():
        if any(keyword in text for keyword in config['keywords']):
            priority += config['weight']
    
    return priority

async def scrape_page_content(url: str, visited: Set[str], max_depth: int, current_depth: int = 0) -> List[Dict]:
    """Recursively scrape a page and its links"""
    from loguru import logger
    
    if current_depth >= max_depth or url in visited:
        return []
    
    visited.add(url)
    results = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, and navigation elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'iframe']):
            tag.decompose()
        
        # Extract page title
        page_title = soup.find('title')
        title = page_title.get_text(strip=True) if page_title else urlparse(url).path
        
        # Extract meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        description = meta_desc.get('content', '') if meta_desc else ''
        
        # Extract all text content with structure
        sections = []
        
        # Find all headings and their content
        for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            heading_text = heading.get_text(strip=True)
            if not heading_text:
                continue
            
            # Get content following this heading
            content_parts = []
            for sibling in heading.find_next_siblings():
                if sibling.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                    break
                if sibling.name in ['p', 'div', 'span', 'li', 'td']:
                    text = sibling.get_text(strip=True)
                    if text:
                        content_parts.append(text)
            
            if content_parts:
                sections.append({
                    'heading': heading_text,
                    'content': ' '.join(content_parts),
                    'level': int(heading.name[1])
                })
        
        # Extract all paragraphs if no sections found
        if not sections:
            paragraphs = soup.find_all('p')
            content = ' '.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
            if content:
                sections.append({
                    'heading': title,
                    'content': content,
                    'level': 1
                })
        
        # Extract tables
        tables = []
        for idx, table in enumerate(soup.find_all('table')):
            rows = []
            for tr in table.find_all('tr'):
                cells = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
                if cells:
                    rows.append(cells)
            if rows:
                tables.append({'index': idx, 'rows': rows})
        
        # Extract links and documents
        links = []
        documents = []  # PDFs, images for extraction
        base_domain = urlparse(url).netloc
        seen_urls = set()
        
        # Calculate priority for current page
        page_priority = calculate_page_priority(url, title)
        is_high_priority_page = page_priority >= 75
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(url, href)
            full_url = normalize_url(full_url)  # Normalize to prevent duplicates
            link_text = link.get_text(strip=True)
            
            # Parse the URL
            parsed = urlparse(full_url)
            
            if parsed.netloc == base_domain and parsed.scheme in ['http', 'https'] and full_url not in seen_urls:
                seen_urls.add(full_url)
                
                # Check if it's a document
                if full_url.lower().endswith(('.pdf', '.doc', '.docx')):
                    doc_priority = calculate_page_priority(full_url, link_text)
                    documents.append({
                        'text': link_text or parsed.path.split('/')[-1],
                        'url': full_url,
                        'type': 'pdf' if full_url.endswith('.pdf') else 'document',
                        'priority': doc_priority
                    })
                elif full_url.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                    # Check if it's an informational image (like placement statistics)
                    if is_high_priority_page or any(kw in link_text.lower() for kw in ['placement', 'statistics', 'data', 'info']):
                        documents.append({
                            'text': link_text or parsed.path.split('/')[-1],
                            'url': full_url,
                            'type': 'image',
                            'priority': page_priority
                        })
                elif not full_url.endswith(('.zip', '.exe', '.rar')):
                    # Regular page link
                    link_priority = calculate_page_priority(full_url, link_text)
                    links.append({
                        'text': link_text or parsed.path.split('/')[-1] or 'Link',
                        'url': full_url,
                        'priority': link_priority
                    })
        
        # Extract contact information
        emails = set()
        phones = set()
        
        # Find emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails.update(re.findall(email_pattern, response.text))
        
        # Find phone numbers
        phone_pattern = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phones.update(re.findall(phone_pattern, response.text))
        
        # Extract documents (PDFs and images) - PLACEMENT PAGES GET MAXIMUM EXTRACTION!
        extracted_documents = []
        is_placement_page = calculate_page_priority(url, title) >= 150
        
        # For placement pages, extract MORE documents
        max_docs = 30 if is_placement_page else 15 if is_high_priority_page else 0
        
        if (is_high_priority_page or is_placement_page) and documents:
            logger.info(f"{'🎯 PLACEMENT' if is_placement_page else 'High-priority'} page detected: {title}. Extracting up to {max_docs} documents...")
            
            # Sort documents by priority
            documents.sort(key=lambda x: x['priority'], reverse=True)
            
            # Extract documents based on page priority
            for doc in documents[:max_docs]:
                try:
                    if doc['type'] == 'pdf':
                        logger.info(f"Extracting PDF: {doc['text']}")
                        pdf_text, pdf_metadata = await extract_pdf_text(doc['url'])
                        
                        if pdf_text:
                            # Check if PDF contains placement data
                            placement_data = extract_placement_data(pdf_text)
                            
                            # Check recency for circulars
                            is_recent, doc_date = is_recent_document(pdf_text, doc['text'])
                            
                            # Only save if recent or contains valuable data
                            if is_recent or placement_data['companies'] or placement_data['packages']:
                                extracted_documents.append({
                                    'url': doc['url'],
                                    'title': doc['text'],
                                    'type': 'pdf',
                                    'text': pdf_text[:5000],  # Limit text size
                                    'metadata': pdf_metadata,
                                    'placementData': placement_data if any(placement_data.values()) else None,
                                    'documentDate': doc_date.isoformat() if doc_date else None,
                                    'isRecent': is_recent
                                })
                                logger.info(f"✓ Extracted PDF: {doc['text']} ({'recent' if is_recent else 'archived'})")
                            else:
                                logger.info(f"⊘ Skipped old PDF: {doc['text']}")
                    
                    elif doc['type'] == 'image':
                        logger.info(f"Extracting image: {doc['text']}")
                        img_text, img_metadata = await extract_image_text(doc['url'])
                        
                        if img_text:
                            placement_data = extract_placement_data(img_text)
                            
                            extracted_documents.append({
                                'url': doc['url'],
                                'title': doc['text'],
                                'type': 'image',
                                'text': img_text[:2000],
                                'metadata': img_metadata,
                                'placementData': placement_data if any(placement_data.values()) else None
                            })
                            logger.info(f"✓ Extracted image text: {doc['text']}")
                
                except Exception as e:
                    logger.error(f"Failed to extract {doc['type']}: {doc['url']} - {e}")
                    continue
        
        # Create page entry
        page_data = {
            'url': url,
            'pageTitle': title,
            'metaDescription': description,
            'sections': sections,
            'tables': tables,
            'links': [{'text': l['text'], 'url': l['url']} for l in sorted(links, key=lambda x: x['priority'], reverse=True)[:60]],
            'documents': documents[:20],  # Store document links
            'extractedDocuments': extracted_documents,  # Store extracted content
            'contactInfo': {
                'emails': list(emails)[:10],
                'phones': [p if isinstance(p, str) else ''.join(p) for p in list(phones)[:10]]
            },
            'priority': page_priority,
            'isHighPriority': is_high_priority_page,
            'scrapedAt': datetime.utcnow().isoformat(),
            'depth': current_depth
        }
        
        results.append(page_data)
        logger.info(f"✓ Scraped: {title} ({len(sections)} sections, {len(tables)} tables, {len(extracted_documents)} docs extracted, priority: {page_priority})")
        
        # Recursively scrape linked pages with PLACEMENT-FIRST approach
        if current_depth < max_depth - 1:
            # Sort links by priority score
            links.sort(key=lambda x: x['priority'], reverse=True)
            
            # Separate placement links for special treatment
            placement_links = [l['url'] for l in links if l['priority'] >= 150]
            high_priority_links = [l['url'] for l in links if 75 <= l['priority'] < 150]
            medium_priority_links = [l['url'] for l in links if 50 <= l['priority'] < 75]
            low_priority_links = [l['url'] for l in links if l['priority'] < 50]
            
            # PLACEMENT LINKS GET PRIORITY: Follow MORE placement links
            links_to_follow = placement_links[:50] + high_priority_links[:30] + medium_priority_links[:10] + low_priority_links[:5]
            
            logger.info(f"Following {len(links_to_follow)} links: {len(high_priority_links[:40])} high-priority, {len(medium_priority_links[:15])} medium, {len(low_priority_links[:5])} low")
            
            for link_url in links_to_follow:
                link_url = normalize_url(link_url)  # Normalize before checking visited
                if link_url not in visited and len(visited) < 250:  # Increased limit for priority pages
                    try:
                        sub_results = await scrape_page_content(link_url, visited, max_depth, current_depth + 1)
                        results.extend(sub_results)
                    except Exception as e:
                        logger.warning(f"Failed to scrape {link_url}: {str(e)}")
                else:
                    if link_url in visited:
                        logger.debug(f"Skipping already visited: {link_url}")

            
            for link_url in links_to_follow:
                if link_url not in visited and len(visited) < 200:  # Safety limit
                    try:
                        sub_results = await scrape_page_content(link_url, visited, max_depth, current_depth + 1)
                        results.extend(sub_results)
                    except Exception as e:
                        logger.warning(f"Failed to scrape {link_url}: {str(e)}")
        
        return results
        
    except Exception as e:
        logger.error(f"Error scraping {url}: {str(e)}")
        return []

def classify_content(title: str, content: str, url: str) -> Dict[str, any]:
    """Classify content based on keywords and return detailed classification"""
    text = (title + ' ' + content + ' ' + url).lower()
    
    # Find all matching categories (a page can belong to multiple)
    categories = []
    confidence = {}
    
    for category, keywords in CLASSIFICATION_KEYWORDS.items():
        matches = sum(1 for keyword in keywords if keyword in text)
        if matches > 0:
            categories.append(category)
            confidence[category] = matches
    
    # Primary category is the one with most matches
    primary_category = max(confidence.items(), key=lambda x: x[1])[0] if confidence else 'general'
    
    # Determine content type from URL and title
    content_type = 'page'
    if 'pdf' in url.lower():
        content_type = 'document'
    elif any(word in title.lower() for word in ['news', 'announcement', 'notice']):
        content_type = 'announcement'
    elif any(word in title.lower() for word in ['event', 'workshop', 'seminar']):
        content_type = 'event'
    elif any(word in title.lower() for word in ['department', 'faculty', 'staff']):
        content_type = 'department'
    elif any(word in title.lower() for word in ['course', 'program', 'syllabus']):
        content_type = 'academic'
    
    return {
        'primary': primary_category,
        'categories': categories,
        'type': content_type,
        'confidence': confidence
    }

@router.post("/api/scrape/website")
async def scrape_entire_website(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Scrape entire college website for knowledge base"""
    from loguru import logger
    
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    url = request_data.get("url")
    max_depth = request_data.get("maxDepth", 3)  # Default: 3 levels deep
    auto_save = request_data.get("autoSave", True)
    
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    logger.info(f"Starting comprehensive scrape of: {url} (max depth: {max_depth})")
    
    try:
        visited = set()
        pages = await scrape_page_content(url, visited, max_depth)
        
        if not pages:
            raise HTTPException(status_code=404, detail="No content found on the website")
        
        logger.info(f"Successfully scraped {len(pages)} pages")
        
        # Save to knowledge base with duplicate detection
        if auto_save:
            db = get_database()
            saved_count = 0
            updated_count = 0
            skipped_duplicates = 0
            docs_extracted = 0
            
            # Track content hashes to detect duplicate content
            existing_hashes = set()
            existing_docs = db.knowledge_base.find({}, {'contentHash': 1})
            async for doc in existing_docs:
                if 'contentHash' in doc:
                    existing_hashes.add(doc['contentHash'])
            
            # Group by category for summary
            category_counts = {}
            priority_counts = {'high': 0, 'medium': 0, 'low': 0}
            
            for page in pages:
                # Classify the page
                full_content = ' '.join([s['content'] for s in page['sections']])
                
                # Add extracted document text to content
                if page.get('extractedDocuments'):
                    for doc in page['extractedDocuments']:
                        full_content += ' ' + doc.get('text', '')
                        docs_extracted += 1
                
                classification = classify_content(page['pageTitle'], full_content, page['url'])
                
                # Calculate content hash for duplicate detection
                content_hash = calculate_content_hash(full_content)
                
                # Check for duplicate content
                if is_duplicate_content(content_hash, existing_hashes):
                    logger.info(f"⊘ Skipping duplicate content: {page['pageTitle']}")
                    skipped_duplicates += 1
                    continue
                
                # Track category counts
                primary = classification['primary']
                category_counts[primary] = category_counts.get(primary, 0) + 1
                
                # Track priority counts
                if page.get('priority', 0) >= 75:
                    priority_counts['high'] += 1
                elif page.get('priority', 0) >= 50:
                    priority_counts['medium'] += 1
                else:
                    priority_counts['low'] += 1
                
                # Check if page URL already exists
                existing = await db.knowledge_base.find_one({'url': normalize_url(page['url'])})
                
                # Prepare document with rich metadata
                document = {
                    **page,
                    'url': normalize_url(page['url']),
                    'category': classification['primary'],
                    'categories': classification['categories'],
                    'contentType': classification['type'],
                    'tags': list(set(classification['categories'] + [classification['type']])),
                    'confidence': classification['confidence'],
                    'contentHash': content_hash,
                    'wordCount': len(full_content.split()),
                    'hasContact': len(page['contactInfo']['emails']) > 0 or len(page['contactInfo']['phones']) > 0,
                    'hasTables': len(page['tables']) > 0,
                    'hasDocuments': len(page.get('extractedDocuments', [])) > 0,
                    'documentCount': len(page.get('extractedDocuments', [])),
                    'linkCount': len(page['links']),
                    'updatedAt': datetime.utcnow(),
                    'updatedBy': current_user.get('email')
                }
                
                # Add placement data if available
                if page.get('extractedDocuments'):
                    placement_data_list = [doc.get('placementData') for doc in page['extractedDocuments'] if doc.get('placementData')]
                    if placement_data_list:
                        # Merge all placement data
                        merged_placement = {
                            'companies': [],
                            'packages': [],
                            'student_counts': [],
                            'years': [],
                            'statistics': {}
                        }
                        for pd in placement_data_list:
                            for key in ['companies', 'packages', 'student_counts', 'years']:
                                merged_placement[key].extend(pd.get(key, []))
                            if pd.get('statistics'):
                                merged_placement['statistics'].update(pd['statistics'])
                        
                        # Remove duplicates
                        for key in ['companies', 'packages', 'years']:
                            merged_placement[key] = list(set(merged_placement[key]))
                        
                        document['placementData'] = merged_placement
                
                if existing:
                    # Update existing entry only if content changed
                    if existing.get('contentHash') != content_hash:
                        await db.knowledge_base.update_one(
                            {'url': normalize_url(page['url'])},
                            {'$set': document}
                        )
                        updated_count += 1
                        existing_hashes.add(content_hash)
                        logger.info(f"✓ Updated: {page['pageTitle']}")
                    else:
                        logger.info(f"⊘ No changes: {page['pageTitle']}")
                        skipped_duplicates += 1
                else:
                    # Create new entry
                    document['createdAt'] = datetime.utcnow()
                    document['createdBy'] = current_user.get('email')
                    await db.knowledge_base.insert_one(document)
                    saved_count += 1
                    existing_hashes.add(content_hash)
                    logger.info(f"✓ Saved new: {page['pageTitle']}")
            
            logger.info(f"✓ Saved {saved_count} new pages, updated {updated_count} pages, skipped {skipped_duplicates} duplicates")
            logger.info(f"✓ Category distribution: {category_counts}")
            logger.info(f"✓ Priority distribution: {priority_counts}")
            logger.info(f"✓ Documents extracted: {docs_extracted}")
            
            return {
                'success': True,
                'message': f'Successfully scraped and saved {len(pages)} pages ({saved_count} new, {updated_count} updated, {skipped_duplicates} duplicates)',
                'pages': pages,
                'stats': {
                    'totalPages': len(pages),
                    'newPages': saved_count,
                    'updatedPages': updated_count,
                    'skippedDuplicates': skipped_duplicates,
                    'documentsExtracted': docs_extracted,
                    'categoryBreakdown': category_counts,
                    'priorityBreakdown': priority_counts
                }
            }
        
        return {
            'success': True,
            'message': f'Successfully scraped {len(pages)} pages',
            'pages': pages,
            'stats': {
                'totalPages': len(pages)
            }
        }
        
    except Exception as e:
        logger.error(f"Website scraping error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@router.get("/api/scrape/config")
async def get_scrape_config(current_user: dict = Depends(get_current_user)):
    """Get scraping configuration"""
    
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    config = await db.scrape_config.find_one({'type': 'scraping'})
    
    if not config:
        return {
            'url': '',
            'enabled': False,
            'schedule': '0 */6 * * *',
            'selectors': {}
        }
    
    return {
        'url': config.get('url', ''),
        'enabled': config.get('enabled', False),
        'schedule': config.get('schedule', '0 */6 * * *'),
        'selectors': config.get('selectors', {})
    }

@router.post("/api/scrape/config")
async def save_scrape_config(
    config_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save scraping configuration"""
    
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    config = {
        'type': 'scraping',
        'url': config_data.get('url', ''),
        'enabled': config_data.get('enabled', False),
        'schedule': config_data.get('schedule', '0 */6 * * *'),
        'selectors': config_data.get('selectors', {}),
        'updatedAt': datetime.utcnow(),
        'updatedBy': current_user.get('email')
    }
    
    await db.scrape_config.update_one(
        {'type': 'scraping'},
        {'$set': config},
        upsert=True
    )
    
    return {
        'message': 'Configuration saved successfully',
        'config': config
    }
