"""
Test OCR functionality for timetable analysis
"""
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from PIL import Image, ImageDraw, ImageFont
import pytesseract

# Configure Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Create a simple test timetable image
img = Image.new('RGB', (800, 600), color='white')
d = ImageDraw.Draw(img)

# Draw a simple timetable
text = """
Class Timetable - Computer Science Engineering - Section 3A

Monday:
9:00-10:00 Data Structures - Dr. Smith - Room 101
10:00-11:00 Algorithms - Prof. Johnson - Room 102
11:00-12:00 Break

Tuesday:
9:00-10:00 Database Management - Dr. Brown - Room 103
10:00-11:00 Computer Networks - Prof. Davis - Room 104
"""

# Use default font
y_position = 50
for line in text.strip().split('\n'):
    d.text((50, y_position), line, fill='black')
    y_position += 40

# Save test image
test_image_path = 'test_timetable.png'
img.save(test_image_path)
print(f"✅ Created test timetable image: {test_image_path}")

# Test OCR extraction
print("\n📄 Extracting text using Tesseract OCR...")
extracted_text = pytesseract.image_to_string(img)
print("\n" + "="*60)
print("EXTRACTED TEXT:")
print("="*60)
print(extracted_text)
print("="*60)

# Test the parsing function
print("\n🔍 Testing timetable parsing...")
from app.routes.timetables import parse_timetable_text

schedule = parse_timetable_text(extracted_text)
print("\n" + "="*60)
print("PARSED SCHEDULE:")
print("="*60)
import json
print(json.dumps(schedule, indent=2))
print("="*60)

print(f"\n✅ OCR Test Complete!")
print(f"✅ Found {sum(len(slots) for slots in schedule.values())} time slots")
