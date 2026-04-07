from pathlib import Path

from PIL import Image


SOURCE_DIR = Path("/tmp/webforge_patent_mermaid_figs")
OUTPUT_DIR = Path("/tmp/webforge_patent_mermaid_figs_canvas")
CANVAS_SIZE = (1400, 900)


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    for path in sorted(SOURCE_DIR.glob("figure*.png")):
        with Image.open(path).convert("RGB") as image:
            image.thumbnail(CANVAS_SIZE, Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", CANVAS_SIZE, "white")
            x = (CANVAS_SIZE[0] - image.width) // 2
            y = (CANVAS_SIZE[1] - image.height) // 2
            canvas.paste(image, (x, y))
            output_path = OUTPUT_DIR / path.name
            canvas.save(output_path)
            print(output_path)


if __name__ == "__main__":
    main()
