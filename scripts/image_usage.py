# -*- coding: utf-8 -*-
"""For each page find which image xref is actually placed on the page (with bbox)."""
import fitz, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Projects\physics\Билеты_по_физике_10г_полный.pdf"
doc = fitz.open(pdf_path)

for i, page in enumerate(doc):
    page_num = i + 1
    info = page.get_image_info(xrefs=True)
    if not info:
        continue
    print(f"Page {page_num}:")
    for entry in info:
        bbox = entry.get('bbox')
        xref = entry.get('xref')
        w = entry.get('width')
        h = entry.get('height')
        print(f"  xref {xref} bbox={bbox} src={w}x{h}")

doc.close()
