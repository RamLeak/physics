# -*- coding: utf-8 -*-
"""Extract images from PDF, deduplicating by content hash. Try to map to billets."""
import fitz
import hashlib
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Projects\physics\Билеты_по_физике_10г_полный.pdf"
out_dir = r"C:\Projects\physics\public\images\raw"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
seen_hashes = {}  # hash -> first (page, index)
unique_images = []  # list of (page, idx, xref, size_bytes)

for i, page in enumerate(doc):
    page_num = i + 1
    images = page.get_images(full=True)
    for idx, img in enumerate(images):
        xref = img[0]
        try:
            pix = fitz.Pixmap(doc, xref)
            data = pix.tobytes("png")
        except Exception as e:
            print(f"page {page_num} img {idx}: error {e}")
            continue
        h = hashlib.md5(data).hexdigest()
        if h in seen_hashes:
            continue
        seen_hashes[h] = (page_num, idx)
        unique_images.append((page_num, idx, xref, len(data), pix.width, pix.height, h[:8]))

print(f"Unique images: {len(unique_images)}")
for u in unique_images:
    print(f"  page {u[0]} idx {u[1]} xref {u[2]} {u[4]}x{u[5]} {u[3]} bytes hash {u[6]}")

# Save them
for (page_num, idx, xref, sz, w, h, hsh) in unique_images:
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    name = f"page-{page_num:02d}-img-{idx:02d}-{hsh}.png"
    pix.save(os.path.join(out_dir, name))

doc.close()
print(f"\nSaved to {out_dir}")
