# -*- coding: utf-8 -*-
"""Scan PDF: page count, image counts per page, first 200 chars of each page."""
import fitz
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Projects\physics\Билеты_по_физике_10г_полный.pdf"
doc = fitz.open(pdf_path)
print(f"Total pages: {doc.page_count}")
print()

for i, page in enumerate(doc):
    images = page.get_images(full=True)
    text = page.get_text("text")
    head = text.replace("\n", " ").strip()[:160]
    print(f"--- Page {i+1} | imgs={len(images)} ---")
    print(head)
    print()

doc.close()
