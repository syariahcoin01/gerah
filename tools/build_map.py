"""Bangun berkas peta kelurahan ringan untuk aplikasi (apps/mobile/assets/map/bandung-kelurahan.json).

Sumber poligon: https://github.com/tryfatur/geojson-bandung (3273-kota-bandung-level-kelurahan.json),
dicocokkan ke kode adm4 Kemendagri di services/api/locations.json berdasarkan nama kecamatan + kelurahan.

Pakai:  python3 tools/build_map.py /path/ke/3273-kota-bandung-level-kelurahan.json
Hasil: path SVG yang sudah diproyeksikan (viewBox 0 0 W H) + titik label, ±100 KB.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCS = json.loads((ROOT / "services/api/locations.json").read_text())
OUT = ROOT / "apps/mobile/assets/map/bandung-kelurahan.json"
W = 1000           # lebar viewBox
TOL = 0.00012      # toleransi penyederhanaan (derajat, ±13 m)

# ejaan berbeda antara sumber poligon dan data Kemendagri (diisi bila perlu)
ALIAS: dict[str, str] = {}


def norm(s: str) -> str:
    s = s.lower().replace("kel.", "")
    return re.sub(r"[^a-z]", "", s)


def dp(pts, tol):
    """Douglas–Peucker."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-12
    imax, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L if L > 1e-12 else math.hypot(x - x1, y - y1)
        if d > dmax:
            imax, dmax = i, d
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[: imax + 1], tol)[:-1] + dp(pts[imax:], tol)


def rings(geom):
    if geom["type"] == "Polygon":
        rs = [geom["coordinates"][0]]
    else:
        rs = [p[0] for p in geom["coordinates"]]   # MultiPolygon: cincin luar saja
    return [[[float(c[0]), float(c[1])] for c in r] for r in rs]   # buang ketinggian (z)


def area(r):
    return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2


def centroid(r):
    a = cx = cy = 0.0
    for i in range(len(r) - 1):
        (x0, y0), (x1, y1) = r[i], r[i + 1]
        c = x0 * y1 - x1 * y0
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    if abs(a) < 1e-15:
        return r[0]
    return [cx / (3 * a), cy / (3 * a)]


def inside(pt, r):
    x, y = pt; ins = False
    for i in range(len(r) - 1):
        (x0, y0), (x1, y1) = r[i], r[i + 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            ins = not ins
    return ins


def main(src):
    feats = json.loads(Path(src).read_text())["features"]
    by_name = {(norm(l["kecamatan"]), norm(l["name"])): l for l in LOCS}
    by_kel = {}
    for l in LOCS:
        by_kel.setdefault(norm(l["name"]), []).append(l)

    allpts = [p for f in feats for r in rings(f["geometry"]) for p in r]
    lon0 = min(p[0] for p in allpts); lon1 = max(p[0] for p in allpts)
    lat0 = min(p[1] for p in allpts); lat1 = max(p[1] for p in allpts)
    k = math.cos(math.radians((lat0 + lat1) / 2))
    s = W / ((lon1 - lon0) * k)
    H = round((lat1 - lat0) * s)
    proj = lambda p: (round((p[0] - lon0) * k * s, 1), round((lat1 - p[1]) * s, 1))

    out, used, miss = [], set(), []
    for f in feats:
        pr = f["properties"]
        kec, kel = norm(pr["nama_kecamatan"]), norm(pr["nama_kelurahan"])
        kel = ALIAS.get(kel, kel)
        loc = by_name.get((kec, kel))
        if loc is None and len(by_kel.get(kel, [])) == 1:
            loc = by_kel[kel][0]
        rs = rings(f["geometry"])
        if loc is None:
            # cocokkan dengan titik pusat yang jatuh di dalam poligon
            cands = [l for l in LOCS if l["adm4"] not in used and any(inside([l["lon"], l["lat"]], r) for r in rs)]
            loc = cands[0] if len(cands) == 1 else None
        if loc is None or loc["adm4"] in used:
            miss.append(f"{pr['nama_kecamatan']}/{pr['nama_kelurahan']}")
            continue
        used.add(loc["adm4"])
        parts = []
        for r in rs:
            simp = dp(r, TOL)
            if len(simp) < 4:
                continue
            xy = [proj(p) for p in simp[:-1]]
            parts.append("M" + "L".join(f"{x:g},{y:g}" for x, y in xy) + "Z")
        big = max(rs, key=area)
        cx, cy = proj(centroid(big))
        out.append({"adm4": loc["adm4"], "name": loc["name"], "kec": loc["kecamatan"],
                    "d": "".join(parts), "c": [cx, cy]})
    unmatched = [l["adm4"] + " " + l["kecamatan"] + "/" + l["name"] for l in LOCS if l["adm4"] not in used]
    print(f"cocok {len(out)}/{len(feats)} poligon; tak cocok poligon: {miss}; lokasi tanpa poligon: {unmatched}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "w": W, "h": H, "bbox": [lon0, lat0, lon1, lat1],
        "source": "Batas kelurahan: github.com/tryfatur/geojson-bandung (Permendagri 66/2011), disederhanakan",
        "features": sorted(out, key=lambda x: x["adm4"]),
    }, separators=(",", ":"), ensure_ascii=False))
    print("tulis", OUT, OUT.stat().st_size // 1024, "KB", f"viewBox 0 0 {W} {H}")


if __name__ == "__main__":
    main(sys.argv[1])
