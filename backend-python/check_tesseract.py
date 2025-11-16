"""
Check if Tesseract OCR is installed
"""
try:
    import pytesseract
    from PIL import Image
    
    # Configure Tesseract path for Windows
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    # Try to get version
    version = pytesseract.get_tesseract_version()
    print(f"✅ Tesseract OCR is installed: {version}")
    print(f"✅ pytesseract module: OK")
    print(f"✅ PIL/Pillow module: OK")
    
except pytesseract.TesseractNotFoundError:
    print("❌ Tesseract OCR is NOT installed on your system")
    print("\nTo install Tesseract:")
    print("1. Download from: https://github.com/UB-Mannheim/tesseract/wiki")
    print("2. Or use: winget install UB-Mannheim.TesseractOCR")
    print("3. Add to PATH: C:\\Program Files\\Tesseract-OCR")
    
except Exception as e:
    print(f"❌ Error: {e}")
