from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / 'test' / 'fixtures'
OUT = ROOT / 'public' / 'vision'
REF = ROOT / 'image_references'

REFERENCE_PARTS = {
    'Rocket': ('Rocket Tech Part.png', 4),
    'Drill': ('Drill Tech Part.png', 4),
    'Soccer': ('Soccer Tech part.png', 3),
    'Durian': ('Durian Tech Part.png', 3),
    'Lightning': ('Lightning Tech Part.png', 4),
    'Boomerang': ('Boomerang Tech Part.png', 3),
    'Drone': ('Drone Tech Part.png', 4),
    'Forcefield': ('Forcefield Tech Part.png', 4),
    'Laser': ('Laser Tech Part.png', 4),
    'Shield': ('Shield Tech Part.png', 4),
    'Molotov': ('Molotov Tech Part.png', 3),
    'Brick': ('Brick Tech Part.png', 3),
}

REFERENCE_TWINBORNS = {
    'Rocket|Drill': 'Twinborn Rocket.png',
    'Soccer|Durian': 'Twinborn Soccer.png',
    'Lightning|Boomerang': 'Twinborn Lightning.png',
    'Drone|Forcefield': 'Twinborn Drone.png',
    'Laser|Shield': 'Twinborn Laser.png',
    'Molotov|Brick': 'Twinborn Molotov.png',
}

FIXTURES = {
    'Legend': {
        'file': FIX / 'inventory_legend.png',
        'xs': [11, 121, 230, 340, 450],
        'ys': [15, 133, 251, 369],
        'pitch_x': 110,
        'pitch_y': 118,
    },
    'Epic': {
        'file': FIX / 'inventory_epic.png',
        'xs': [5, 115, 224, 334, 444],
        'ys': [12, 130, 249, 367],
        'pitch_x': 110,
        'pitch_y': 118,
    },
    'Purple': {
        'file': FIX / 'inventory_purple.png',
        'xs': [8, 118, 227, 337, 447],
        'ys': [17, 135, 253, 371],
        'pitch_x': 110,
        'pitch_y': 118,
    },
}

# Known cards from the three user-provided calibration screenshots.
CARDS = {
    'Legend': {
        (0,0): ('TB','Rocket|Drill','Legend',0),
        (0,1): ('TB','Soccer|Durian','Legend',0),
        (0,2): ('TB','Lightning|Boomerang','Legend',0),
        (0,3): ('TB','Drone|Forcefield','Legend',0),
        (0,4): ('TB','Laser|Shield','Legend',0),
        (1,0): ('TB','Molotov|Brick','Legend',0),
        (1,1): ('PART','Rocket','Legend',4),
        (1,2): ('PART','Forcefield','Legend',4),
        (1,3): ('PART','Drill','Legend',4),
        (1,4): ('PART','Lightning','Legend',4),
        (2,0): ('PART','Drone','Legend',4),
        (2,1): ('PART','Laser','Legend',4),
        (2,2): ('PART','Shield','Legend',3),
        (2,3): ('PART','Brick','Legend',3),
        (2,4): ('PART','Boomerang','Legend',3),
        (3,0): ('PART','Durian','Legend',3),
        (3,1): ('PART','Soccer','Legend',3),
        (3,2): ('PART','Molotov','Legend',3),
        (3,3): ('PART','Drone','Legend',0),
        (3,4): ('PART','Shield','Epic',3),
    },
    'Epic': {},
    'Purple': {},
}

epic = [
('Drill','Epic',3),('Drone','Epic',3),('Forcefield','Epic',2),('Shield','Epic',2),('Durian','Epic',2),
('Soccer','Epic',2),('Drone','Epic',2),('Molotov','Epic',2),('Rocket','Epic',1),('Brick','Epic',1),
('Boomerang','Epic',1),('Durian','Epic',1),('Lightning','Epic',1),('Soccer','Epic',1),('Forcefield','Epic',1),
('Drill','Epic',0),('Lightning','Epic',0),('Drone','Epic',0),('Laser','Epic',0),('Rocket','Purple',2),
]
for i, item in enumerate(epic):
    CARDS['Epic'][(i//5,i%5)] = ('PART', *item)

purple = [
('Forcefield','Purple',2),('Drill','Purple',2),('Drone','Purple',2),('Laser','Purple',2),('Rocket','Purple',1),
('Forcefield','Purple',1),('Shield','Purple',1),('Boomerang','Purple',1),('Durian','Purple',1),('Drill','Purple',1),
('Lightning','Purple',1),('Soccer','Purple',1),('Drone','Purple',1),('Laser','Purple',1),('Molotov','Purple',1),
('Forcefield','Purple',0),('Drill','Purple',0),('Soccer','Purple',0),('Drone','Purple',0),('Laser','Purple',0),
]
for i, item in enumerate(purple):
    CARDS['Purple'][(i//5,i%5)] = ('PART', *item)


def card_geometry(fx, row, col):
    # Keep this in sync with src/vision.js cardW/cardH and cardCrop ratios.
    card_w = max(90, fx['pitch_x'] * .91)
    card_h = max(92, fx['pitch_y'] * .87)
    return fx['xs'][col], fx['ys'][row], card_w, card_h


def crop_norm(im, x, y, w, h, out_size):
    box = (x, y, x+w, y+h)
    return im.crop(box).resize(out_size, Image.Resampling.BILINEAR)


def tech_crop(im, geom):
    x,y,w,h = geom
    return crop_norm(im, x+w*.75, y+h*.07, w*.30, h*.30, (32,32))


def marker_crop(im, geom):
    x,y,w,h = geom
    return crop_norm(im, x, y, w*.30, h*.30, (32,32))


def level_crop(im, geom):
    x,y,w,h = geom
    return crop_norm(im, x+w*.36, y+h*.75, w*.28, h*.28, (40,40))


def twinborn_crop(im, geom):
    x,y,w,h = geom
    return crop_norm(im, x+w*.18, y+h*.20, w*.64, h*.66, (64,66))


def art_crop(im, geom):
    x,y,w,h = geom
    return crop_norm(im, x+w*.16, y+h*.18, w*.68, h*.56, (48,48))


def reference_crop(im, kind):
    w,h = im.size
    boxes = {
        'marker': (0, h*.15, w*.30, h*.32, (32,32)),
        'tech': (w*.70, h*.15, w*.30, h*.32, (32,32)),
        'art': (w*.14, h*.18, w*.72, h*.60, (48,48)),
        'level': (w*.34, h*.70, w*.32, h*.30, (40,40)),
        'twinborn': (w*.14, h*.18, w*.72, h*.72, (64,66)),
    }
    x,y,cw,ch,size = boxes[kind]
    return crop_norm(im, x, y, cw, ch, size)


def save_unique(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return './vision/' + str(path.relative_to(OUT)).replace('\\','/')


# Preserve existing synthetic Legend 1/2 samples because no real calibration card was supplied yet.
old_manifest_path = OUT / 'manifest.json'
old_manifest = json.loads(old_manifest_path.read_text()) if old_manifest_path.exists() else {}

tech_samples = {name: [] for name in ['Rocket','Drill','Soccer','Durian','Lightning','Boomerang','Drone','Forcefield','Laser','Shield','Molotov','Brick']}
art_samples = {name: [] for name in tech_samples}
tb_samples = {}
marker_samples = {'Twinborn': [], 'Part': []}
level_samples = {r: {str(l): [] for l in levels} for r,levels in {'Purple':[0,1,2], 'Epic':[0,1,2,3], 'Legend':[0,1,2,3,4]}.items()}

# Prefer one tech-badge sample per rarity for each tech, plus all available level samples up to 6.
seen_tech_rarity = set()
for fixture_name, fx in FIXTURES.items():
    im = Image.open(fx['file']).convert('RGB')
    for (row,col), card in CARDS[fixture_name].items():
        kind, ident, rarity, level = card
        geom = card_geometry(fx,row,col)
        if kind == 'TB':
            key = ident
            out = OUT / 'twinborn' / f"{key.replace('|','__')}_cal.png"
            tb_samples[key] = [save_unique(out, twinborn_crop(im,geom))]
            marker_out = OUT / 'markers' / f"Twinborn_cal_{len(marker_samples['Twinborn'])}.png"
            marker_samples['Twinborn'].append(save_unique(marker_out, marker_crop(im,geom)))
            continue
        tech = ident
        if rarity == 'Legend':
            marker_out = OUT / 'markers' / f"Part_cal_{len(marker_samples['Part'])}.png"
            marker_samples['Part'].append(save_unique(marker_out, marker_crop(im,geom)))
        sig = (tech,rarity)
        if sig not in seen_tech_rarity:
            seen_tech_rarity.add(sig)
            out = OUT / 'tech' / f'{tech}_{rarity}_cal.png'
            tech_samples[tech].append(save_unique(out, tech_crop(im,geom)))
            art_out = OUT / 'art' / f'{tech}_{rarity}_cal.png'
            art_samples[tech].append(save_unique(art_out, art_crop(im,geom)))
        # Capture several real level samples per rarity/level.
        if rarity in level_samples and str(level) in level_samples[rarity] and len(level_samples[rarity][str(level)]) < 12:
            out = OUT / 'levels' / rarity / f'{level}_cal_{len(level_samples[rarity][str(level)])}.png'
            level_samples[rarity][str(level)].append(save_unique(out, level_crop(im,geom)))

# Add clean card references as extra samples. Screenshot-derived samples remain
# in the same classes because they cover equipped overlays and grid crop drift.
for tech, (filename, level) in REFERENCE_PARTS.items():
    path = REF / filename
    if not path.exists():
        continue
    im = Image.open(path).convert('RGB')
    tech_samples[tech].append(save_unique(OUT / 'tech' / f'{tech}_reference.png', reference_crop(im, 'tech')))
    art_samples[tech].append(save_unique(OUT / 'art' / f'{tech}_reference.png', reference_crop(im, 'art')))
    marker_samples['Part'].append(save_unique(OUT / 'markers' / f"Part_reference_{tech}.png", reference_crop(im, 'marker')))
    level_samples['Legend'][str(level)].append(save_unique(OUT / 'levels' / 'Legend' / f'{level}_reference_{tech}.png', reference_crop(im, 'level')))

for key, filename in REFERENCE_TWINBORNS.items():
    path = REF / filename
    if not path.exists():
        continue
    im = Image.open(path).convert('RGB')
    tb_samples.setdefault(key, []).append(save_unique(OUT / 'twinborn' / f"{key.replace('|','__')}_reference.png", reference_crop(im, 'twinborn')))
    marker_samples['Twinborn'].append(save_unique(OUT / 'markers' / f"Twinborn_reference_{key.split('|')[0]}.png", reference_crop(im, 'marker')))

# Carry forward synthetic/legacy Legend 1 and 2 because calibration screenshots did not contain them.
for lv in ('1','2'):
    legacy = old_manifest.get('levels',{}).get('Legend',{}).get(lv,[])
    if isinstance(legacy,str): legacy=[legacy]
    for p in legacy:
        if p not in level_samples['Legend'][lv]:
            level_samples['Legend'][lv].append(p)

manifest = {'tech': tech_samples, 'art': art_samples, 'twinborn': tb_samples, 'markers': marker_samples, 'levels': level_samples}
old_manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Wrote {old_manifest_path}')
for tech, paths in tech_samples.items():
    print(f'{tech}: {len(paths)} badge samples, {len(art_samples[tech])} art samples')
for r, by in level_samples.items():
    print(r, {lv:len(paths) for lv,paths in by.items()})
