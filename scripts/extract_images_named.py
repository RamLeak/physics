# -*- coding: utf-8 -*-
"""Save problem images with billet-N-problem.png names."""
import fitz, os, shutil, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Projects\physics\Билеты_по_физике_10г_полный.pdf"
out_dir = r"C:\Projects\physics\public\images"
raw_dir = os.path.join(out_dir, "raw")
os.makedirs(out_dir, exist_ok=True)

# Clean raw dir from previous run
if os.path.exists(raw_dir):
    shutil.rmtree(raw_dir)

# page -> billet number
page_to_billet = {
    4: 1, 7: 2, 9: 3, 11: 4, 13: 5,
    15: 6, 17: 7, 20: 8, 25: 10,
    35: 15, 39: 17, 43: 19,
}

doc = fitz.open(pdf_path)
saved = []
for i, page in enumerate(doc):
    page_num = i + 1
    if page_num not in page_to_billet:
        continue
    info = page.get_image_info(xrefs=True)
    if not info:
        continue
    # Use the first image on the page
    xref = info[0]['xref']
    pix = fitz.Pixmap(doc, xref)
    if pix.n - pix.alpha > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    billet = page_to_billet[page_num]
    out = os.path.join(out_dir, f"billet-{billet}-problem.png")
    pix.save(out)
    saved.append((billet, out, pix.width, pix.height))

doc.close()
for s in sorted(saved):
    print(f"Билет {s[0]:>2}: {os.path.basename(s[1])} ({s[2]}x{s[3]})")
print(f"\nTotal: {len(saved)} files in {out_dir}")
