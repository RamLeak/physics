# -*- coding: utf-8 -*-
"""Dump full PDF text per page to scripts/pdf_text.txt"""
import fitz, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Projects\physics\Билеты_по_физике_10г_полный.pdf"
out_path = r"C:\Projects\physics\scripts\pdf_text.txt"

doc = fitz.open(pdf_path)
with open(out_path, "w", encoding="utf-8") as f:
    for i, page in enumerate(doc):
        f.write(f"\n========== PAGE {i+1} ==========\n")
        f.write(page.get_text("text"))
print(f"OK: {out_path}")
doc.close()
