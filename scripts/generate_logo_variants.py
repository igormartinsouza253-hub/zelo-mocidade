from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps


SIZE = 512
PADDING = 44
CORNER_RADIUS = 76
BRAND_BLUE = (54, 169, 225, 255)
BLACK = (9, 12, 16, 255)
WHITE = (255, 255, 255, 255)


def extract_mark(source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    luminance = ImageOps.grayscale(source)

    # Converte o preto do JPG em alpha, descartando o ruído claro da compressão.
    alpha = luminance.point(
        lambda value: 0
        if value >= 248
        else 255
        if value <= 24
        else round(((248 - value) / 224) ** 0.9 * 255)
    )

    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Nenhum desenho escuro foi encontrado no arquivo de origem.")

    alpha = alpha.crop(bbox)
    target = SIZE - (PADDING * 2)
    scale = min(target / alpha.width, target / alpha.height)
    resized = alpha.resize(
        (max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale))),
        Image.Resampling.LANCZOS,
    )

    centered = Image.new("L", (SIZE, SIZE), 0)
    centered.paste(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    return centered


def fit_mask(mask: Image.Image, max_width: int, max_height: int) -> Image.Image:
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("A região escolhida para a marca compacta está vazia.")
    cropped = mask.crop(bbox)
    scale = min(max_width / cropped.width, max_height / cropped.height)
    return cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )


def compact_mark(full_alpha: Image.Image) -> Image.Image:
    # Reaproveita exatamente o telhado e o Z desenhados no master. As regiões
    # são relativas ao master normalizado de 512 px produzido por extract_mark.
    roof = fit_mask(full_alpha.crop((64, 32, 448, 149)), 372, 118)
    letter_z = fit_mask(full_alpha.crop((70, 190, 168, 315)), 188, 238)

    compact = Image.new("L", (SIZE, SIZE), 0)
    compact.paste(roof, ((SIZE - roof.width) // 2, 72), roof)
    compact.paste(letter_z, ((SIZE - letter_z.width) // 2, 208), letter_z)
    return compact


def transparent_mark(alpha: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), color)
    image.putalpha(alpha)
    return image


def rounded_variant(
    alpha: Image.Image,
    background: tuple[int, int, int, int],
    foreground: tuple[int, int, int, int],
) -> Image.Image:
    corner_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(corner_mask).rounded_rectangle(
        (0, 0, SIZE - 1, SIZE - 1),
        radius=CORNER_RADIUS,
        fill=255,
    )

    canvas = Image.new("RGBA", (SIZE, SIZE), background)
    canvas.putalpha(corner_mask)

    mark = transparent_mark(alpha, foreground)
    mark.putalpha(ImageChops.multiply(alpha, corner_mask))
    canvas.alpha_composite(mark)
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera as variações oficiais do logo Zelo.")
    parser.add_argument("source", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument(
        "--compact-source",
        type=Path,
        help="Master opcional da marca reduzida; se omitido, deriva telhado + Z do master principal.",
    )
    args = parser.parse_args()

    assets = args.workspace / "src" / "assets"
    public = args.workspace / "public"
    alpha = extract_mark(args.source)
    compact_alpha = extract_mark(args.compact_source) if args.compact_source else compact_mark(alpha)

    transparent_black = transparent_mark(alpha, BLACK)
    transparent_white = transparent_mark(alpha, WHITE)
    black_white = rounded_variant(alpha, BLACK, WHITE)
    white_black = rounded_variant(alpha, WHITE, BLACK)
    color_white = rounded_variant(alpha, BRAND_BLUE, WHITE)
    compact_transparent_black = transparent_mark(compact_alpha, BLACK)
    compact_transparent_white = transparent_mark(compact_alpha, WHITE)
    compact_black_white = rounded_variant(compact_alpha, BLACK, WHITE)
    compact_white_black = rounded_variant(compact_alpha, WHITE, BLACK)
    compact_color_white = rounded_variant(compact_alpha, BRAND_BLUE, WHITE)

    outputs = {
        assets / "logo-zelo-black-white.png": black_white,
        assets / "logo-zelo-white-black.png": white_black,
        assets / "logo-zelo-color-white.png": color_white,
        assets / "logo-zelo-transparent-black.png": transparent_black,
        assets / "logo-zelo-transparent-white.png": transparent_white,
        assets / "logo-zelo-compact-black-white.png": compact_black_white,
        assets / "logo-zelo-compact-white-black.png": compact_white_black,
        assets / "logo-zelo-compact-color-white.png": compact_color_white,
        assets / "logo-zelo-compact-transparent-black.png": compact_transparent_black,
        assets / "logo-zelo-compact-transparent-white.png": compact_transparent_white,
        # Compatibilidade com os imports existentes.
        assets / "logo-zelo-theme.png": color_white,
        assets / "logo-zelo-transparent.png": transparent_white,
        assets / "logo-zelo-black.png": transparent_black,
        assets / "logo-zelo-white.png": transparent_white,
        public / "logo-zelo-transparent.png": transparent_black,
        public / "logo-zelo-transparent-white.png": transparent_white,
        public / "pwa-512.png": compact_color_white,
    }

    for path, image in outputs.items():
        save_png(image, path)

    # Ícones instaláveis e favicon priorizam a leitura da marca compacta.
    pwa_192 = compact_color_white.resize((192, 192), Image.Resampling.LANCZOS)
    save_png(pwa_192, public / "pwa-192.png")

    favicon = compact_color_white.convert("RGBA")
    favicon.save(
        public / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print("\n".join(str(path) for path in outputs))
    print(public / "pwa-192.png")
    print(public / "favicon.ico")


if __name__ == "__main__":
    main()
