"""
Hybrid AI Chatbot Service
Combines ML-trained models with Google Gemini for intelligent responses
"""

import google.generativeai as genai
from typing import List, Dict, Any, Optional
from loguru import logger
from googlesearch import search
import requests
from bs4 import BeautifulSoup

from app.config import settings
from app.database import get_database, map_documents
from app.ml.embeddings import EmbeddingService
from app.ml.content_classifier import ContentClassifier

# Lazy import RAG service to avoid import issues
rag_service = None
try:
    from app.services.ragService import rag_service as _rag
    rag_service = _rag
except Exception as e:
    logger.warning(f"RAG service not available: {e}")


class HybridChatbot:
    """
    Hybrid chatbot that uses:
    1. ML embeddings for semantic search in knowledge base
    2. Trained classifier for content understanding
    3. Google Gemini for natural language generation
    4. Web search for queries not in knowledge base
    """
    
    def __init__(self, embeddings: EmbeddingService, classifier: ContentClassifier):
        self.embeddings = embeddings
        self.classifier = classifier
        
        # Configure Gemini
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Models to try (with fallbacks) - using only valid model names
        self.models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ]
    
    async def search_web(self, query: str, num_results: int = 3) -> str:
        """
        Search the web for information about BMSIT
        
        Args:
            query: Search query
            num_results: Number of results to fetch
            
        Returns:
            Formatted web search results
        """
        try:
            # Add BMSIT context to the search query
            search_query = f"BMSIT BMS Institute of Technology {query}"
            logger.info(f"🌐 Searching web for: {search_query}")
            
            results = []
            search_results = search(search_query, num_results=num_results, lang='en', sleep_interval=1)
            
            for idx, url in enumerate(search_results, 1):
                try:
                    # Fetch and parse the page
                    response = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Extract text from paragraphs
                    paragraphs = soup.find_all('p', limit=5)
                    text_content = ' '.join([p.get_text().strip() for p in paragraphs if p.get_text().strip()])
                    
                    if text_content:
                        results.append(f"\n🔗 Source {idx}: {url}\n{text_content[:500]}...")
                    
                    if idx >= num_results:
                        break
                        
                except Exception as e:
                    logger.warning(f"Error fetching {url}: {e}")
                    continue
            
            if results:
                web_context = "\n📡 WEB SEARCH RESULTS:\n" + "\n".join(results)
                logger.info(f"✅ Found {len(results)} web results")
                return web_context
            else:
                logger.warning("No web results found")
                return ""
                
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return ""
    
    async def build_knowledge_context(
        self,
        query: str,
        category: Optional[str] = None,
        use_ml_search: bool = True
    ) -> str:
        """
        Build knowledge base context for the chatbot
        Uses ML-powered semantic search and classification across ALL collections
        
        Args:
            query: User's query
            category: Optional category filter
            use_ml_search: Whether to use ML semantic search
            
        Returns:
            Formatted knowledge base string
        """
        # Get database instance
        db = get_database()
        
        knowledge_parts = []
        query_lower = query.lower()
        
        # Detect query intent based on EXPANDED keywords for better coverage
        is_timetable_query = any(word in query_lower for word in ['timetable', 'time table', 'schedule', 'class', 'lecture', 'timing', 'time-table', 'period', 'routine', 'classes when'])
        is_exam_query = any(word in query_lower for word in ['exam', 'examination', 'test', 'midterm', 'final', 'assessment', 'evaluation', 'quiz', 'internal', 'semester exam'])
        is_holiday_query = any(word in query_lower for word in ['holiday', 'vacation', 'break', 'leave', 'off', 'closed', 'reopen', 'working day'])
        is_document_query = any(word in query_lower for word in ['document', 'file', 'pdf', 'syllabus', 'notes', 'material', 'resource', 'download', 'circular', 'form'])
        is_event_query = any(word in query_lower for word in ['event', 'fest', 'competition', 'workshop', 'seminar', 'webinar', 'conference', 'symposium', 'hackathon', 'cultural'])
        is_placement_query = any(word in query_lower for word in ['placement', 'placed', 'package', 'salary', 'company', 'ctc', 'job', 'recruit', 'hiring', 'offer', 'campus placement', 'interview', 'training'])
        is_announcement_query = any(word in query_lower for word in ['announcement', 'notice', 'update', 'news', 'notification', 'circular', 'information', 'latest'])
        is_autonomous_query = any(word in query_lower for word in ['syllabus', 'scheme', 'autonomous', 'curriculum', 'regulation', 'policy', 'assessment', 'marks', 'grading', 'evaluation'])
        is_academic_council_query = any(word in query_lower for word in ['hod', 'head', 'dean', 'principal', 'chairperson', 'professor', 'academic council', 'faculty', 'member secretary', 'teacher', 'staff', 'coordinator'])
        is_general_query = any(word in query_lower for word in ['college', 'bmsit', 'institute', 'about', 'location', 'contact', 'address', 'email', 'phone', 'campus'])
        is_admission_query = any(word in query_lower for word in ['admission', 'admissions', 'apply', 'eligibility', 'fee', 'fees', 'seat', 'intake', 'kcet', 'comedk', 'enroll'])
        
        # 1. TIMETABLES - Check if query is about schedules
        if is_timetable_query:
            # First check knowledge_base for timetable links
            timetable_doc = await db.knowledge_base.find_one({"type": "timetable_links"})
            if timetable_doc:
                timetable_doc = map_documents([timetable_doc])[0]
                knowledge_parts.append("📅 BMSIT Timetables 2025-26:\n")
                
                # Extract department code from query
                dept_keywords = {
                    'cse': 'CSE', 'computer science': 'CSE',
                    'ise': 'ISE', 'information science': 'ISE',
                    'aiml': 'AIML', 'ai': 'AIML', 'ml': 'AIML', 'artificial intelligence': 'AIML',
                    'csbs': 'CSBS', 'business systems': 'CSBS',
                    'ece': 'ECE', 'electronics and communication': 'ECE',
                    'eee': 'EEE', 'electrical': 'EEE',
                    'ete': 'ETE', 'telecommunication': 'ETE',
                    'mech': 'MECH', 'mechanical': 'MECH',
                    'civil': 'CIVIL',
                    'mca': 'MCA',
                    'mba': 'MBA',
                    'mtech': 'MTECH', 'm.tech': 'MTECH'
                }
                
                # Extract semester from query
                sem_match = None
                for word in ['1st', '3rd', '5th', '7th', 'first', 'third', 'fifth', 'seventh']:
                    if word in query_lower:
                        if 'first' in word or '1' in word:
                            sem_match = 1
                        elif 'third' in word or '3' in word:
                            sem_match = 3
                        elif 'fifth' in word or '5' in word:
                            sem_match = 5
                        elif 'seventh' in word or '7' in word:
                            sem_match = 7
                        break
                
                # Find matching department
                matching_dept = None
                for keyword, code in dept_keywords.items():
                    if keyword in query_lower:
                        matching_dept = code
                        break
                
                departments = timetable_doc.get('departments', [])
                
                if matching_dept or sem_match:
                    # Show specific department/semester
                    for dept in departments:
                        dept_code = dept.get('code', '')
                        if matching_dept and matching_dept in dept_code:
                            knowledge_parts.append(f"\n📚 {dept.get('name', '')} ({dept_code}):")
                            for sem in dept.get('semesters', []):
                                if sem_match is None or sem['semester'] == sem_match:
                                    knowledge_parts.append(f"   • Semester {sem['semester']}: {sem['url']}")
                        elif sem_match and not matching_dept:
                            # Show all departments for this semester
                            for sem in dept.get('semesters', []):
                                if sem['semester'] == sem_match:
                                    knowledge_parts.append(f"\n📚 {dept.get('name', '')} - Sem {sem['semester']}: {sem['url']}")
                else:
                    # Show all available timetables (limited)
                    knowledge_parts.append("\nAvailable Timetables by Department:")
                    for dept in departments[:5]:  # Show first 5 departments
                        knowledge_parts.append(f"\n📚 {dept.get('name', '')} ({dept.get('code', '')}):")
                        for sem in dept.get('semesters', []):
                            knowledge_parts.append(f"   • Semester {sem['semester']}: {sem['url']}")
                    
                    if len(departments) > 5:
                        knowledge_parts.append(f"\n...and {len(departments) - 5} more departments")
                    knowledge_parts.append(f"\nVisit: https://bmsit.ac.in/timetable for all timetables")
                
                knowledge_parts.append("")
            
            # Student timetables (custom uploaded)
            student_timetables = await db.student_timetables.find({}).limit(5).to_list(length=5)
            if student_timetables:
                student_timetables = map_documents(student_timetables)
                knowledge_parts.append("📚 Custom Student Timetables:\n")
                for idx, tt in enumerate(student_timetables[:3], 1):
                    knowledge_parts.append(f"{idx}. {tt.get('className', 'Class')}: {tt.get('semester', '')}")
                    if tt.get('schedule'):
                        knowledge_parts.append(f"   Schedule available")
                knowledge_parts.append("")
            
            # Teacher timetables
            teacher_timetables = await db.teachers_timetable.find({}).limit(5).to_list(length=5)
            
            if teacher_timetables:
                teacher_timetables = map_documents(teacher_timetables)
                knowledge_parts.append("👨‍🏫 Teacher Timetables:\n")
                for idx, tt in enumerate(teacher_timetables[:3], 1):
                    knowledge_parts.append(f"{idx}. {tt.get('teacherName', 'Teacher')}")
                knowledge_parts.append("")
        
        # 2. EXAMINATIONS
        if is_exam_query:
            examinations = await db.examinations.find({}).sort('date', -1).limit(5).to_list(length=5)
            if examinations:
                examinations = map_documents(examinations)
                knowledge_parts.append("📝 Examination Information:\n")
                for idx, exam in enumerate(examinations, 1):
                    knowledge_parts.append(f"{idx}. {exam.get('title', 'Exam')}")
                    knowledge_parts.append(f"   {exam.get('content', '')}")
                    if exam.get('date'):
                        knowledge_parts.append(f"   Date: {exam['date']}")
                knowledge_parts.append("")
        
        # 3. HOLIDAYS
        if is_holiday_query:
            holidays = await db.holidays.find({}).sort('date', -1).limit(10).to_list(length=10)
            if holidays:
                holidays = map_documents(holidays)
                knowledge_parts.append("🎉 Holidays:\n")
                for idx, holiday in enumerate(holidays, 1):
                    knowledge_parts.append(f"{idx}. {holiday.get('title', 'Holiday')}")
                    if holiday.get('date'):
                        knowledge_parts.append(f"   Date: {holiday['date']}")
                knowledge_parts.append("")
        
        # 3.5. AUTONOMOUS / SYLLABUS / SCHEME
        if is_autonomous_query:
            # Extract batch year from query
            batch_year = None
            for year in ['2021', '2022', '2023', '2024', '2025']:
                if year in query_lower:
                    batch_year = year
                    break
            
            # If no specific batch mentioned, try to find from context or default to 2021
            if not batch_year:
                # Default to 2021 for now
                batch_year = "2021"
            
            # Find autonomous data for the specific batch
            query_filter = {"type": "autonomous_info"}
            if batch_year:
                query_filter["batch"] = batch_year
            
            autonomous_doc = await db.knowledge_base.find_one(query_filter)
            
            if autonomous_doc:
                autonomous_doc = map_documents([autonomous_doc])[0]
                knowledge_parts.append(f"\n📚 BMSIT Autonomous - Scheme and Syllabus ({batch_year} Batch):\n")
                
                # Extract department and semester
                dept_keywords = {
                    'cse': 'CSE', 'computer science': 'CSE',
                    'ise': 'ISE', 'information science': 'ISE',
                    'aiml': 'AI&ML', 'ai': 'AI&ML', 'ml': 'AI&ML',
                    'ece': 'ECE', 'electronics and communication': 'ECE',
                    'eee': 'EEE', 'electrical': 'EEE',
                    'ete': 'ETE', 'telecommunication': 'ETE',
                    'mech': 'MECH', 'mechanical': 'MECH',
                    'civil': 'CIVIL',
                    'mca': 'MCA',
                    'mtech': 'M.Tech CSE', 'm.tech': 'M.Tech CSE'
                }
                
                sem_match = None
                for word in ['3rd', '4th', '5th', '6th', '7th', 'third', 'fourth', 'fifth', 'sixth', 'seventh']:
                    if word in query_lower:
                        if 'third' in word or '3' in word:
                            sem_match = "3rd Sem"
                        elif 'fourth' in word or '4' in word:
                            sem_match = "4th Sem"
                        elif 'fifth' in word or '5' in word:
                            sem_match = "5th Sem"
                        elif 'sixth' in word or '6' in word:
                            sem_match = "6th Sem"
                        elif 'seventh' in word or '7' in word:
                            sem_match = "7th Sem"
                        break
                
                matching_dept = None
                for keyword, code in dept_keywords.items():
                    if keyword in query_lower:
                        matching_dept = code
                        break
                
                # Show regulations if asked
                if any(word in query_lower for word in ['regulation', 'policy', 'rule']):
                    regulations = autonomous_doc.get('regulations', [])
                    if regulations:
                        knowledge_parts.append("📜 Regulations and Policies:")
                        for reg in regulations:
                            knowledge_parts.append(f"   • {reg['title']}: {reg['url']}")
                        knowledge_parts.append("")
                
                # Show syllabus/scheme
                departments = autonomous_doc.get('departments', [])
                if matching_dept or sem_match:
                    for dept in departments:
                        dept_name = dept.get('name', '')
                        if matching_dept and matching_dept == dept_name:
                            knowledge_parts.append(f"\n📖 {dept_name} Syllabus:")
                            semesters = dept.get('semesters', [])
                            if semesters:
                                for sem in semesters:
                                    if sem_match is None or sem['sem'] == sem_match:
                                        knowledge_parts.append(f"   • {sem['sem']}: {sem['url']}")
                        elif sem_match and not matching_dept:
                            semesters = dept.get('semesters', [])
                            for sem in semesters:
                                if sem['sem'] == sem_match:
                                    knowledge_parts.append(f"\n📖 {dept_name} - {sem['sem']}: {sem['url']}")
                else:
                    # Show available batches and general info
                    knowledge_parts.append("\nAvailable Batches: 2021, 2022, 2023, 2024, 2025")
                    knowledge_parts.append("Available Departments:")
                    for dept in departments[:5]:  # Show first 5
                        knowledge_parts.append(f"   • {dept['name']}")
                    knowledge_parts.append("\nVisit: https://bmsit.ac.in/autonomous for complete details")
                
                knowledge_parts.append("")
        
        # 4. ACADEMIC COUNCIL - Check for HODs, Deans, Principal, etc.
        if is_academic_council_query:
            logger.info(f"Academic council query detected for: {query}")
            council_doc = await db.knowledge_base.find_one({"type": "academic_council"})
            if council_doc:
                logger.info("Academic council data found in database")
                council_doc = map_documents([council_doc])[0]
                knowledge_parts.append("👥 BMSIT Academic Council Members (2024-25 to 2026-27):\n")
                
                # Detect what user is asking for
                dept_keywords = {
                    'cse': 'CSE', 'computer science': 'CSE',
                    'ise': 'ISE', 'information science': 'ISE',
                    'aiml': 'AIML', 'ai': 'AIML', 'ml': 'AIML', 'artificial intelligence': 'AIML',
                    'csbs': 'CSBS', 'business systems': 'CSBS',
                    'ece': 'ECE', 'electronics and communication': 'ECE',
                    'eee': 'EEE', 'electrical': 'EEE',
                    'ete': 'ETE', 'telecommunication': 'ETE',
                    'mech': 'MECH', 'mechanical': 'MECH',
                    'civil': 'CIVIL',
                    'mca': 'MCA',
                    'mba': 'MBA'
                }
                
                query_dept = None
                for keyword, dept in dept_keywords.items():
                    if keyword in query_lower:
                        query_dept = dept
                        logger.info(f"Detected department: {query_dept}")
                        break
                
                # Check what role they're asking about
                is_principal_query = 'principal' in query_lower or 'chairperson' in query_lower
                is_hod_query = 'hod' in query_lower or 'head' in query_lower
                is_dean_query = 'dean' in query_lower
                is_vice_principal_query = 'vice principal' in query_lower
                
                logger.info(f"Query flags - HOD: {is_hod_query}, Dean: {is_dean_query}, Principal: {is_principal_query}, Dept: {query_dept}")
                
                # Principal/Chairperson
                if is_principal_query:
                    chairperson = council_doc.get('chairperson', {})
                    if chairperson:
                        knowledge_parts.append(f"🎓 Principal/Chairperson:")
                        knowledge_parts.append(f"   {chairperson.get('name', 'N/A')} - {chairperson.get('designation', '')}\n")
                
                # HOD Query
                if is_hod_query or query_dept:
                    deans_and_hods = council_doc.get('deans_and_hods', [])
                    if query_dept:
                        # Map abbreviations to full department names
                        dept_name_map = {
                            'CSE': ['Computer Science & Engineering', 'Computer Science and Engineering'],
                            'ISE': ['Information Science and Engineering', 'Information Science & Engineering'],
                            'AIML': ['Artificial Intelligence and Machine Learning'],
                            'CSBS': ['Computer Science and Business Systems'],
                            'ECE': ['Electronics and Communication Engineering'],
                            'EEE': ['Electrical and Electronics Engineering'],
                            'ETE': ['Electronics and Telecommunication Engineering'],
                            'MECH': ['Mechanical Engineering'],
                            'CIVIL': ['Civil Engineering'],
                            'MCA': ['Master of Computer Applications'],
                            'MBA': ['Master of Business Administration']
                        }
                        
                        # Find specific department HOD
                        found_hod = False
                        search_terms = dept_name_map.get(query_dept, [query_dept])
                        
                        for member in deans_and_hods:
                            dept_name = member.get('department', '')
                            designation = member.get('designation', '')
                            
                            # Check if any search term matches and designation contains HoD
                            is_match = any(term.lower() in dept_name.lower() for term in search_terms)
                            is_hod_designation = 'HoD' in designation or 'Head' in designation
                            
                            if is_match and is_hod_designation:
                                knowledge_parts.append(f"👨‍🏫 {query_dept} Department Head:")
                                knowledge_parts.append(f"   {member.get('name', 'N/A')}")
                                knowledge_parts.append(f"   {member.get('designation', '')}")
                                knowledge_parts.append(f"   {member.get('department', '')}\n")
                                found_hod = True
                                logger.info(f"Found HOD: {member.get('name', 'N/A')} for {query_dept}")
                                break
                        
                        if not found_hod:
                            logger.warning(f"No HOD found for department: {query_dept}")
                    else:
                        # Show all HODs
                        knowledge_parts.append("👨‍🏫 Department Heads (HODs):")
                        hod_count = 0
                        for member in deans_and_hods:
                            if 'HoD' in member.get('designation', '') or 'Head' in member.get('designation', ''):
                                knowledge_parts.append(f"   • {member.get('name', 'N/A')} - {member.get('department', '')}")
                                hod_count += 1
                        knowledge_parts.append("")
                        logger.info(f"Added {hod_count} HODs to knowledge context")
                
                # Dean Query
                if is_dean_query:
                    deans_and_hods = council_doc.get('deans_and_hods', [])
                    member_secretary = council_doc.get('member_secretary', {})
                    
                    knowledge_parts.append("🎓 Deans:")
                    # Vice Principal
                    if is_vice_principal_query or not is_dean_query:
                        for member in deans_and_hods:
                            if 'Vice Principal' in member.get('designation', ''):
                                knowledge_parts.append(f"   • Vice Principal: {member.get('name', 'N/A')} ({member.get('department', '')})")
                    
                    # Other Deans
                    for member in deans_and_hods:
                        if 'Dean' in member.get('designation', '') and 'Vice Principal' not in member.get('designation', ''):
                            knowledge_parts.append(f"   • {member.get('designation', '')}: {member.get('name', 'N/A')}")
                    
                    # Dean Academic Affairs (Member Secretary)
                    if member_secretary:
                        knowledge_parts.append(f"   • {member_secretary.get('designation', '')}: {member_secretary.get('name', 'N/A')}")
                    
                    knowledge_parts.append("")
                
                knowledge_parts.append("")
        
        # 5. DOCUMENTS - Enhanced search for student queries
        if is_document_query:
            try:
                # Build query filter based on keywords
                doc_filter = {}
                
                # Extract subject/topic from query
                query_words = query_lower.split()
                
                # Search for documents matching keywords
                documents = await db.documents.find(doc_filter).sort('uploadDate', -1).limit(20).to_list(length=20)
                
                if documents:
                    documents = map_documents(documents)
                    
                    # Use semantic search if embeddings available
                    relevant_docs = documents[:10]  # Default to first 10
                    
                    if self.embeddings and len(documents) > 5:
                        # Perform semantic search to find most relevant documents
                        relevant_docs = await self.embeddings.semantic_search(
                            query=query,
                            documents=documents,
                            top_k=10,
                            threshold=0.3  # Lower threshold for broader matches
                        )
                    
                    if relevant_docs:
                        knowledge_parts.append("\n📄 Available Documents:\n")
                        for idx, doc in enumerate(relevant_docs, 1):
                            doc_name = doc.get('originalname', doc.get('filename', 'Document'))
                            doc_type = doc.get('documentType', 'General')
                            subject = doc.get('subject', '')
                            semester = doc.get('semester', '')
                            branch = doc.get('branch', '')
                            description = doc.get('description', '')
                            doc_id = doc.get('id', doc.get('_id', ''))
                            
                            knowledge_parts.append(f"{idx}. {doc_name}")
                            if doc_type:
                                knowledge_parts.append(f"   Type: {doc_type}")
                            if subject:
                                knowledge_parts.append(f"   Subject: {subject}")
                            if semester:
                                knowledge_parts.append(f"   Semester: {semester}")
                            if branch:
                                knowledge_parts.append(f"   Branch: {branch}")
                            if description:
                                knowledge_parts.append(f"   Description: {description}")
                            
                            # Provide download link
                            knowledge_parts.append(f"   📥 Access: /api/documents/{doc_id}/download")
                            knowledge_parts.append("")
                        
                        logger.info(f"Found {len(relevant_docs)} relevant documents for query")
                    else:
                        knowledge_parts.append("\n📄 No documents found matching your query.\n")
                else:
                    knowledge_parts.append("\n📄 No documents available at the moment.\n")
            except Exception as e:
                logger.warning(f"Error fetching documents: {e}")
        
        # 6. PLACEMENTS (High Priority)
        if is_placement_query or not any([is_timetable_query, is_exam_query, is_holiday_query, is_document_query]):
            placements = await db.placements.find({}).sort('date', -1).limit(10).to_list(length=10)
            if placements:
                placements = map_documents(placements)
                knowledge_parts.append("💼 Placement Information:\n")
                for idx, placement in enumerate(placements, 1):
                    knowledge_parts.append(f"{idx}. {placement.get('title', '')}")
                    knowledge_parts.append(f"   {placement.get('content', '')}")
                knowledge_parts.append("")
        
        # 7. EVENTS
        if is_event_query or not any([is_timetable_query, is_exam_query, is_holiday_query]):
            events = await db.events.find({}).sort('date', -1).limit(5).to_list(length=5)
            if events:
                events = map_documents(events)
                knowledge_parts.append("📅 Upcoming Events:\n")
                for idx, event in enumerate(events, 1):
                    knowledge_parts.append(f"{idx}. {event.get('title', '')}")
                    knowledge_parts.append(f"   {event.get('content', '')}")
                knowledge_parts.append("")
        
        # 8. ANNOUNCEMENTS
        if is_announcement_query or not any([is_timetable_query, is_exam_query, is_holiday_query, is_document_query]):
            announcements_filter = {}
            if category:
                announcements_filter['category'] = category
            
            announcements = await db.announcements.find(announcements_filter).sort('date', -1).limit(15).to_list(length=15)
            if announcements:
                announcements = map_documents(announcements)
                knowledge_parts.append("📢 Campus Announcements:\n")
                for idx, ann in enumerate(announcements[:8], 1):
                    knowledge_parts.append(f"{idx}. {ann.get('title', '')}")
                    knowledge_parts.append(f"   {ann.get('content', '')}")
                    if ann.get('category'):
                        knowledge_parts.append(f"   Category: {ann['category']}")
                knowledge_parts.append("")
        
        # 9. KNOWLEDGE BASE - Search both collections with keyword intelligence
        try:
            # Check for admission-related keywords (expanded list)
            admission_keywords = ['admission', 'admissions', 'apply', 'application', 'eligibility', 
                                 'fee', 'fees', 'cost', 'tuition', 'payment', 'structure',
                                 'course', 'courses', 'program', 'programs', 'branch', 'branches', 
                                 'department', 'seat', 'seats', 'intake',
                                 'kcet', 'comedk', 'cet', 'management', 'quota',
                                 'document', 'documents', 'certificate', 'brochure', 'prospectus',
                                 'join', 'joining', 'enroll', 'enrollment', 'register']
            
            if any(keyword in query_lower for keyword in admission_keywords):
                # Search in knowledge_base collection
                admissions_doc = await db.knowledge_base.find_one({"category": "admissions"})
                
                if admissions_doc:
                    admissions_doc = map_documents([admissions_doc])[0]
                    knowledge_parts.append("\n🎓 ADMISSIONS INFORMATION:\n")
                    
                    # Extract relevant sections based on query
                    content = admissions_doc.get('content', {})
                    
                    # Fee-related queries (expanded detection)
                    if any(word in query_lower for word in ['fee', 'fees', 'cost', 'tuition', 'payment', 'structure', 'price', 'charges']):
                        knowledge_parts.append("💰 Fee Structure:")
                        for pdf in content.get('pdfLinks', []):
                            if 'fee' in pdf['name'].lower():
                                knowledge_parts.append(f"   📄 {pdf['name']}")
                                knowledge_parts.append(f"      Link: {pdf['url']}")
                        
                        # Mention management quota fee info
                        if any(word in query_lower for word in ['management', 'quota']):
                            knowledge_parts.append("\n   ℹ️  Management Quota Fee:")
                            knowledge_parts.append("      - View detailed fee structure PDF above")
                            knowledge_parts.append("      - Management quota requires 60% in PCM")
                        
                        knowledge_parts.append("")
                    
                    if any(word in query_lower for word in ['contact', 'phone', 'email', 'reach']):
                        contact = content.get('contact', {})
                        knowledge_parts.append("📞 Contact Information:")
                        knowledge_parts.append(f"   Phone: {contact.get('phone', 'N/A')}")
                        knowledge_parts.append(f"   Email: {contact.get('email', 'N/A')}")
                        knowledge_parts.append("")
                    
                    if any(word in query_lower for word in ['program', 'course', 'branch', 'cse', 'ise', 'ece', 'aiml', 'ai&ml']):
                        ug_programs = content.get('ugPrograms', [])
                        if ug_programs:
                            knowledge_parts.append("📚 Undergraduate Programs:")
                            for prog in ug_programs:
                                knowledge_parts.append(f"   - {prog['name']} ({prog['code']}) - {prog['seats']} seats")
                                knowledge_parts.append(f"     Eligibility: {prog['eligibility']}")
                            knowledge_parts.append("")
                    
                    if 'eligibility' in query_lower or 'criteria' in query_lower:
                        knowledge_parts.append("✅ Eligibility Criteria:")
                        knowledge_parts.append("   - UG: 45% in Physics, Chemistry, Mathematics (10+2)")
                        knowledge_parts.append("   - Management Quota: 60% in PCM")
                        knowledge_parts.append("")
                    
                    if 'document' in query_lower or 'required' in query_lower:
                        docs = content.get('requiredDocuments', {})
                        knowledge_parts.append("📄 Required Documents:")
                        for quota, doc_list in docs.items():
                            knowledge_parts.append(f"   {quota.upper()}:")
                            for doc in doc_list[:5]:  # Limit to first 5
                                knowledge_parts.append(f"     - {doc}")
                        knowledge_parts.append("")
                    
                    # Always include searchable text for general queries
                    if admissions_doc.get('searchableText'):
                        knowledge_parts.append(f"\n{admissions_doc['searchableText'][:1000]}")
            
            # ML-powered semantic search for other knowledge base entries
            if use_ml_search and self.embeddings:
                # Search in knowledge_base collection
                kb_entries = await db.knowledge_base.find(
                    {'embeddings': {'$exists': True, '$ne': None}}
                ).to_list(length=100)
                
                if kb_entries:
                    # Perform semantic search
                    kb_entries = map_documents(kb_entries)
                    relevant_entries = await self.embeddings.semantic_search(
                        query=query,
                        documents=kb_entries,
                        top_k=5,
                        threshold=0.6
                    )
                    
                    if relevant_entries:
                        knowledge_parts.append("\n🔍 Relevant Information from Knowledge Base:\n")
                        for idx, entry in enumerate(relevant_entries, 1):
                            knowledge_parts.append(f"{idx}. {entry['pageTitle']} (Relevance: {entry['similarity_score']:.2f})")
                            knowledge_parts.append(f"   {entry['summary']}")
                            if entry.get('isPlacementData'):
                                knowledge_parts.append(f"   🎯 PLACEMENT DATA - HIGH PRIORITY")
                            knowledge_parts.append("")
        
        except Exception as e:
            logger.warning(f"Knowledge base search failed: {e}")
        
        # 9. ML-POWERED CLASSIFICATION
        if self.classifier:
            try:
                classification = await self.classifier.classify(text=query)
                intent_category = classification['category']
                confidence = classification['confidence']
                
                # Add context about query intent
                knowledge_parts.append(f"\n🤔 Query Intent: {intent_category.upper()} (confidence: {confidence:.2f})\n")
                
            except Exception as e:
                logger.warning(f"Query classification failed: {e}")
        
        return "\n".join(knowledge_parts)
    
    async def generate_response(
        self,
        message: str,
        category: Optional[str] = None,
        user_role: Optional[str] = None,
        user_name: Optional[str] = None,
        user_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate AI response using hybrid approach
        
        Args:
            message: User's message
            category: Optional category filter
            user_role: User's role for personalized responses
            user_name: User's name for personalized greetings
            user_data: User's academic and personal data (CGPA, attendance, etc.)
            
        Returns:
            Dict with response content, sources, metadata
        """
        try:
            # Check if this is a placement-related query - use RAG if so
            placement_keywords = ['placement', 'placed', 'package', 'salary', 'company', 'companies', 
                                 'ctc', 'offer', 'recruit', 'hiring', 'job', 'career', '2025']
            
            is_placement_query = any(keyword in message.lower() for keyword in placement_keywords)
            
            if is_placement_query and rag_service:
                logger.info("Detected placement query - using RAG service")
                try:
                    # Use RAG service for placement queries
                    rag_result = rag_service.query(message, n_results=5)
                    
                    if rag_result['confidence'] != 'low':
                        return {
                            "content": rag_result['answer'],
                            "sources": rag_result.get('sources', []),
                            "metadata": {
                                "model": "RAG with Gemini 2.5 Flash",
                                "ml_enabled": True,
                                "semantic_search_used": True,
                                "rag_used": True,
                                "confidence": rag_result['confidence']
                            }
                        }
                except Exception as rag_error:
                    logger.warning(f"RAG service failed, falling back to hybrid: {rag_error}")
            
            # Build knowledge context using ML
            knowledge = await self.build_knowledge_context(
                query=message,
                category=category,
                use_ml_search=True
            )
            
            # Check if knowledge base has sufficient info, otherwise search web
            web_results = ""
            query_lower = message.lower()
            
            # Detect queries that need web search for broader faculty/staff information
            # (not just academic council members)
            faculty_query = any(word in query_lower for word in ['faculty', 'professor', 'lecturer', 'staff', 'teacher', 'instructor'])
            general_info_query = 'about' in query_lower and faculty_query
            contact_query = any(word in query_lower for word in ['contact', 'email', 'phone', 'number'])
            people_query = 'who is' in query_lower and 'hod' not in query_lower and 'dean' not in query_lower
            
            needs_web_search = (
                general_info_query or  # "tell me about faculty"
                (faculty_query and contact_query) or  # "faculty contact"
                people_query or  # "who is..."
                len(knowledge.strip()) < 200  # Knowledge base has little info
            )
            
            if needs_web_search:
                logger.info(f"🌐 Searching web for: {message}")
                web_results = await self.search_web(message)
                if web_results:
                    knowledge += "\n\n" + web_results
            
            # Create system prompt with ML-enhanced context
            greeting = f"Hello {user_name}! " if user_name and user_name != "Guest" else ""
            role_context = f"You are helping {user_name}, a {user_role} at the institution." if user_name and user_name != "Guest" else f"User Role: {user_role or 'Guest'}"
            
            # Add user-specific data if available
            user_context = ""
            if user_data:
                # Check if this is an admin with full access
                has_full_access = user_data.get('hasFullAccess', False)
                
                if has_full_access:
                    # Admin has access to all users' data
                    user_context = "\n\n🔓 ADMIN ACCESS - You have access to all users' data:\n"
                    
                    # Add all users information
                    if 'allUsers' in user_data and user_data['allUsers']:
                        all_users = user_data['allUsers']
                        total_users = len(all_users)
                        
                        # Count by role
                        students = [u for u in all_users if u.get('role') == 'Student']
                        teachers = [u for u in all_users if u.get('role') == 'Teacher']
                        admins = [u for u in all_users if u.get('role') == 'Admin']
                        
                        logger.info(f"📊 Admin context: {total_users} users ({len(students)} students, {len(teachers)} teachers, {len(admins)} admins)")
                        
                        user_context += f"\n📊 Database Statistics:\n"
                        user_context += f"  • Total Users: {total_users}\n"
                        user_context += f"  • Students: {len(students)}\n"
                        user_context += f"  • Teachers: {len(teachers)}\n"
                        user_context += f"  • Admins: {len(admins)}\n\n"
                        
                        # Show sample students
                        user_context += "Sample Students:\n"
                        for user in students[:15]:  # Show first 15 students
                            user_context += f"  • {user.get('name', 'N/A')} ({user.get('usn', 'N/A')})"
                            if user.get('department'):
                                user_context += f" - {user.get('department')}"
                            if user.get('semester'):
                                user_context += f" - Sem {user.get('semester')}"
                            user_context += "\n"
                        if len(students) > 15:
                            user_context += f"  ... and {len(students) - 15} more students\n"
                    
                    # Add all attendance data
                    if 'allAttendance' in user_data and user_data['allAttendance']:
                        user_context += f"\n📅 Attendance Records: {len(user_data['allAttendance'])} total\n"
                        # Group by USN for summary
                        attendance_summary = {}
                        for att in user_data['allAttendance']:
                            usn = att.get('usn', 'Unknown')
                            if usn not in attendance_summary:
                                attendance_summary[usn] = {
                                    'name': att.get('name', 'N/A'),
                                    'overall': att.get('overallAttendance', 'N/A'),
                                    'subjects': []
                                }
                            if att.get('subjectWiseAttendance'):
                                attendance_summary[usn]['subjects'].extend(att['subjectWiseAttendance'])
                        
                        # Show top 10 students by attendance
                        sorted_attendance = sorted(
                            [(usn, data) for usn, data in attendance_summary.items()],
                            key=lambda x: float(x[1]['overall'].strip('%')) if isinstance(x[1]['overall'], str) and x[1]['overall'] != 'N/A' else 0,
                            reverse=True
                        )
                        user_context += "Top Attendance:\n"
                        for usn, data in sorted_attendance[:10]:
                            user_context += f"  • {data['name']} ({usn}): {data['overall']}\n"
                    
                    # Add all CGPA data
                    if 'allCGPA' in user_data and user_data['allCGPA']:
                        user_context += f"\n🎓 CGPA Records: {len(user_data['allCGPA'])} students\n"
                        # Sort by CGPA
                        sorted_cgpa = sorted(
                            user_data['allCGPA'],
                            key=lambda x: float(x.get('cgpa', 0)) if isinstance(x.get('cgpa'), (int, float)) else 0,
                            reverse=True
                        )
                        user_context += "Top Performers:\n"
                        for student in sorted_cgpa[:10]:
                            user_context += f"  • {student.get('name', 'N/A')} ({student.get('usn', 'N/A')}): CGPA {student.get('cgpa', 'N/A')}\n"
                    
                    # Add all timetables summary
                    if 'allTimetables' in user_data and user_data['allTimetables']:
                        user_context += f"\n📚 Timetables: {len(user_data['allTimetables'])} total\n"
                        # Group by class
                        classes = {}
                        for tt in user_data['allTimetables']:
                            class_name = tt.get('class', 'Unknown')
                            section = tt.get('section', '')
                            key = f"{class_name} {section}".strip()
                            if key not in classes:
                                classes[key] = []
                            classes[key].append(tt)
                        
                        user_context += "Classes:\n"
                        for class_key, timetables in classes.items():
                            user_context += f"  • {class_key}: {len(timetables)} timetable(s)\n"
                    
                    user_context += "\n💡 As admin, you can query about any student's attendance, CGPA, timetable, or other information.\n"
                    user_context += "Example queries: 'What is [student name]'s attendance?', 'Show me all students with CGPA > 9', 'Who has the lowest attendance?'\n"
                
                else:
                    # Regular user - show only their data
                    user_context = "\n\nUser's Personal Information:\n"
                    if 'cgpa' in user_data and user_data['cgpa'] != 'N/A':
                        user_context += f"- CGPA: {user_data['cgpa']}\n"
                    if 'currentSGPA' in user_data and user_data['currentSGPA'] != 'N/A':
                        user_context += f"- Current Semester SGPA: {user_data['currentSGPA']}\n"
                    if 'semesterGrades' in user_data:
                        grades_list = [f"{sem}: {gpa}" for sem, gpa in user_data['semesterGrades'].items()]
                        if grades_list:
                            user_context += f"- Semester Grades: {', '.join(grades_list)}\n"
                    if 'department' in user_data and user_data['department'] != 'N/A':
                        user_context += f"- Department: {user_data['department']}\n"
                    if 'semester' in user_data and user_data['semester'] != 'N/A':
                        user_context += f"- Current Semester: {user_data['semester']}\n"
                    if 'overallAttendance' in user_data and user_data['overallAttendance'] != 'N/A':
                        user_context += f"- Overall Attendance: {user_data['overallAttendance']}\n"
                    if 'subjectWiseAttendance' in user_data and user_data['subjectWiseAttendance']:
                        user_context += "- Subject-wise Attendance:\n"
                        for subject in user_data['subjectWiseAttendance']:
                            user_context += f"  * {subject.get('subject', 'N/A')} ({subject.get('code', 'N/A')}): {subject.get('attendance', 'N/A')}%\n"
                    
                    # Add timetable if available
                    if 'timetable' in user_data and user_data['timetable']:
                        timetable = user_data['timetable']
                        schedule = timetable.get('schedule', {})
                        if schedule:
                            user_role_data = user_data.get('role', 'Student')
                            if user_role_data == 'Teacher':
                                user_context += "- Your Teaching Schedule:\n"
                            else:
                                user_context += "- Your Weekly Timetable:\n"
                            
                            days_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                            for day in days_order:
                                if day in schedule:
                                    day_schedule = schedule[day]
                                    user_context += f"  * {day}:\n"
                                    for period in day_schedule:
                                        time = period.get('time', 'N/A')
                                        subject = period.get('subject', 'N/A')
                                        
                                        # For teacher schedules
                                        if user_role_data == 'Teacher':
                                            class_name = period.get('class', '')
                                            section = period.get('section', '')
                                            room = period.get('room', '')
                                            details = f"{time} - {subject}"
                                            if class_name or section:
                                                details += f" (Class: {class_name} {section})"
                                            if room:
                                                details += f" [Room: {room}]"
                                        # For student schedules
                                        else:
                                            faculty = period.get('faculty', '')
                                            room = period.get('room', '')
                                            details = f"{time} - {subject}"
                                            if faculty:
                                                details += f" ({faculty})"
                                            if room:
                                                details += f" [Room: {room}]"
                                        
                                        user_context += f"    - {details}\n"
            
            # Add current date and time context
            from datetime import datetime
            import pytz
            
            # Get current time in IST (Indian Standard Time)
            ist = pytz.timezone('Asia/Kolkata')
            current_time = datetime.now(ist)
            current_day = current_time.strftime('%A')  # Full day name (Monday, Tuesday, etc.)
            current_time_str = current_time.strftime('%I:%M %p')  # 12-hour format with AM/PM
            current_date_str = current_time.strftime('%B %d, %Y')  # Month DD, YYYY
            
            time_context = f"\n\nCurrent Date & Time:\n- Today is {current_day}, {current_date_str}\n- Current time is {current_time_str} (IST)\n"
            
            # Create admin-specific instructions if user has full access
            admin_instructions = ""
            if user_data and user_data.get('hasFullAccess', False):
                admin_instructions = """
ADMIN PRIVILEGES:
- You have full access to ALL users' data (students, teachers, staff)
- You can query about ANY student's attendance, CGPA, grades, timetable, or personal information
- You can perform analytics across all users (e.g., "students with attendance < 75%", "top 10 CGPA holders")
- Use the user data provided in the context to answer queries about specific students or groups
- When asked about a specific student, search through the allUsers, allAttendance, allCGPA data
- Be professional and protect sensitive information - only share what's asked
- You can compare students, generate reports, identify trends

Examples of admin queries you can answer:
- "What is [student name]'s attendance?"
- "Show me all students with CGPA > 9.0"
- "Which students have attendance below 75%?"
- "What is the average CGPA of CSE students?"
- "Who has the highest attendance in the class?"
- "List all students in semester 5"
- "What is [USN]'s timetable?"
"""
            
            system_prompt = f"""You are a helpful campus assistant for BMSIT (BMS Institute of Technology and Management) with ML-powered knowledge retrieval and web search capabilities.

{role_context}
{user_context}
{time_context}
{admin_instructions}

IMPORTANT INSTRUCTIONS:
1. Give CLEAR and HELPFUL answers (3-5 sentences when needed, brief for simple questions)
2. {greeting}Use a friendly, conversational tone
3. ALWAYS use information from the Knowledge Base AND Web Search Results below when available
4. When PDF links or URLs are provided, ALWAYS INCLUDE them in your response
5. When documents are listed with download links (/api/documents/ID/download), PROVIDE the full link to help students access them
6. Be direct and informative
7. Prioritize PLACEMENT DATA, ADMISSIONS INFO, TIMETABLE queries, and DOCUMENT requests
8. If web search results are provided, integrate them naturally
9. For "next class" questions, compare current time with timetable
10. If you don't have enough information in the Knowledge Base, say so and suggest alternatives
11. For queries about "fees", "contact", "faculty" - ALWAYS check Knowledge Base first
12. When students ask for documents/notes/materials, list ALL relevant documents with their download links

Your Knowledge Base (ML-Enhanced + Web Search):
{knowledge}

CRITICAL RULES:
- If Knowledge Base contains the answer (fees, PDFs, contacts, etc.), USE IT
- If Knowledge Base is EMPTY or INSUFFICIENT, say: "I don't have that specific information in my current knowledge base. However, you can check the official BMSIT website at https://bmsit.ac.in or contact the administration."
- For ambiguous queries, ask clarifying questions
- Always cite sources when available
- If query is about multiple topics, address each one

Answer the question based on the information above. Be helpful and accurate.
"""
            
            # Try Gemini models with fallback
            last_error = None
            for model_name in self.models:
                try:
                    logger.info(f"Using Gemini model: {model_name}")
                    
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        generation_config={
                            "temperature": 0.7,
                            "max_output_tokens": 1024,
                        },
                        system_instruction=system_prompt,
                        safety_settings=[
                            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
                        ]
                    )
                    
                    response = model.generate_content(message)
                    
                    # Check if response was blocked
                    if not response.candidates:
                        logger.warning(f"No candidates returned by {model_name}")
                        raise ValueError("No response candidates")
                    
                    candidate = response.candidates[0]
                    
                    # Check finish_reason
                    if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 1:  # 1 = STOP (normal completion)
                        finish_reason_name = str(candidate.finish_reason)
                        logger.warning(f"Response blocked by {model_name} - finish_reason: {finish_reason_name}")
                        raise ValueError(f"Response blocked: {finish_reason_name}")
                    
                    # Check if content exists
                    if not candidate.content or not candidate.content.parts:
                        logger.warning(f"No content parts in response from {model_name}")
                        raise ValueError("No content in response")
                    
                    response_text = response.text
                    
                    logger.info(f"✅ Response generated with {model_name}")
                    
                    # Prepare metadata
                    metadata = {
                        "model": model_name,
                        "ml_enabled": True,
                        "semantic_search_used": True,
                        "classification_used": True,
                        "web_search_used": bool(web_results)
                    }
                    
                    return {
                        "content": response_text,
                        "sources": [],  # Could be populated with KB sources
                        "metadata": metadata
                    }
                
                except Exception as model_error:
                    logger.warning(f"Model {model_name} failed: {model_error}")
                    last_error = model_error
                    continue
            
            # All models failed
            raise Exception(f"All AI models failed. Last error: {last_error}")
        
        except Exception as e:
            logger.error(f"Hybrid chatbot error: {e}")
            return {
                "content": "I apologize, but I'm having trouble processing your request right now. Please try again later.",
                "sources": [],
                "metadata": {
                    "error": str(e),
                    "ml_enabled": False
                }
            }
    
    async def train_from_conversation(
        self,
        user_message: str,
        bot_response: str,
        user_feedback: Optional[str] = None,
        category: Optional[str] = None
    ):
        """
        Learn from conversations to improve ML models
        
        Args:
            user_message: User's message
            bot_response: Bot's response
            user_feedback: Optional user feedback (positive/negative)
            category: Optional category label
        """
        try:
            # Get database instance
            db = get_database()
            
            # If user provides explicit category or we can classify it
            if not category and self.classifier:
                classification = await self.classifier.classify(text=user_message)
                category = classification['category']
            
            # Store as training data
            training_entry = {
                'text': user_message,
                'label': category,
                'source': 'conversation',
                'confidence': 1.0 if user_feedback == 'positive' else 0.7,
                'createdAt': None  # Will be set by database
            }
            
            await db.ml_training_data.insert_one(training_entry)
            
            logger.info(f"Stored conversation for training: category={category}")
            
        except Exception as e:
            logger.error(f"Failed to store training data: {e}")

    async def generate_response_stream(
        self,
        message: str,
        category: Optional[str] = None,
        user_role: Optional[str] = None,
        user_name: Optional[str] = None,
        user_data: Optional[Dict[str, Any]] = None
    ):
        """
        Generate AI response using streaming for word-by-word delivery
        
        Args:
            message: User's message
            category: Optional category filter
            user_role: User's role for personalized responses
            user_name: User's name for personalized greetings
            user_data: User's academic and personal data
            
        Yields:
            Dict chunks with content, done flag, and metadata
        """
        try:
            # Build knowledge context
            knowledge = await self.build_knowledge_context(
                query=message,
                category=category,
                use_ml_search=True
            )
            
            # Create system prompt
            greeting = f"Hello {user_name}! " if user_name and user_name != "Guest" else ""
            role_context = f"You are helping {user_name}, a {user_role} at the institution." if user_name and user_name != "Guest" else f"User Role: {user_role or 'Guest'}"
            
            # Add user-specific data if available
            user_context = ""
            if user_data:
                cgpa = user_data.get('cgpa')
                attendance = user_data.get('attendance')
                semester = user_data.get('semester')
                
                if cgpa:
                    user_context += f"\n📊 Student's CGPA: {cgpa}"
                if attendance:
                    user_context += f"\n📅 Attendance: {attendance}%"
                if semester:
                    user_context += f"\n📚 Current Semester: {semester}"
            
            system_prompt = f"""You are CampusAura AI, an intelligent campus assistant for students, teachers, and administrators.

{role_context}
{user_context}

Guidelines:
1. Be helpful, accurate, and concise
2. {greeting}Use a friendly, personalized tone
3. ALWAYS use information from the Knowledge Base below when available
4. When PDF links or URLs are provided, INCLUDE them in your response
5. Be direct and to the point
6. Prioritize PLACEMENT DATA and ADMISSIONS INFO when relevant

Your Knowledge Base (ML-Enhanced):
{knowledge}

CRITICAL: If the Knowledge Base contains information about the question (like fee structures, PDF links, contact details, etc.), YOU MUST use it and provide those details/links in your answer.

Answer the question based ONLY on the information provided above. If the information is not available in the Knowledge Base, politely say you don't have that information. Keep your response brief and focused.
"""
            
            # Try Gemini models with streaming
            last_error = None
            for model_name in self.models:
                try:
                    logger.info(f"Using Gemini model with streaming: {model_name}")
                    
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        generation_config={
                            "temperature": 0.7,
                            "max_output_tokens": 1024,
                        },
                        system_instruction=system_prompt,
                        safety_settings=[
                            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
                        ]
                    )
                    
                    # Generate content with streaming
                    response = model.generate_content(message, stream=True)
                    
                    # Stream the response word by word
                    for chunk in response:
                        if chunk.text:
                            # Split into words and yield each word
                            words = chunk.text.split()
                            for i, word in enumerate(words):
                                yield {
                                    "content": word + (" " if i < len(words) - 1 else ""),
                                    "done": False,
                                    "cached": False
                                }
                    
                    # Send final chunk with metadata
                    yield {
                        "content": "",
                        "done": True,
                        "cached": False,
                        "metadata": {
                            "model": model_name,
                            "ml_enabled": True,
                            "streaming": True
                        }
                    }
                    
                    logger.info(f"✅ Streaming response completed with {model_name}")
                    return
                
                except Exception as model_error:
                    logger.warning(f"Streaming model {model_name} failed: {model_error}")
                    last_error = model_error
                    continue
            
            # All models failed
            raise Exception(f"All streaming models failed. Last error: {last_error}")
        
        except Exception as e:
            logger.error(f"Streaming chatbot error: {e}")
            yield {
                "content": "I apologize, but I'm having trouble processing your request right now. Please try again later.",
                "done": True,
                "cached": False,
                "error": str(e)
            }
