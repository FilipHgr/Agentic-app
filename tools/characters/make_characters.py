"""Vygeneruje obrázky hlavních postaviček hry (SVG) do složky z prvního argumentu.

Spuštění z kořene repa:  python3 tools/characters/make_characters.py public/characters
Každá postavička dostane vlastní podsložku a jeden soubor za každou náladu.
Seznam postaviček a nálad musí odpovídat src/logic/characters.ts.
"""
import math
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
MOODS = ["klid", "radost", "povzbuzeni", "oslava", "mrknuti"]
INK = "#2B2238"


def svg(content: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">'
        + content
        + "</svg>"
    )


def shadow(mood: str) -> str:
    rx = 44 if mood == "oslava" else 62
    op = 0.12 if mood == "oslava" else 0.2
    return f'<ellipse cx="120" cy="226" rx="{rx}" ry="8" fill="#000" opacity="{op}"/>'


def star_points(cx, cy, outer, inner, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rot + i * 180 / n)
        pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    return " ".join(pts)


def sparkle(cx, cy, s, color="#FFE27A"):
    return f'<polygon points="{star_points(cx, cy, s, s * 0.32, 4, -90)}" fill="{color}"/>'


def sparkles():
    return sparkle(30, 58, 11) + sparkle(212, 44, 9) + sparkle(214, 150, 7) + sparkle(24, 150, 6)


def confetti():
    bits = [
        (26, 40, "#FF8A80", 20), (60, 18, "#81D4FA", -30), (182, 22, "#FFE27A", 40),
        (214, 64, "#B9F6CA", -15), (20, 104, "#CE93D8", 35), (222, 120, "#FF8A80", -40),
        (38, 186, "#FFE27A", 10), (206, 190, "#81D4FA", 25), (100, 12, "#B9F6CA", 60),
        (146, 8, "#FF8A80", -20),
    ]
    out = ""
    for x, y, c, r in bits:
        out += f'<rect x="{x - 4}" y="{y - 7}" width="8" height="14" rx="2" fill="{c}" transform="rotate({r} {x} {y})"/>'
    return out


def outlined(shapes: list, fill: str, stroke: str, width: float = 6) -> str:
    """Draws shapes so that only the outer silhouette gets an outline."""
    under = "".join(s.format(fill=stroke, extra=f'stroke="{stroke}" stroke-width="{width}"') for s in shapes)
    over = "".join(s.format(fill=fill, extra="") for s in shapes)
    return under + over


def happy_eyes(lx, rx, y, w=15, color=INK, sw=5.5):
    return "".join(
        f'<path d="M{x - w} {y + 4} Q{x} {y - 14} {x + w} {y + 4}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'
        for x in (lx, rx)
    )


def open_eyes(lx, rx, y, rxe=16, rye=19, look=(3, 4)):
    out = ""
    for x in (lx, rx):
        out += f'<ellipse cx="{x}" cy="{y}" rx="{rxe}" ry="{rye}" fill="#fff" stroke="{INK}" stroke-width="3"/>'
        out += f'<circle cx="{x + look[0]}" cy="{y + look[1]}" r="{rxe * 0.6:.1f}" fill="{INK}"/>'
        out += f'<circle cx="{x + look[0] + 4}" cy="{y + look[1] - 5}" r="3.6" fill="#fff"/>'
        out += f'<circle cx="{x + look[0] - 3}" cy="{y + look[1] + 4}" r="1.6" fill="#fff"/>'
    return out


def closed_eyes(lx, rx, y, w=13, color=INK, sw=5):
    """Zavřené oči při mrknutí: obloučky dolů."""
    return "".join(
        f'<path d="M{x - w} {y} Q{x} {y + 7} {x + w} {y}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>'
        for x in (lx, rx)
    )


def brows(lx, rx, y, color=INK):
    return "".join(
        f'<path d="M{x - 11} {y + 2} Q{x} {y - 6} {x + 11} {y + 2}" fill="none" stroke="{color}" stroke-width="4" stroke-linecap="round"/>'
        for x in (lx, rx)
    )


def smile(cx, cy, w=15, depth=11, color=INK):
    return f'<path d="M{cx - w} {cy} Q{cx} {cy + depth} {cx + w} {cy}" fill="none" stroke="{color}" stroke-width="4.5" stroke-linecap="round"/>'


def open_mouth(cx, cy, w=20, depth=28):
    return (
        f'<path d="M{cx - w} {cy} Q{cx} {cy + depth} {cx + w} {cy} Z" fill="#5A1F2B" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>'
        f'<ellipse cx="{cx}" cy="{cy + depth * 0.42:.1f}" rx="{w * 0.45:.1f}" ry="{depth * 0.2:.1f}" fill="#FF7A8A"/>'
    )


def cheeks(lx, rx, y, color="#FF6F6F", op=0.55):
    return "".join(f'<ellipse cx="{x}" cy="{y}" rx="11" ry="7" fill="{color}" opacity="{op}"/>' for x in (lx, rx))


# ---------------------------------------------------------------- A: Hvězdík


def hvezdik(mood: str) -> str:
    body, dark, line, belly, foot = "#FFA048", "#F08425", "#B85A12", "#FFD9AE", "#E8741A"
    lift = -16 if mood == "oslava" else 0
    tilt = -7 if mood == "povzbuzeni" else 0

    arms_pos = {
        "klid": [(40, 156, 30), (200, 156, -30)],
        "radost": [(40, 100, -35), (200, 100, 35)],
        "povzbuzeni": [(40, 156, 30), (204, 102, 30)],
        "oslava": [(36, 92, -40), (204, 92, 40)],
        "mrknuti": [(40, 156, 30), (200, 156, -30)],
    }[mood]
    arms = "".join(
        f'<ellipse cx="{x}" cy="{y}" rx="13" ry="20" fill="{body}" stroke="{line}" stroke-width="3.5" transform="rotate({r} {x} {y})"/>'
        for x, y, r in arms_pos
    )
    feet = "".join(
        f'<ellipse cx="{x}" cy="210" rx="19" ry="11" fill="{foot}" stroke="{line}" stroke-width="3.5"/>' for x in (92, 148)
    )

    fluff = ['<circle cx="120" cy="128" r="74" fill="{fill}" {extra}/>']
    for i in range(16):
        a = math.radians(i * 360 / 16)
        fluff.append(
            f'<circle cx="{120 + 70 * math.cos(a):.1f}" cy="{128 + 70 * math.sin(a):.1f}" r="17" fill="{{fill}}" {{extra}}/>'
        )
    body_svg = outlined(fluff, body, line, 7)
    shade = f'<path d="M64 176 Q120 222 176 176 Q150 200 120 202 Q90 200 64 176 Z" fill="{dark}" opacity="0.55"/>'
    highlight = '<ellipse cx="86" cy="78" rx="22" ry="11" fill="#fff" opacity="0.35" transform="rotate(-32 86 78)"/>'
    belly_svg = f'<ellipse cx="120" cy="160" rx="42" ry="32" fill="{belly}"/>'

    glow = ""
    if mood in ("radost", "oslava"):
        glow = "".join(
            f'<line x1="{140 + 22 * math.cos(math.radians(a)):.1f}" y1="{20 + 22 * math.sin(math.radians(a)):.1f}" '
            f'x2="{140 + 30 * math.cos(math.radians(a)):.1f}" y2="{20 + 30 * math.sin(math.radians(a)):.1f}" '
            f'stroke="#FFE27A" stroke-width="4" stroke-linecap="round"/>'
            for a in range(0, 360, 45)
        )
    antenna = (
        f'<path d="M120 58 Q116 36 136 24" fill="none" stroke="{line}" stroke-width="5" stroke-linecap="round"/>'
        + glow
        + f'<polygon points="{star_points(140, 20, 17, 8)}" fill="#FFD54F" stroke="#D99A00" stroke-width="3" stroke-linejoin="round"/>'
    )

    if mood == "klid":
        face = open_eyes(96, 144, 116) + cheeks(72, 168, 146) + smile(120, 148)
    elif mood == "mrknuti":
        face = closed_eyes(96, 144, 118) + cheeks(72, 168, 146) + smile(120, 148)
    elif mood == "radost":
        face = happy_eyes(96, 144, 118) + cheeks(72, 168, 144) + open_mouth(120, 142)
    elif mood == "povzbuzeni":
        face = brows(96, 144, 88) + open_eyes(96, 144, 116, look=(4, 2)) + cheeks(72, 168, 146) + smile(120, 146, 18, 14)
    else:
        face = happy_eyes(96, 144, 118) + cheeks(72, 168, 144) + open_mouth(120, 140, 22, 32)

    figure = feet + body_svg + shade + highlight + belly_svg + antenna + face + arms
    extras = sparkles() if mood == "radost" else confetti() if mood == "oslava" else ""
    motion = (
        '<path d="M214 70 Q226 84 220 100" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>'
        '<path d="M224 62 Q238 82 230 104" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>'
        if mood == "povzbuzeni"
        else ""
    )
    return svg(
        shadow(mood) + extras + motion
        + f'<g transform="translate(12 22.6) scale(0.9)"><g transform="translate(0 {lift}) rotate({tilt} 120 210)">{figure}</g></g>'
    )


# ---------------------------------------------------------------- B: Robík


def robik(mood: str) -> str:
    shell, dark, line, screen, glow, acc = "#62BDF6", "#3E94D6", "#22609A", "#1B2940", "#7FF3FF", "#FFD54F"
    lift = -16 if mood == "oslava" else 0
    tilt = -7 if mood == "povzbuzeni" else 0

    hands = {
        "klid": [(52, 196), (188, 196)],
        "radost": [(40, 128), (200, 128)],
        "povzbuzeni": [(52, 196), (206, 132)],
        "oslava": [(36, 118), (204, 118)],
        "mrknuti": [(52, 196), (188, 196)],
    }[mood]
    shoulders = [(84, 182), (156, 182)]
    arms = ""
    for (sx, sy), (hx, hy) in zip(shoulders, hands):
        arms += f'<path d="M{sx} {sy} Q{(sx + hx) / 2:.0f} {max(sy, hy) + 6} {hx} {hy}" fill="none" stroke="{line}" stroke-width="13" stroke-linecap="round"/>'
        arms += f'<path d="M{sx} {sy} Q{(sx + hx) / 2:.0f} {max(sy, hy) + 6} {hx} {hy}" fill="none" stroke="{dark}" stroke-width="7" stroke-linecap="round"/>'
        arms += f'<circle cx="{hx}" cy="{hy}" r="12" fill="{shell}" stroke="{line}" stroke-width="3.5"/>'

    body = (
        f'<rect x="96" y="204" width="20" height="14" rx="5" fill="{dark}" stroke="{line}" stroke-width="3"/>'
        f'<rect x="124" y="204" width="20" height="14" rx="5" fill="{dark}" stroke="{line}" stroke-width="3"/>'
        f'<rect x="80" y="164" width="80" height="46" rx="18" fill="{shell}" stroke="{line}" stroke-width="4"/>'
        f'<circle cx="120" cy="187" r="10" fill="{acc}" stroke="#D99A00" stroke-width="3"/>'
        f'<rect x="106" y="156" width="28" height="12" rx="4" fill="{dark}" stroke="{line}" stroke-width="3"/>'
    )
    ant_glow = ""
    if mood in ("radost", "oslava"):
        ant_glow = f'<circle cx="120" cy="24" r="17" fill="{acc}" opacity="0.35"/>'
    head = (
        f'<line x1="120" y1="56" x2="120" y2="32" stroke="{line}" stroke-width="5" stroke-linecap="round"/>'
        + ant_glow
        + f'<circle cx="120" cy="24" r="10" fill="{acc}" stroke="#D99A00" stroke-width="3"/>'
        f'<circle cx="42" cy="108" r="11" fill="{acc}" stroke="#D99A00" stroke-width="3"/>'
        f'<circle cx="198" cy="108" r="11" fill="{acc}" stroke="#D99A00" stroke-width="3"/>'
        f'<rect x="44" y="52" width="152" height="112" rx="40" fill="{shell}" stroke="{line}" stroke-width="4.5"/>'
        f'<path d="M60 70 Q66 58 84 56" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.5"/>'
        f'<rect x="60" y="70" width="120" height="80" rx="26" fill="{screen}"/>'
        f'<rect x="66" y="76" width="40" height="8" rx="4" fill="#fff" opacity="0.08"/>'
    )
    cheek = "".join(f'<ellipse cx="{x}" cy="132" rx="8" ry="4.5" fill="#FF8FA3" opacity="0.8"/>' for x in (78, 162))
    if mood == "klid":
        face = (
            f'<rect x="86" y="92" width="18" height="26" rx="9" fill="{glow}"/>'
            f'<rect x="136" y="92" width="18" height="26" rx="9" fill="{glow}"/>'
            + smile(120, 130, 14, 10, glow) + cheek
        )
    elif mood == "mrknuti":
        face = (
            f'<rect x="84" y="104" width="22" height="6" rx="3" fill="{glow}"/>'
            f'<rect x="134" y="104" width="22" height="6" rx="3" fill="{glow}"/>'
            + smile(120, 130, 14, 10, glow) + cheek
        )
    elif mood == "radost":
        face = happy_eyes(95, 145, 108, 13, glow, 6) + (
            f'<path d="M100 124 Q120 150 140 124 Z" fill="{glow}"/>'
        ) + cheek
    elif mood == "povzbuzeni":
        face = (
            f'<rect x="86" y="94" width="18" height="24" rx="9" fill="{glow}"/>'
            + f'<path d="M134 106 Q145 96 156 106" fill="none" stroke="{glow}" stroke-width="6" stroke-linecap="round"/>'
            + smile(120, 128, 16, 12, glow) + cheek
        )
    else:
        face = (
            f'<polygon points="{star_points(95, 106, 15, 7)}" fill="{acc}"/>'
            f'<polygon points="{star_points(145, 106, 15, 7)}" fill="{acc}"/>'
            f'<path d="M100 124 Q120 152 140 124 Z" fill="{glow}"/>'
        ) + cheek

    figure = arms + body + head + face
    extras = sparkles() if mood == "radost" else confetti() if mood == "oslava" else ""
    return svg(shadow(mood) + extras + f'<g transform="translate(12 22.6) scale(0.9)"><g transform="translate(0 {lift}) rotate({tilt} 120 214)">{figure}</g></g>')


# ---------------------------------------------------------------- C: Plamínek


def plaminek(mood: str) -> str:
    body, line, belly, bline, horn, hline, wing, wline = (
        "#A184F7", "#5E43B8", "#FFE3AA", "#E9BF6A", "#FFF3D6", "#C9AE76", "#FF9EC4", "#D9578C",
    )
    lift = -16 if mood == "oslava" else 0
    tilt = -7 if mood == "povzbuzeni" else 0
    wing_rot = -22 if mood in ("radost", "oslava") else 0

    def wing_shape(side):
        sx = 120 + side * 44
        d = (
            f"M{sx} 128 Q{120 + side * 96} 112 {120 + side * 98} 62 "
            f"Q{120 + side * 84} 80 {120 + side * 72} 76 Q{120 + side * 70} 96 {120 + side * 56} 98 Z"
        )
        r = -wing_rot * side
        return f'<path d="{d}" fill="{wing}" stroke="{wline}" stroke-width="4" stroke-linejoin="round" transform="rotate({r} {sx} 128)"/>'

    wings = wing_shape(-1) + wing_shape(1)
    tail = (
        f'<path d="M160 190 Q214 196 210 150" fill="none" stroke="{line}" stroke-width="22" stroke-linecap="round"/>'
        f'<path d="M160 190 Q214 196 210 150" fill="none" stroke="{body}" stroke-width="15" stroke-linecap="round"/>'
        f'<polygon points="210,128 222,152 198,152" fill="{wing}" stroke="{wline}" stroke-width="3.5" stroke-linejoin="round"/>'
    )
    feet = "".join(
        f'<ellipse cx="{x}" cy="212" rx="19" ry="11" fill="{body}" stroke="{line}" stroke-width="3.5"/>'
        f'<path d="M{x - 6} 206 L{x - 6} 214 M{x + 6} 206 L{x + 6} 214" stroke="{line}" stroke-width="2.5" stroke-linecap="round"/>'
        for x in (94, 146)
    )
    spikes = "".join(
        f'<polygon points="{x - 9},{y + 8} {x},{y - 10} {x + 9},{y + 8}" fill="{horn}" stroke="{hline}" stroke-width="3" stroke-linejoin="round"/>'
        for x, y in ((106, 46), (120, 40), (134, 46))
    )
    horns = "".join(
        f'<path d="M{x - 9} 58 Q{x + side * 6} 26 {x + side * 16} 30 Q{x + side * 4} 44 {x + 9} 60 Z" fill="{horn}" stroke="{hline}" stroke-width="3" stroke-linejoin="round"/>'
        for x, side in ((84, -1), (156, 1))
    )
    blob = [
        '<ellipse cx="120" cy="166" rx="60" ry="50" fill="{fill}" {extra}/>',
        '<circle cx="120" cy="106" r="60" fill="{fill}" {extra}/>',
    ]
    body_svg = outlined(blob, body, line, 7)
    belly_svg = (
        f'<ellipse cx="120" cy="172" rx="36" ry="34" fill="{belly}"/>'
        f'<path d="M92 162 Q120 170 148 162 M90 178 Q120 186 150 178 M96 194 Q120 200 144 194" fill="none" stroke="{bline}" stroke-width="3" stroke-linecap="round"/>'
    )
    highlight = '<ellipse cx="90" cy="70" rx="18" ry="9" fill="#fff" opacity="0.35" transform="rotate(-30 90 70)"/>'
    arms_pos = {
        "klid": [(68, 166, 30), (172, 166, -30)],
        "radost": [(62, 120, -30), (178, 120, 30)],
        "povzbuzeni": [(68, 166, 30), (190, 104, 35)],
        "oslava": [(58, 110, -40), (182, 110, 40)],
        "mrknuti": [(68, 166, 30), (172, 166, -30)],
    }[mood]
    arms = "".join(
        f'<ellipse cx="{x}" cy="{y}" rx="12" ry="19" fill="{body}" stroke="{line}" stroke-width="3.5" transform="rotate({r} {x} {y})"/>'
        for x, y, r in arms_pos
    )
    snout = (
        f'<ellipse cx="120" cy="128" rx="24" ry="15" fill="#B9A0FA"/>'
        f'<circle cx="112" cy="124" r="2.8" fill="{line}"/><circle cx="128" cy="124" r="2.8" fill="{line}"/>'
    )
    if mood == "klid":
        face = open_eyes(96, 144, 98) + cheeks(70, 170, 122, "#FF7FA8") + snout + smile(120, 136, 13, 9)
        face += '<polygon points="124,139 130,139 127,145" fill="#fff"/>'
    elif mood == "mrknuti":
        face = closed_eyes(96, 144, 100) + cheeks(70, 170, 122, "#FF7FA8") + snout + smile(120, 136, 13, 9)
        face += '<polygon points="124,139 130,139 127,145" fill="#fff"/>'
    elif mood == "radost":
        face = happy_eyes(96, 144, 100) + cheeks(70, 170, 120, "#FF7FA8") + snout + open_mouth(120, 134, 16, 22)
    elif mood == "povzbuzeni":
        face = (
            brows(96, 144, 70) + open_eyes(96, 144, 98, look=(4, 2)) + cheeks(70, 170, 122, "#FF7FA8")
            + snout + smile(120, 135, 16, 12) + '<polygon points="125,141 131,140 128,146" fill="#fff"/>'
        )
    else:
        face = happy_eyes(96, 144, 100) + cheeks(70, 170, 120, "#FF7FA8") + snout + open_mouth(120, 133, 18, 26)

    figure = wings + tail + feet + arms + horns + spikes + body_svg + belly_svg + highlight + face
    # arms in front of the body except when resting at the sides
    if mood not in ("klid", "mrknuti"):
        figure = wings + tail + feet + horns + spikes + body_svg + belly_svg + highlight + face + arms
    extras = sparkles() if mood == "radost" else confetti() if mood == "oslava" else ""
    return svg(shadow(mood) + extras + f'<g transform="translate(12 22.6) scale(0.9)"><g transform="translate(0 {lift}) rotate({tilt} 120 214)">{figure}</g></g>')


for name, draw in (("hvezdik", hvezdik), ("robik", robik), ("plaminek", plaminek)):
    folder = OUT / name
    folder.mkdir(parents=True, exist_ok=True)
    for mood in MOODS:
        (folder / f"{mood}.svg").write_text(draw(mood), encoding="utf-8")
print("ok")
