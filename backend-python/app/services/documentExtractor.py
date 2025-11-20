"""
Document extraction utilities for PDFs and images
"""
import io
import re
import hashlib
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
from urllib.parse import quote, urlparse, urlunparse
import httpx
import PyPDF2
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes
from loguru import logger


# Placement-specific extraction patterns - COMPREHENSIVE!
PLACEMENT_PATTERNS = {
    'package': r'(\d+\.?\d*)\s*(lpa|lakhs?|cr|crores?|ctc|per\s*annum)',
    'company': r'(?:company|companies|recruiter|employer|organization)s?\s*[:-]?\s*([A-Z][A-Za-z0-9\s&,\.\-]+?)(?=\.|,|\n|$)',
    'students': r'(\d+)\s*(?:students?|candidates?|scholars?)\s*(?:placed|selected|offered|recruited|hired)',
    'year': r'(?:20\d{2})(?:-\d{2})?|(?:academic\s*year|ay|batch)\s*[:-]?\s*(\d{4})',
    'percentage': r'(\d+(?:\.\d+)?)\s*%\s*(?:placement|placed|students?\s*placed)',
    'offers': r'(\d+)\s*(?:offer|offers)\s*(?:received|made|extended)',
    'avg_package': r'(?:average|avg|mean)\s*(?:package|salary|ctc)\s*[:-]?\s*(\d+\.?\d*)\s*(lpa|lakhs?)',
    'highest_package': r'(?:highest|maximum|max|top)\s*(?:package|salary|ctc)\s*[:-]?\s*(\d+\.?\d*)\s*(lpa|lakhs?|cr|crores?)',
}


async def extract_pdf_text(pdf_url: str, max_pages: int = 50) -> Tuple[str, Dict]:
    """Extract text from PDF with metadata"""
    try:
        # Properly encode URL to handle spaces and special characters
        parsed = urlparse(pdf_url)
        # Encode the path part, keeping the structure
        encoded_path = quote(parsed.path, safe='/')
        encoded_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            encoded_path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        async with httpx.AsyncClient(timeout=60.0, headers=headers, follow_redirects=True) as client:
            response = await client.get(encoded_url)
            response.raise_for_status()
            
        pdf_bytes = io.BytesIO(response.content)
        reader = PyPDF2.PdfReader(pdf_bytes)
        
        metadata = {
            'num_pages': len(reader.pages),
            'size_bytes': len(response.content),
            'extracted_pages': min(len(reader.pages), max_pages)
        }
        
        text = ""
        for i, page in enumerate(reader.pages[:max_pages]):
            try:
                page_text = page.extract_text()
                if page_text:
                    text += f"\n--- Page {i+1} ---\n{page_text}\n"
            except Exception as e:
                logger.warning(f"Failed to extract page {i+1}: {e}")
                continue
        
        logger.info(f"Extracted {len(text)} characters from PDF: {pdf_url}")
        return text.strip(), metadata
        
    except Exception as e:
        logger.error(f"PDF extraction failed for {pdf_url}: {e}")
        return "", {'error': str(e)}


async def extract_image_text(image_url: str) -> Tuple[str, Dict]:
    """Extract text from image using OCR"""
    try:
        # Properly encode URL to handle spaces and special characters
        parsed = urlparse(image_url)
        encoded_path = quote(parsed.path, safe='/')
        encoded_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            encoded_path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        async with httpx.AsyncClient(timeout=60.0, headers=headers, follow_redirects=True) as client:
            response = await client.get(encoded_url)
            response.raise_for_status()
            
        image = Image.open(io.BytesIO(response.content))
        
        metadata = {
            'format': image.format,
            'size': image.size,
            'mode': image.mode,
            'size_bytes': len(response.content)
        }
        
        # Preprocess image for better OCR
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        text = pytesseract.image_to_string(image, lang='eng')
        
        logger.info(f"Extracted {len(text)} characters from image: {image_url}")
        return text.strip(), metadata
        
    except Exception as e:
        logger.error(f"Image OCR failed for {image_url}: {e}")
        return "", {'error': str(e)}


def extract_placement_data(text: str) -> Dict:
    """Extract structured placement data from text - COMPREHENSIVE!"""
    placement_info = {
        'packages': [],
        'companies': [],
        'student_counts': [],
        'years': [],
        'placement_percentages': [],
        'offer_counts': [],
        'statistics': {}
    }
    
    # Extract salary packages (all mentions)
    packages = re.findall(PLACEMENT_PATTERNS['package'], text, re.IGNORECASE)
    placement_info['packages'] = [f"{amount} {unit.upper()}" for amount, unit in packages]
    
    # Extract specific highest package
    highest = re.search(PLACEMENT_PATTERNS['highest_package'], text, re.IGNORECASE)
    if highest:
        placement_info['statistics']['highest_package'] = f"{highest.group(1)} {highest.group(2).upper()}"
    
    # Extract specific average package
    average = re.search(PLACEMENT_PATTERNS['avg_package'], text, re.IGNORECASE)
    if average:
        placement_info['statistics']['average_package'] = f"{average.group(1)} {average.group(2).upper()}"
    
    # Extract company names - more aggressive matching
    companies = re.findall(PLACEMENT_PATTERNS['company'], text, re.IGNORECASE)
    # Also try to find company names in lists (e.g., "TCS, Infosys, Wipro")
    company_list_pattern = r'(?:companies?|recruiters?|employers?|visited)\s*[:-]?\s*([A-Z][A-Za-z0-9\s,&\.\-]+?)(?=\.\s*[A-Z]|\.\n|;|Total|Highest|Average|Placement)'
    company_lists = re.findall(company_list_pattern, text, re.IGNORECASE)
    
    all_companies = []
    for c in companies:
        all_companies.extend([name.strip() for name in c.split(',') if len(name.strip()) > 2])
    for cl in company_lists:
        all_companies.extend([name.strip() for name in cl.split(',') if len(name.strip()) > 2])
    
    # Filter out common non-company words
    excluded_words = ['total', 'students', 'placed', 'package', 'offers', 'received', 'year', 'average', 'highest']
    placement_info['companies'] = list(set([c for c in all_companies if len(c) > 2 and not c.isdigit() and c.lower() not in excluded_words]))
    
    # Extract student counts - match multiple patterns
    students = re.findall(PLACEMENT_PATTERNS['students'], text, re.IGNORECASE)
    # Also look for "X out of Y students" pattern
    students_fraction = re.findall(r'(\d+)\s*out\s*of\s*\d+\s*students?', text, re.IGNORECASE)
    placement_info['student_counts'] = [int(s) for s in students] + [int(s) for s in students_fraction]
    
    # Extract placement percentages - flexible pattern
    percentages = re.findall(PLACEMENT_PATTERNS['percentage'], text, re.IGNORECASE)
    # Also try standalone percentage near "placement" keyword
    standalone_percent = re.findall(r'(\d+(?:\.\d+)?)\s*%', text)
    placement_info['placement_percentages'] = [float(p) for p in percentages] + [float(p) for p in standalone_percent if 50 <= float(p) <= 100]
    
    # Extract offer counts
    offers = re.findall(PLACEMENT_PATTERNS['offers'], text, re.IGNORECASE)
    placement_info['offer_counts'] = [int(o) for o in offers]
    
    # Extract years
    years = re.findall(PLACEMENT_PATTERNS['year'], text, re.IGNORECASE)
    placement_info['years'] = sorted(list(set([y for y in years if y])), reverse=True)
    
    # Calculate comprehensive statistics
    if placement_info['student_counts']:
        placement_info['statistics']['total_placed'] = sum(placement_info['student_counts'])
        placement_info['statistics']['max_placed'] = max(placement_info['student_counts'])
        placement_info['statistics']['avg_placed'] = sum(placement_info['student_counts']) / len(placement_info['student_counts'])
    
    if placement_info['placement_percentages']:
        placement_info['statistics']['placement_percentage'] = max(placement_info['placement_percentages'])
    
    if placement_info['offer_counts']:
        placement_info['statistics']['total_offers'] = sum(placement_info['offer_counts'])
    
    if placement_info['packages']:
        # Extract numeric values for analysis
        numeric_packages = []
        for pkg in placement_info['packages']:
            match = re.search(r'(\d+\.?\d*)', pkg)
            if match:
                value = float(match.group(1))
                if 'CR' in pkg.upper():
                    value *= 100  # Convert crores to lakhs
                numeric_packages.append(value)
        
        if numeric_packages:
            if 'highest_package' not in placement_info['statistics']:
                placement_info['statistics']['highest_package_lpa'] = max(numeric_packages)
            if 'average_package' not in placement_info['statistics']:
                placement_info['statistics']['avg_package_lpa'] = sum(numeric_packages) / len(numeric_packages)
    
    placement_info['statistics']['company_count'] = len(placement_info['companies'])
    placement_info['statistics']['data_richness'] = 'high' if len(placement_info['companies']) > 5 else 'medium' if len(placement_info['companies']) > 0 else 'low'
    
    return placement_info


def extract_date_from_text(text: str) -> Optional[datetime]:
    """Extract date from text for recency detection"""
    date_patterns = [
        r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})',  # DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})',  # YYYY-MM-DD
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})',  # Month DD, YYYY
        r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})',  # DD Month YYYY
    ]
    
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                groups = match.groups()
                if '-' in match.group(0) or '/' in match.group(0) or '.' in match.group(0):
                    parts = re.split(r'[-/.]', match.group(0))
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        return datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                    else:  # DD-MM-YYYY
                        return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                else:
                    # Month name format
                    if groups[0].isalpha():  # Month DD, YYYY
                        month = month_map.get(groups[0][:3].lower())
                        if month:
                            return datetime(int(groups[2]), month, int(groups[1]))
                    elif groups[1].isalpha():  # DD Month YYYY
                        month = month_map.get(groups[1][:3].lower())
                        if month:
                            return datetime(int(groups[2]), month, int(groups[0]))
            except Exception as e:
                logger.debug(f"Date parsing failed for {match.group(0)}: {e}")
                continue
    
    return None


def is_recent_document(text: str, title: str = "", days_threshold: int = 180) -> Tuple[bool, Optional[datetime]]:
    """Check if document is recent (within threshold days)"""
    combined_text = f"{title} {text[:1000]}"  # Check first 1000 chars for date
    date = extract_date_from_text(combined_text)
    
    if date:
        days_old = (datetime.now() - date).days
        is_recent = days_old <= days_threshold
        logger.info(f"Document date: {date.strftime('%Y-%m-%d')}, {days_old} days old, recent: {is_recent}")
        return is_recent, date
    
    # If no date found, assume it might be recent (include it)
    logger.debug("No date found in document, assuming recent")
    return True, None


def calculate_content_hash(content: str) -> str:
    """Calculate hash of content for duplicate detection"""
    # Normalize content: lowercase, remove extra whitespace
    normalized = re.sub(r'\s+', ' ', content.lower()).strip()
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()


def is_duplicate_content(content_hash: str, existing_hashes: set) -> bool:
    """Check if content hash already exists"""
    return content_hash in existing_hashes
