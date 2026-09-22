import pdfplumber

pdf_file = "backend/uploads/1773818926.354751-ITD_G6_SEAPM_assignment05_1.pdf"

try:
    print("Opening PDF...")
    with pdfplumber.open(pdf_file) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        first_page_text = pdf.pages[0].extract_text()
        print("\n--- Page 1 Text ---")
        print(first_page_text[:500] if first_page_text else "EMPTY PAGE")
except Exception as e:
    print(f"ERROR: {e}")
