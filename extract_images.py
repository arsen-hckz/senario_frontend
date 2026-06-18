import fitz
import os

pdf_path = r"SCENARIO_final_updated_ef6ead90-7a8d-4b2f-b91b-a5e94f83aa89.pdf"
out_dir = "extracted_images"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
count = 0

for page_num in range(len(doc)):
    page = doc[page_num]
    images = page.get_images(full=True)
    for img_index, img in enumerate(images):
        xref = img[0]
        base_image = doc.extract_image(xref)
        img_bytes = base_image["image"]
        ext = base_image["ext"]
        filename = f"{out_dir}/page{page_num+1}_img{img_index+1}.{ext}"
        with open(filename, "wb") as f:
            f.write(img_bytes)
        count += 1
        print(f"Saved: {filename} ({len(img_bytes)//1024} KB)")

print(f"\nDone — {count} images extracted to '{out_dir}/'")
