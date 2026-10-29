#!/usr/bin/env python3
"""Generate the Beaumont West Solutions static site."""
import re, os, shutil, html

# ---------------------------------------------------------------- EDIT HERE
# Change any of these once and every page picks it up on the next build.
BRAND         = "Beaumont West Solutions"
SITE_URL      = "https://beaumontwest.com"   # no trailing slash
EMAIL         = "hello@beaumontwest.com"
PHONE_DISPLAY = "(555) 014-2200"
PHONE_LINK    = "+15550142200"               # digits only, with country code
YEAR          = "2026"
# ---------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, "assets")   # logo + icon source files
OUT  = HERE                           # pages are written next to this script

# ---------------------------------------------------------------- brand SVGs
def read(name):
    with open(os.path.join(SRC, name)) as f:
        return f.read()

def strip_shell(svg, idpfx):
    """Return inner markup of an svg, with ids namespaced, sized by CSS."""
    inner = re.sub(r'^.*?<svg[^>]*>', '', svg, flags=re.S)
    inner = re.sub(r'</svg>\s*$', '', inner, flags=re.S)
    inner = re.sub(r'<title>.*?</title>', '', inner, flags=re.S)
    inner = re.sub(r'<!--.*?-->', '', inner, flags=re.S)
    for old in re.findall(r'id="([^"]+)"', inner):
        inner = inner.replace('id="%s"' % old, 'id="%s-%s"' % (idpfx, old))
        inner = inner.replace('url(#%s)' % old, 'url(#%s-%s)' % (idpfx, old))
    return inner.strip()

def viewbox(svg):
    return re.search(r'viewBox="([^"]+)"', svg).group(1)

LOCKUP_H   = read("bws-lockup-horizontal.svg")
LOCKUP_P   = read("bws-lockup-primary.svg")
LOCKUP_REV = read("bws-lockup-primary-reversed.svg")
BADGE_FULL = read("bws-logo-primary.svg")

def stacked_lockup(idpfx):
    """Two-line lockup for narrow screens. Same simplified badge as the wide
    header; cropped to an even 8-unit margin (artwork spans x14-396, y14-114)."""
    svg = LOCKUP_P
    for p in re.findall(r'<path d="[^"]+" fill="#FDF0DC"/>', svg):
        svg = svg.replace(p, '')
    return ('<svg class="lockup lockup--header lockup--stacked" viewBox="6 6 398 116" '
            'role="img" aria-label="Beaumont West Solutions">%s</svg>'
            % strip_shell(svg, idpfx))


def header_lockup(idpfx):
    """Horizontal lockup with the badge's B and S removed.

    The usage guide reserves the full mark for 64px and up; at header scale the
    badge lands around 34px, so the simplified badge is the correct one to pair
    with the wordmark."""
    svg = LOCKUP_H
    # the two cream letterform paths inside the badge group are the B and the S
    letters = re.findall(r'<path d="[^"]+" fill="#FDF0DC"/>', svg)
    for p in letters:
        svg = svg.replace(p, '')
    # crop the file's own padding (artwork spans 14..94 of 108) to an even
    # 8-unit margin, so the logo reads larger at the same header height
    return ('<svg class="lockup lockup--header lockup--wide" viewBox="6 6 478 96" role="img" '
            'aria-label="Beaumont West Solutions">%s</svg>'
            % strip_shell(svg, idpfx))

def footer_lockup(idpfx):
    # the badge's own ring is #1B4552, which disappears against a teal footer,
    # so a coral ring is added just outside it to hold the mark off the ground
    ring = ('<circle cx="100" cy="100" r="92" fill="none" stroke="#E86F51" '
            'stroke-width="6"/>')
    global LOCKUP_REV
    anchor = '<circle cx="100" cy="100" r="88" fill="none" stroke="#1B4552" stroke-width="5"/>'
    if anchor in LOCKUP_REV and 'E86F51" stroke-width="6"' not in LOCKUP_REV:
        LOCKUP_REV = LOCKUP_REV.replace(anchor, anchor + ring)
    return ('<svg class="lockup lockup--footer" viewBox="%s" role="img" '
            'aria-label="Beaumont West Solutions">%s</svg>'
            % (viewbox(LOCKUP_REV), strip_shell(LOCKUP_REV, idpfx)))

def badge(idpfx, cls="badge"):
    return ('<svg class="%s" viewBox="%s" role="img" aria-label="Beaumont West '
            'Solutions mark">%s</svg>'
            % (cls, viewbox(BADGE_FULL), strip_shell(BADGE_FULL, idpfx)))

# ------------------------------------------------------------------ dividers
RIDGE = """<div class="divider divider--ridge" aria-hidden="true">
<svg viewBox="0 0 1440 150" preserveAspectRatio="none" focusable="false">
<defs><linearGradient id="ridge-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--peach);stop-opacity:.25"/><stop offset=".45" style="stop-color:var(--peach);stop-opacity:.85"/></linearGradient></defs>
<path class="ridge-far" fill="url(#ridge-haze)" d="M0,150 L0,40 L200,10 L420,34 L700,4 L980,30 L1220,8 L1440,26 L1440,150 Z"/>
<path class="ridge-back" d="M0,150 L0,80 L104,40 L184,64 L330,34 L410,70 L620,36 L700,72 L790,40 L860,70 L1029,30 L1100,70 L1209,38 L1280,70 L1440,52 L1440,150 Z"/>
<path class="ridge-front" d="M0,150 L0,98 L96,72 L136,84 L250,46 L330,94 L470,18 L640,102 L720,62 L790,90 L900,34 L1029,98 L1139,56 L1209,86 L1330,30 L1440,82 L1440,150 Z"/>
<path class="ridge-rim" d="M0,98 L96,72 L136,84 L250,46 L330,94 L470,18 L640,102 L720,62 L790,90 L900,34 L1029,98 L1139,56 L1209,86 L1330,30 L1440,82"/>
</svg></div>"""

def wave(to="paper"):
    """Teal above, light below: a three-layer tide, matching the ridge's depth."""
    return """<div class="divider divider--wave to-%s" aria-hidden="true">
<svg viewBox="0 0 1440 156" preserveAspectRatio="none" focusable="false">
<path class="tide-far" d="M0,0 L1440,0 L1440,94 C1210,172 980,58 720,128 C450,180 240,74 0,140 Z"/>
<path class="tide-mid" d="M0,0 L1440,0 L1440,64 C1230,150 990,26 740,100 C470,168 230,42 0,112 Z"/>
<path class="tide-front" d="M0,0 L1440,0 L1440,34 C1240,128 1000,-6 720,70 C440,146 210,10 0,82 Z"/>
</svg></div>""" % to

SUN_ARC = """<div class="divider divider--arc" aria-hidden="true">
<svg viewBox="0 0 1440 110" preserveAspectRatio="none" focusable="false">
<path class="arc-fill" d="M0,110 L0,66 Q720,2 1440,66 L1440,110 Z"/>
<path class="arc-line" d="M0,66 Q720,2 1440,66"/>
</svg></div>"""

SUN_ARC_INVERSE = SUN_ARC.replace('divider--arc"', 'divider--arc arc--inverse"')

ANGLE = """<div class="divider divider--angle" aria-hidden="true">
<svg viewBox="0 0 1440 110" preserveAspectRatio="none" focusable="false">
<path class="angle-fill" d="M0,110 L0,88 L1440,26 L1440,110 Z"/>
</svg></div>"""

RIDGE_SAND = RIDGE.replace('divider--ridge"', 'divider--ridge from-sand"')
SUN_ARC_TEAL = SUN_ARC.replace('divider--arc"', 'divider--arc arc--teal"')
SUN_HORIZON = """<div class="horizon sunrise" aria-hidden="true">
<svg viewBox="0 0 180 148" focusable="false">
<defs><clipPath id="bws-sky"><rect x="0" y="0" width="180" height="74"/></clipPath></defs>
<g clip-path="url(#bws-sky)"><g class="sun-up">
<circle cx="90" cy="74" r="68" fill="#FAD9BA"/>
<circle cx="90" cy="74" r="53" fill="#F6B886"/>
<circle cx="90" cy="74" r="38" fill="#E86F51"/>
<rect x="52" y="48" width="76" height="2.5" fill="#F6B886"/>
<rect x="52" y="57" width="76" height="3.5" fill="#F6B886"/>
<rect x="52" y="66" width="76" height="4.5" fill="#F6B886"/>
</g></g>
<g class="sun-refl" stroke-width="3.4" stroke-linecap="round">
<line x1="52" y1="82" x2="128" y2="82" stroke="#E86F51" opacity=".55"/>
<line x1="64" y1="92" x2="116" y2="92" stroke="#F4A261" opacity=".65"/>
<line x1="76" y1="102" x2="104" y2="102" stroke="#E86F51" opacity=".32"/>
<line x1="85" y1="112" x2="95" y2="112" stroke="#F4A261" opacity=".4"/>
</g>
</svg></div>"""

MOUNTAIN_HORIZON = """<div class="horizon horizon--close" aria-hidden="true">
<svg viewBox="0 0 180 148" focusable="false">
<path d="M31.5,74 L58.5,36.5 L75,62 L90,47 L105,62 L121.5,36.5 L148.5,74 Z" fill="#1B4552"/>
</svg></div>"""

PLAIN_HORIZON = """<div class="horizon horizon--plain" aria-hidden="true"></div>"""

TOPO = """<div class="divider divider--topo" aria-hidden="true">
<svg viewBox="0 0 1440 128" preserveAspectRatio="none" focusable="false">
<path d="M0,34 L20,36 L40,37 L60,38 L80,38 L100,38 L120,38 L140,37 L160,36 L180,35 L200,34 L220,33 L240,33 L260,32 L280,32 L300,30 L320,29 L340,26 L360,22 L380,17 L400,11 L420,6 L440,2 L460,3 L480,8 L500,15 L520,22 L540,27 L560,32 L580,35 L600,36 L620,36 L640,36 L660,35 L680,33 L700,31 L720,30 L740,28 L760,26 L780,25 L800,26 L820,28 L840,30 L860,31 L880,32 L900,32 L920,32 L940,32 L960,32 L980,33 L1000,33 L1020,32 L1040,31 L1060,28 L1080,25 L1100,21 L1120,18 L1140,19 L1160,21 L1180,23 L1200,25 L1220,27 L1240,28 L1260,29 L1280,30 L1300,31 L1320,32 L1340,33 L1360,33 L1380,34 L1400,34 L1420,34 L1440,34 L1440,170 L0,170 Z" fill="#F4A261" opacity="0.35"/>
<path d="M0,53 L20,54 L40,53 L60,53 L80,52 L100,51 L120,50 L140,49 L160,49 L180,48 L200,48 L220,48 L240,47 L260,46 L280,44 L300,42 L320,40 L340,37 L360,34 L380,31 L400,29 L420,27 L440,26 L460,27 L480,31 L500,35 L520,38 L540,41 L560,43 L580,45 L600,45 L620,45 L640,45 L660,45 L680,45 L700,45 L720,44 L740,43 L760,42 L780,42 L800,43 L820,44 L840,45 L860,46 L880,47 L900,48 L920,49 L940,50 L960,50 L980,51 L1000,50 L1020,48 L1040,45 L1060,42 L1080,38 L1100,34 L1120,31 L1140,31 L1160,33 L1180,35 L1200,38 L1220,40 L1240,43 L1260,45 L1280,47 L1300,48 L1320,49 L1340,49 L1360,49 L1380,50 L1400,50 L1420,50 L1440,51 L1440,170 L0,170 Z" fill="#F4A261" opacity="0.75"/>
<path d="M0,66 L20,65 L40,64 L60,64 L80,63 L100,63 L120,63 L140,62 L160,62 L180,61 L200,61 L220,59 L240,58 L260,57 L280,55 L300,54 L320,53 L340,52 L360,51 L380,51 L400,50 L420,48 L440,47 L460,47 L480,48 L500,49 L520,50 L540,51 L560,52 L580,53 L600,55 L620,56 L640,57 L660,58 L680,59 L700,59 L720,58 L740,58 L760,57 L780,56 L800,57 L820,59 L840,60 L860,62 L880,64 L900,65 L920,66 L940,66 L960,65 L980,64 L1000,61 L1020,58 L1040,55 L1060,52 L1080,49 L1100,46 L1120,46 L1140,47 L1160,49 L1180,52 L1200,54 L1220,56 L1240,58 L1260,60 L1280,61 L1300,62 L1320,63 L1340,63 L1360,64 L1380,65 L1400,66 L1420,67 L1440,67 L1440,170 L0,170 Z" fill="#E86F51" opacity="0.7"/>
<path d="M0,76 L20,76 L40,76 L60,76 L80,76 L100,75 L120,75 L140,74 L160,73 L180,72 L200,71 L220,71 L240,70 L260,70 L280,71 L300,71 L320,71 L340,71 L360,70 L380,68 L400,66 L420,64 L440,62 L460,61 L480,60 L500,61 L520,61 L540,63 L560,64 L580,66 L600,68 L620,69 L640,70 L660,70 L680,71 L700,71 L720,71 L740,71 L760,71 L780,72 L800,74 L820,76 L840,77 L860,78 L880,79 L900,78 L920,77 L940,76 L960,74 L980,71 L1000,69 L1020,67 L1040,65 L1060,64 L1080,64 L1100,63 L1120,64 L1140,65 L1160,66 L1180,68 L1200,69 L1220,70 L1240,72 L1260,73 L1280,74 L1300,76 L1320,77 L1340,79 L1360,79 L1380,80 L1400,80 L1420,79 L1440,78 L1440,170 L0,170 Z" fill="#E86F51"/>
<path d="M0,88 L20,87 L40,87 L60,86 L80,86 L100,85 L120,84 L140,84 L160,84 L180,84 L200,85 L220,86 L240,87 L260,87 L280,87 L300,87 L320,86 L340,84 L360,82 L380,80 L400,77 L420,75 L440,74 L460,74 L480,74 L500,75 L520,76 L540,77 L560,78 L580,79 L600,80 L620,81 L640,81 L660,82 L680,83 L700,84 L720,85 L740,86 L760,87 L780,88 L800,89 L820,89 L840,89 L860,88 L880,87 L900,85 L920,84 L940,82 L960,81 L980,81 L1000,80 L1020,80 L1040,80 L1060,80 L1080,80 L1100,80 L1120,80 L1140,80 L1160,81 L1180,82 L1200,83 L1220,84 L1240,86 L1260,88 L1280,89 L1300,90 L1320,90 L1340,90 L1360,89 L1380,88 L1400,87 L1420,85 L1440,84 L1440,170 L0,170 Z" fill="#38606E"/>
<path d="M0,97 L20,96 L40,95 L60,95 L80,95 L100,95 L120,96 L140,97 L160,98 L180,100 L200,100 L220,101 L240,101 L260,100 L280,98 L300,97 L320,95 L340,93 L360,91 L380,90 L400,89 L420,89 L440,88 L460,89 L480,89 L500,90 L520,90 L540,90 L560,91 L580,91 L600,92 L620,93 L640,95 L660,96 L680,98 L700,99 L720,100 L740,100 L760,100 L780,99 L800,98 L820,97 L840,95 L860,94 L880,93 L900,93 L920,93 L940,93 L960,94 L980,94 L1000,94 L1020,94 L1040,94 L1060,94 L1080,93 L1100,93 L1120,94 L1140,94 L1160,95 L1180,97 L1200,98 L1220,99 L1240,100 L1260,100 L1280,99 L1300,98 L1320,97 L1340,96 L1360,95 L1380,94 L1400,94 L1420,94 L1440,95 L1440,170 L0,170 Z" fill="#2A5260"/>
<path d="M0,105 L20,105 L40,105 L60,106 L80,108 L100,109 L120,111 L140,112 L160,112 L180,112 L200,111 L220,110 L240,108 L260,107 L280,105 L300,104 L320,104 L340,103 L360,103 L380,103 L400,103 L420,103 L440,102 L460,102 L480,102 L500,102 L520,103 L540,103 L560,105 L580,106 L600,107 L620,109 L640,110 L660,111 L680,111 L700,110 L720,109 L740,108 L760,106 L780,105 L800,104 L820,103 L840,103 L860,104 L880,104 L900,105 L920,105 L940,106 L960,106 L980,106 L1000,106 L1020,106 L1040,106 L1060,106 L1080,107 L1100,108 L1120,108 L1140,109 L1160,110 L1180,110 L1200,109 L1220,109 L1240,107 L1260,106 L1280,105 L1300,104 L1320,103 L1340,103 L1360,104 L1380,105 L1400,106 L1420,107 L1440,108 L1440,170 L0,170 Z" fill="#1B4552"/>
<path d="M0,34 L20,36 L40,37 L60,38 L80,38 L100,38 L120,38 L140,37 L160,36 L180,35 L200,34 L220,33 L240,33 L260,32 L280,32 L300,30 L320,29 L340,26 L360,22 L380,17 L400,11 L420,6 L440,2 L460,3 L480,8 L500,15 L520,22 L540,27 L560,32 L580,35 L600,36 L620,36 L640,36 L660,35 L680,33 L700,31 L720,30 L740,28 L760,26 L780,25 L800,26 L820,28 L840,30 L860,31 L880,32 L900,32 L920,32 L940,32 L960,32 L980,33 L1000,33 L1020,32 L1040,31 L1060,28 L1080,25 L1100,21 L1120,18 L1140,19 L1160,21 L1180,23 L1200,25 L1220,27 L1240,28 L1260,29 L1280,30 L1300,31 L1320,32 L1340,33 L1360,33 L1380,34 L1400,34 L1420,34 L1440,34" class="topo-line"/>
<path d="M0,53 L20,54 L40,53 L60,53 L80,52 L100,51 L120,50 L140,49 L160,49 L180,48 L200,48 L220,48 L240,47 L260,46 L280,44 L300,42 L320,40 L340,37 L360,34 L380,31 L400,29 L420,27 L440,26 L460,27 L480,31 L500,35 L520,38 L540,41 L560,43 L580,45 L600,45 L620,45 L640,45 L660,45 L680,45 L700,45 L720,44 L740,43 L760,42 L780,42 L800,43 L820,44 L840,45 L860,46 L880,47 L900,48 L920,49 L940,50 L960,50 L980,51 L1000,50 L1020,48 L1040,45 L1060,42 L1080,38 L1100,34 L1120,31 L1140,31 L1160,33 L1180,35 L1200,38 L1220,40 L1240,43 L1260,45 L1280,47 L1300,48 L1320,49 L1340,49 L1360,49 L1380,50 L1400,50 L1420,50 L1440,51" class="topo-line"/>
<path d="M0,66 L20,65 L40,64 L60,64 L80,63 L100,63 L120,63 L140,62 L160,62 L180,61 L200,61 L220,59 L240,58 L260,57 L280,55 L300,54 L320,53 L340,52 L360,51 L380,51 L400,50 L420,48 L440,47 L460,47 L480,48 L500,49 L520,50 L540,51 L560,52 L580,53 L600,55 L620,56 L640,57 L660,58 L680,59 L700,59 L720,58 L740,58 L760,57 L780,56 L800,57 L820,59 L840,60 L860,62 L880,64 L900,65 L920,66 L940,66 L960,65 L980,64 L1000,61 L1020,58 L1040,55 L1060,52 L1080,49 L1100,46 L1120,46 L1140,47 L1160,49 L1180,52 L1200,54 L1220,56 L1240,58 L1260,60 L1280,61 L1300,62 L1320,63 L1340,63 L1360,64 L1380,65 L1400,66 L1420,67 L1440,67" class="topo-line"/>
<path d="M0,76 L20,76 L40,76 L60,76 L80,76 L100,75 L120,75 L140,74 L160,73 L180,72 L200,71 L220,71 L240,70 L260,70 L280,71 L300,71 L320,71 L340,71 L360,70 L380,68 L400,66 L420,64 L440,62 L460,61 L480,60 L500,61 L520,61 L540,63 L560,64 L580,66 L600,68 L620,69 L640,70 L660,70 L680,71 L700,71 L720,71 L740,71 L760,71 L780,72 L800,74 L820,76 L840,77 L860,78 L880,79 L900,78 L920,77 L940,76 L960,74 L980,71 L1000,69 L1020,67 L1040,65 L1060,64 L1080,64 L1100,63 L1120,64 L1140,65 L1160,66 L1180,68 L1200,69 L1220,70 L1240,72 L1260,73 L1280,74 L1300,76 L1320,77 L1340,79 L1360,79 L1380,80 L1400,80 L1420,79 L1440,78" class="topo-line"/>
<path d="M0,88 L20,87 L40,87 L60,86 L80,86 L100,85 L120,84 L140,84 L160,84 L180,84 L200,85 L220,86 L240,87 L260,87 L280,87 L300,87 L320,86 L340,84 L360,82 L380,80 L400,77 L420,75 L440,74 L460,74 L480,74 L500,75 L520,76 L540,77 L560,78 L580,79 L600,80 L620,81 L640,81 L660,82 L680,83 L700,84 L720,85 L740,86 L760,87 L780,88 L800,89 L820,89 L840,89 L860,88 L880,87 L900,85 L920,84 L940,82 L960,81 L980,81 L1000,80 L1020,80 L1040,80 L1060,80 L1080,80 L1100,80 L1120,80 L1140,80 L1160,81 L1180,82 L1200,83 L1220,84 L1240,86 L1260,88 L1280,89 L1300,90 L1320,90 L1340,90 L1360,89 L1380,88 L1400,87 L1420,85 L1440,84" class="topo-line"/>
</svg></div>"""

WAVE = wave("paper")
WAVE_CREAM = wave("cream")

# ----------------------------------------------------------------------- CSS
CSS = r"""
:root{
  --teal:#1B4552; --teal-mid:#38606E; --teal-deep:#143641;
  --cream:#FDF0DC; --paper:#FBF6EC; --coral:#E86F51; --peach:#F4A261;
  --rule:#C9D3D6; --sand:#D4D1C3; --teal-sub:#33586A;
  --display:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Newsreader",Georgia,"Times New Roman",serif;
  --shell:min(1120px,100% - 48px);
  --r:14px;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{
  margin:0;background:var(--paper);color:var(--teal);
  font-family:var(--body);font-size:18px;line-height:1.65;font-optical-sizing:auto;
  font-synthesis-weight:none;-webkit-font-smoothing:antialiased;
}
img,svg{max-width:100%}
a{color:inherit}

/* ---------- type ---------- */
h1,h2,h3,h4,.display{
  font-family:var(--display);font-weight:600;
  font-variation-settings:"wdth" 108;
  line-height:1.05;letter-spacing:-.012em;margin:0;
}
h1{font-size:clamp(38px,5.6vw,68px);line-height:1.0;letter-spacing:-.022em}
h2{font-size:clamp(28px,3.8vw,44px);letter-spacing:-.018em}
h3{font-size:clamp(19px,2vw,22px);line-height:1.2;letter-spacing:-.005em}
p{margin:0 0 1.1em}
p:last-child{margin-bottom:0}
.eyebrow{
  font-family:var(--display);font-weight:600;font-size:14px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--teal-mid);
  margin:0 0 18px;display:block;font-variation-settings:"wdth" 100;
}
.lede{font-size:clamp(19px,2.1vw,22px);line-height:1.55;color:var(--teal-mid);max-width:56ch}
.small{font-size:15px;line-height:1.6;color:var(--teal-mid)}

/* ---------- layout ---------- */
.wrap{width:var(--shell);margin-inline:auto}
.section{padding-block:clamp(52px,6.5vw,88px)}
/* 1. a scenic divider already separates sections, so the padding beside it halves */
.divider + .section,.horizon + .section{padding-top:clamp(34px,4vw,56px)}
.section:has(+ .divider),.section:has(+ .horizon){padding-bottom:clamp(34px,4vw,56px)}
.section--tight{padding-block:clamp(48px,6vw,76px)}
.band-paper{background:var(--paper)}
.band-cream{background:var(--cream)}
.band-paper + .band-paper{border-top:1px solid var(--rule)}
.band-tint{background:linear-gradient(180deg,var(--sand) 0,var(--paper) 100%)}
.band-tint .card{border-color:rgba(27,69,82,.32)}
.band-tint .eyebrow,.band-tint .lede{color:var(--teal)}
.band-teal{background:var(--teal);color:var(--cream)}
.band-teal .eyebrow{color:rgba(253,240,220,.7)}
.band-teal .card .eyebrow,.band-teal .card .card__tag{color:var(--teal-mid)}
.band-teal .lede,.band-teal .small{color:rgba(253,240,220,.82)}
.head{max-width:62ch;margin-bottom:clamp(28px,3.2vw,40px)}
.head--center{margin-inline:auto;text-align:center}
.grid{display:grid;gap:22px}
.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(268px,1fr))}
.split{display:grid;gap:clamp(32px,5vw,72px);grid-template-columns:1fr;align-items:start}
@media(min-width:900px){.split{grid-template-columns:0.85fr 1.15fr}}

/* ---------- buttons ---------- */
.btn{
  display:inline-flex;align-items:center;gap:10px;
  font-family:var(--display);font-weight:600;font-size:13.5px;
  letter-spacing:.09em;text-transform:uppercase;text-decoration:none;
  padding:15px 28px;border-radius:999px;border:1.6px solid transparent;
  transition:background .18s ease,color .18s ease,border-color .18s ease,transform .18s ease;
  cursor:pointer;
}
.btn--primary{background:var(--teal);color:var(--cream)}
.btn--primary:hover{background:var(--teal-deep);transform:translateY(-1px)}
.btn--ghost{border-color:rgba(27,69,82,.28);color:var(--teal)}
.btn--ghost:hover{border-color:var(--teal);background:rgba(27,69,82,.05)}
.band-teal .btn--primary{background:var(--cream);color:var(--teal)}
.band-teal .btn--primary:hover{background:#fff}
.band-teal .btn--ghost{border-color:rgba(253,240,220,.4);color:var(--cream)}
.band-teal .btn--ghost:hover{border-color:var(--cream);background:rgba(253,240,220,.09)}
.btn-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.arrow{transition:transform .18s ease}
.btn:hover .arrow{transform:translateX(3px)}

/* ---------- header ---------- */
.masthead{
  position:sticky;top:0;z-index:60;background:rgba(251,246,236,.93);
  backdrop-filter:blur(9px);border-bottom:1px solid var(--rule);
}
.masthead__in{display:flex;align-items:center;justify-content:space-between;
  gap:24px;width:var(--shell);margin-inline:auto;padding-block:9px}
.lockup{display:block;height:auto}
.lockup--header{height:56px;width:auto}
.lockup--stacked{display:none}
@media(max-width:899px){
  .lockup--wide{display:none}
  .lockup--stacked{display:block;height:66px}
  .masthead__in{padding-block:8px}
}
@media(max-width:400px){.lockup--stacked{height:56px}}
.brandlink{display:inline-flex;text-decoration:none;border-radius:6px}
.nav{display:none;align-items:center;gap:30px}
.nav a{
  font-family:var(--display);font-weight:500;font-size:17px;text-decoration:none;
  padding:6px 0;position:relative;letter-spacing:.005em;
}
.nav a::after{
  content:"";position:absolute;left:0;right:0;bottom:0;height:2px;
  background:var(--teal);transform:scaleX(0);transform-origin:left;
  transition:transform .2s ease;
}
.nav a:hover::after{transform:scaleX(1)}
.nav a[aria-current="page"]::after{transform:scaleX(1);background:var(--coral)}
.masthead .btn{padding:13px 24px;font-size:13px;display:none}
@media(min-width:900px){.masthead .btn{display:inline-flex}}
.navtoggle{
  display:inline-flex;align-items:center;justify-content:center;flex:none;
  width:46px;height:46px;padding:0;background:none;border:1px solid var(--rule);
  border-radius:10px;cursor:pointer;color:var(--teal);
  -webkit-appearance:none;appearance:none;
}
.navtoggle__icon{display:block;width:24px;height:24px}
.navtoggle__icon path{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;
  transform-box:fill-box;transform-origin:center;transition:transform .2s ease,opacity .2s ease}
.navtoggle[aria-expanded="true"] .nt1{transform:translateY(5px) rotate(45deg)}
.navtoggle[aria-expanded="true"] .nt2{opacity:0}
.navtoggle[aria-expanded="true"] .nt3{transform:translateY(-5px) rotate(-45deg)}
.mobilenav{display:none;border-top:1px solid var(--rule);background:var(--paper)}
.mobilenav.open{display:block}
.mobilenav ul{list-style:none;margin:0;padding:8px 0 20px;width:var(--shell);margin-inline:auto}
.mobilenav a{
  display:block;padding:14px 2px;text-decoration:none;font-family:var(--display);
  font-weight:500;font-size:17px;border-bottom:1px solid var(--rule);
}
.mobilenav li:last-child a{border-bottom:none;padding-top:20px}
@media(min-width:900px){
  .nav{display:flex}
  .navtoggle{display:none}
  .mobilenav,.mobilenav.open{display:none}
}

/* ---------- hero ---------- */
.hero{position:relative;overflow:hidden;background:var(--paper);
  padding-block:clamp(40px,5vw,66px) 0;text-align:center}
.hero__glow{
  position:absolute;left:50%;top:-110px;width:min(760px,120%);aspect-ratio:1;
  transform:translateX(-50%);border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(232,111,81,.32) 0%,rgba(232,111,81,.13) 44%,rgba(232,111,81,0) 70%);
}
.hero__in{position:relative;width:var(--shell);margin-inline:auto}
.badge{width:104px;height:104px;display:block;margin:0 auto 26px}
.hero h1{max-width:16ch;margin-inline:auto}
.hero .lede{margin:22px auto 0;text-align:center}
.hero .btn-row{justify-content:center;margin-top:34px}
.hero__foot{margin-top:clamp(28px,3vw,40px);padding-bottom:6px}
.hero__in{z-index:2}
/* home hero: let the glow fade out behind the ridge instead of stopping at the hero edge */
.hero:not(.hero--lite){background:transparent;overflow:visible;overflow-x:clip}
.hero:not(.hero--lite) .hero__glow{z-index:-1}
.hero:not(.hero--lite) + .divider--ridge{background:transparent}
@supports not (overflow:clip){.hero:not(.hero--lite) .hero__glow{width:min(760px,100%)}}
.hero--lite{text-align:left;padding-block:clamp(40px,4.5vw,60px) clamp(26px,3vw,38px)}
.hero--lite h1{max-width:20ch;margin-inline:0}
.hero--lite .lede{margin:20px 0 0;text-align:left}
.hero--lite::after{content:"";position:absolute;left:0;right:0;bottom:0;height:45%;
  pointer-events:none;background:linear-gradient(to bottom,rgba(251,246,236,0),var(--paper))}

/* ---------- dividers ---------- */
.divider{line-height:0}
.divider svg{display:block;width:100%}
.divider--ridge{background:var(--paper)}
.divider--ridge svg{height:clamp(84px,10vw,132px)}
.divider--ridge,.divider--wave{position:relative}
.divider--ridge::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--teal)}
.divider--wave::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--teal)}
.ridge-back{fill:var(--coral);opacity:.88}
.ridge-front{fill:var(--teal)}
.ridge-rim{fill:none;stroke:var(--cream);stroke-opacity:.55;stroke-width:2;vector-effect:non-scaling-stroke}
.divider--arc{background:var(--paper)}
.divider--arc.arc--inverse .arc-fill{fill:var(--paper)}
.divider--arc.arc--teal .arc-fill{fill:var(--teal)}
.divider--arc.arc--teal .arc-line{display:none}
.band-tint--inverse{background:linear-gradient(180deg,var(--paper) 0,var(--sand) 180px)}
.divider--arc svg{height:clamp(58px,6.5vw,96px)}
.arc-fill{fill:var(--sand)}
.arc-line{fill:none;stroke:var(--coral);stroke-width:3;vector-effect:non-scaling-stroke}
.divider--angle{background:var(--sand)}
.divider--angle svg{height:clamp(38px,4vw,62px)}
.angle-fill{fill:var(--paper)}
.divider--wave{background:var(--paper)}
.divider--wave.to-cream{background:var(--cream)}
.divider--wave svg{height:clamp(90px,10.5vw,165px)}
.tide-far{fill:var(--teal-mid);opacity:.35}
.tide-mid{fill:var(--teal-mid)}
.tide-front{fill:var(--teal)}
.divider--ridge.from-cream{background:var(--cream)}
.divider--topo{position:relative;background:var(--cream);margin-bottom:-1px}
.divider--topo svg{height:clamp(72px,8.9vw,128px)}
.divider--topo + .section{padding-top:clamp(22px,2.6vw,36px)}
.divider--topo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--teal)}
.topo-line{fill:none;stroke:var(--teal);stroke-width:1.5;opacity:.35;vector-effect:non-scaling-stroke}
.divider--ridge.from-sand{background:var(--sand)}

/* ---------- cards ---------- */
.card{
  background:var(--cream);border:1px solid rgba(27,69,82,.13);border-radius:var(--r);
  padding:clamp(24px,3vw,32px);
}
.band-teal .card{background:var(--cream);border-color:transparent;color:var(--teal)}
.band-teal .card .small{color:var(--teal-mid)}
.card h3{margin-bottom:10px}
.card--dark{background:var(--teal);border-color:transparent;color:var(--cream)}
.card.card--dark h3{color:var(--cream)}
.card.card--dark p{color:rgba(253,240,220,.88)}
.pkgs{align-items:stretch}
.pkg{display:flex;flex-direction:column;position:relative;overflow:hidden;
  padding-bottom:calc(clamp(24px,3vw,32px) + 25px)}
.pkg::before{content:"";position:absolute;left:0;right:0;bottom:0;height:7px;background:var(--coral)}
.pkg--l2::before{height:16px;background:linear-gradient(to top,var(--coral) 0 7px,var(--cream) 7px 9px,#EE8A5B 9px 16px)}
.pkg--l3::before{height:25px;background:linear-gradient(to top,var(--coral) 0 7px,var(--cream) 7px 9px,#EE8A5B 9px 16px,var(--cream) 16px 18px,var(--peach) 18px 25px)}
.pkg h3{font-size:clamp(28px,3vw,36px);margin-bottom:0}
.pkg .pkg__line{margin:12px 0 0;font-size:clamp(17.5px,1.35vw,19.5px);line-height:1.55}
.pkg .checks{margin-top:24px;gap:14px}
.pkg .checks li{font-size:clamp(17px,1.3vw,19px)}
.card--dark .btn--primary{background:var(--cream);color:var(--teal)}
.card--dark .btn--primary:hover{background:#fff}
.card--dark .btn--ghost{border-color:rgba(253,240,220,.4);color:var(--cream)}
.card--dark .btn--ghost:hover{border-color:var(--cream);background:rgba(253,240,220,.09)}
.card--dark .btn--peach{border-color:var(--peach);color:var(--peach)}
.card--dark .btn--peach:hover{border-color:var(--peach);background:rgba(244,162,97,.12)}
.steps-card{padding:clamp(6px,1.2vw,14px) clamp(22px,3.4vw,46px)}
.card--dark .faq{border-top:none}
.card--dark .faq details{border-bottom-color:rgba(253,240,220,.2)}
.card--dark .faq details:last-child{border-bottom:none}
.card--dark .faq summary::after{border-right-color:var(--cream);border-bottom-color:var(--cream)}
.card--dark .faq p{font-size:clamp(17.5px,1.35vw,19.5px);color:rgba(253,240,220,.84)}
.steps-card .faq{border-top:none}
.steps-card .faq details:last-child{border-bottom:none}
.steps-card .faq p{font-size:clamp(17.5px,1.35vw,19.5px)}
.steps-card--paper{background:var(--paper);border:2px solid rgba(27,69,82,.5)}
.steps-foot,.band-foot{text-align:center;margin-top:clamp(30px,3.6vw,44px)}
.steps-foot .accent-bar,.band-foot .accent-bar{margin:0 auto 16px}
.steps-foot p,.band-foot p{font-size:clamp(17.5px,1.4vw,20px);color:var(--teal-mid);margin:0 auto;max-width:52ch}
.steps-foot p{font-size:clamp(19px,1.75vw,23px);max-width:48ch}
.band-foot a{color:var(--teal);font-weight:500;text-decoration:none;border-bottom:1.5px solid var(--coral);padding-bottom:1px}
.band-foot a:hover{border-bottom-color:var(--teal)}
.steps-card--paper .faq details{border-bottom:2px solid rgba(27,69,82,.34)}
.steps-card--paper .faq p{color:var(--teal-sub)}
.steps-card--paper .stepnum{color:var(--coral)}
.card--dark .stepnum{color:var(--peach)}
.faq details:has(.stepnum) > p{padding-left:52px}
.cta-card{padding:clamp(34px,5vw,64px) clamp(24px,4vw,56px)}
.cta-card .lede{font-size:clamp(19px,2.1vw,22px);line-height:1.55}
.ways{list-style:none;margin:0;padding:0}
.ways li{padding:22px 0;border-top:1px solid rgba(27,69,82,.16)}
.ways li:first-child{border-top:none;padding-top:0}
.ways .card__tag{margin-bottom:6px}
.ways h3{font-size:clamp(24px,2.4vw,30px);margin-bottom:6px}
.ways h3::before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;
  background:var(--coral);margin-right:12px;vertical-align:.18em}
.accent-bar--left{margin:18px 0 0}
.card.card--dark.card--terms h3{color:var(--peach)}
.ways p{color:var(--teal-mid);font-size:clamp(17.5px,1.35vw,19.5px);line-height:1.55;margin:0}
.card--who{display:flex;flex-direction:column}
.card__link{margin-top:auto;padding-top:18px;align-self:flex-start;font-family:var(--display);
  font-weight:500;font-size:15.5px;color:var(--teal);text-decoration:none}
.card__fit{margin-top:auto;padding-top:18px;font-family:var(--display);font-weight:500;
  font-size:15.5px;color:var(--teal-mid)}
.card__fit strong{color:var(--teal);font-weight:700;border-bottom:2px solid var(--coral);padding-bottom:1px}
.card__link strong{font-weight:700;border-bottom:2px solid var(--coral);padding-bottom:1px}
.card__link:hover .arrow{transform:translateX(3px)}
.choice{border:0;padding:0;margin:0;min-width:0}
.choice legend{font-family:var(--display);font-weight:600;font-size:13px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--teal-mid);padding:0;margin-bottom:10px}
.choice__opts{display:flex;flex-wrap:wrap;gap:10px}
.pill{position:relative;cursor:pointer}
.pill input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.pill span{display:inline-block;padding:12px 18px;border:1.5px solid var(--rule);border-radius:999px;
  background:var(--paper);font-family:var(--display);font-weight:500;font-size:15.5px;color:var(--teal);
  transition:background .15s ease,color .15s ease,border-color .15s ease}
.pill:hover span{border-color:var(--teal)}
.pill input:checked + span{background:var(--teal);border-color:var(--teal);color:var(--cream)}
.pill input:focus-visible + span{outline:3px solid var(--coral);outline-offset:2px}
.optional{text-transform:none;letter-spacing:0;font-weight:500;color:var(--teal-mid)}
.pricing-note{text-align:center;margin-top:clamp(36px,4.2vw,52px)}
.pricing-note .lede{margin-inline:auto}
.know h3{font-size:clamp(20px,1.75vw,24px);margin-bottom:8px}
.know p{color:var(--teal-mid);font-size:clamp(17.5px,1.35vw,19.5px);line-height:1.55;margin:0}
.know__n{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;
  border:1.5px solid var(--coral);font-family:var(--display);font-weight:600;font-size:15px;
  color:var(--teal);margin-bottom:12px}
.plan{padding:clamp(30px,3.8vw,46px);display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center}
.plan .card__tag{font-size:14px;margin-bottom:10px}
.plan p{max-width:44ch;margin:0}
.accent-bar{display:block;width:64px;height:4px;border-radius:2px;margin:14px auto 18px;
  background:linear-gradient(90deg,var(--coral) 0 60%,var(--peach) 60% 100%)}
.yearly{display:flex;justify-content:center;margin-top:30px}
.yearly span{font-family:var(--display);font-weight:600;font-size:14px;letter-spacing:.13em;
  text-transform:uppercase;padding:12px 20px;border:1.5px solid var(--peach)}
.yearly__a{color:var(--cream);border-color:rgba(253,240,220,.5)!important;border-right:none!important;
  border-radius:999px 0 0 999px}
.yearly__b{background:var(--peach);color:var(--teal);border-radius:0 999px 999px 0}
.plan h3{font-size:clamp(28px,3vw,36px);margin-bottom:10px}
.card.card--dark .eyebrow{color:rgba(253,240,220,.7)}
.careplan{padding:clamp(30px,4.6vw,58px)}
.careplan .lede{font-size:clamp(19px,2.1vw,22px);line-height:1.55}
.careplan .small{font-size:15.5px}
.band-cream--framed{position:relative}
.horizon{position:relative;height:clamp(122px,11vw,152px);
  background:linear-gradient(to bottom,var(--paper) 50%,var(--cream) 50%)}
.horizon::before{content:"";position:absolute;left:0;right:0;top:50%;height:1.3px;
  transform:translateY(-50%);background:linear-gradient(to right,
  rgba(159,176,181,0) 0,#9FB0B5 32%,#9FB0B5 calc(50% - 74px),transparent calc(50% - 74px),
  transparent calc(50% + 74px),#9FB0B5 calc(50% + 74px),#9FB0B5 68%,rgba(159,176,181,0) 100%)}
.horizon--close{background:linear-gradient(to bottom,var(--cream) 50%,var(--paper) 50%)}
.horizon--close::before{background:linear-gradient(to right,
  rgba(159,176,181,0) 0,#9FB0B5 32%,#9FB0B5 calc(50% - 62px),transparent calc(50% - 62px),
  transparent calc(50% + 62px),#9FB0B5 calc(50% + 62px),#9FB0B5 68%,rgba(159,176,181,0) 100%)}
.horizon--plain::before{background:linear-gradient(to right,
  rgba(159,176,181,0) 0,#9FB0B5 32%,#9FB0B5 68%,rgba(159,176,181,0) 100%)}
.horizon svg{position:absolute;left:50%;top:50%;width:180px;height:148px;transform:translate(-50%,-50%)}
.horizon{--rise:1}
.sunrise .sun-up{transform:translateY(calc((1 - var(--rise)) * 72px));
  opacity:calc(.25 + var(--rise) * .75)}
.sunrise .sun-refl{opacity:clamp(0,calc((var(--rise) - .45) / .55),1)}
.card p{font-size:16.5px;line-height:1.6;color:var(--teal-mid)}
.card.plan p{font-size:clamp(17.5px,1.35vw,19.5px);line-height:1.6}
.band-teal .card p{color:var(--teal-mid)}
.srow{display:grid;gap:clamp(22px,3.5vw,54px);grid-template-columns:1fr;
  padding-block:clamp(30px,4vw,46px);border-top:1px solid rgba(27,69,82,.18)}
.srow:first-child{border-top:none;padding-top:0}
.band-teal .srow{border-top-color:rgba(253,240,220,.22)}
.band-teal .srow p,.band-teal .srow__tag{color:rgba(253,240,220,.78)}
.srow:last-child{padding-bottom:0}
.srow h3{font-size:clamp(23px,2.7vw,30px);margin-bottom:12px}
.srow p{font-size:17.5px;line-height:1.55;color:var(--teal-sub);margin:0}
.srow__tag{font-family:var(--display);font-size:11.5px;font-weight:600;letter-spacing:.17em;
  text-transform:uppercase;color:var(--teal-sub);display:block;margin-bottom:12px}
@media(min-width:860px){
  .srow{grid-template-columns:0.92fr 1.08fr;align-items:start}
  .srow:nth-child(even) .srow__intro{order:2}
  .srow:nth-child(even) .checks{order:1}
}
.card__tag{
  font-family:var(--display);font-size:13px;font-weight:600;letter-spacing:.16em;
  text-transform:uppercase;color:var(--teal-mid);display:block;margin-bottom:12px;
}
.sun{width:9px;height:9px;border-radius:50%;background:var(--coral);flex:none;margin-top:11px}

/* ---------- lists ---------- */
.checks{list-style:none;margin:0;padding:0;display:grid;gap:15px}
.checks li{display:flex;gap:14px;align-items:flex-start;font-size:17px;line-height:1.55}
.facts{
  list-style:none;margin:0;padding:0;display:grid;gap:14px 34px;
  grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
}
.facts li{display:flex;gap:12px;align-items:flex-start;font-family:var(--display);
  font-size:14.5px;font-weight:500;line-height:1.45}
.facts .sun{margin-top:calc((1.45em - 9px) / 2 + 1px)}

/* ---------- steps ---------- */
.track{display:grid;grid-template-columns:repeat(4,1fr);margin-top:10px}
.track__step{text-align:center;padding:0 12px}
.track__n{display:block;font-family:var(--display);font-weight:600;font-size:12.5px;
  letter-spacing:.16em;color:var(--teal-mid);margin-bottom:14px}
.track__marker{position:relative;display:block;height:18px;margin-bottom:18px}
.track__marker::before{content:"";position:absolute;left:-12px;right:-12px;top:50%;
  height:2px;background:rgba(244,162,97,.75);transform:translateY(-50%)}
.track__step:first-child .track__marker::before{left:50%}
.track__step:last-child .track__marker::before{right:50%}
.track__dot{position:absolute;left:50%;top:50%;width:16px;height:16px;border-radius:50%;
  background:var(--coral);transform:translate(-50%,-50%)}
.track__step:last-child .track__dot{width:20px;height:20px;box-shadow:0 0 0 5px rgba(244,162,97,.45)}
.track h3{margin-bottom:9px}
.track p{font-size:15.5px;line-height:1.5;color:var(--teal-mid);margin:0}
@media(max-width:899px){
  .track{grid-template-columns:repeat(2,1fr);gap:34px 26px}
  .track__marker::before{display:none}
}
@media(max-width:559px){
  .track{grid-template-columns:1fr;gap:28px}
  .track__step{text-align:left;padding:0}
  .track__dot{left:8px;transform:translate(0,-50%)}
  .track__marker{height:14px;margin-bottom:12px}
}
.steps{display:grid;gap:2px;margin-top:8px;border-top:1px solid rgba(253,240,220,.22)}
.band-paper .steps{border-top-color:var(--rule)}
.band-paper .step{border-bottom-color:var(--rule)}
.band-paper .step__n{color:var(--teal-mid)}
.band-paper .step p{color:var(--teal-mid)}
.step{display:grid;gap:6px 28px;padding:26px 0;border-bottom:1px solid rgba(253,240,220,.22)}
@media(min-width:760px){.step{grid-template-columns:74px 1fr}}
.step__n{
  font-family:var(--display);font-weight:600;font-size:15px;letter-spacing:.12em;
  color:rgba(253,240,220,.6);padding-top:5px;
}
.step h3{margin-bottom:6px}
.step p{color:rgba(253,240,220,.8);font-size:16.5px;margin:0}

/* ---------- browser mockups ---------- */
.mock{border-radius:12px;overflow:hidden;border:1px solid var(--rule);background:#fff}
.mock__bar{display:flex;align-items:center;gap:6px;padding:9px 12px;background:#EDE6DA;
  border-bottom:1px solid var(--rule)}
.mock__dot{width:8px;height:8px;border-radius:50%;background:#C6BCAB}
.mock__url{flex:1;margin-left:8px;height:16px;border-radius:8px;background:#FBF6EC;
  font-family:var(--display);font-size:9.5px;letter-spacing:.04em;color:#8C9BA1;
  display:flex;align-items:center;padding:0 9px}
.mock__body{padding:0}
.mock__hero{padding:26px 22px 24px;color:#fff}
.mock__eyebrow{font-family:var(--display);font-size:8.5px;letter-spacing:.2em;
  text-transform:uppercase;opacity:.82;margin-bottom:8px}
.mock__h{font-family:var(--display);font-weight:600;font-size:21px;line-height:1.1;margin:0 0 10px}
.mock__p{font-size:11.5px;line-height:1.5;opacity:.85;margin:0 0 14px;max-width:34ch}
.mock__btn{display:inline-block;font-family:var(--display);font-size:9px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;padding:8px 14px;border-radius:999px}
.mock__row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px 22px 22px;background:#fff}
.mock__tile{border-radius:7px;padding:11px 10px;font-family:var(--display);font-size:9.5px;
  font-weight:600;line-height:1.35;min-height:58px;display:flex;align-items:flex-end}

/* ---------- faq ---------- */
.faq{border-top:1px solid var(--rule)}
.band-teal .faq,.band-teal .faq details{border-color:rgba(253,240,220,.24)}
.band-teal .faq summary::after{border-right-color:var(--cream);border-bottom-color:var(--cream)}
.band-teal .faq p{color:rgba(253,240,220,.82)}
.stepnum{display:inline-block;width:52px;font-size:14px;letter-spacing:.15em;
  font-weight:500;color:var(--teal-mid)}
.band-teal .stepnum{color:rgba(253,240,220,.55)}
.faq details{border-bottom:1px solid var(--rule)}
.faq summary{
  list-style:none;cursor:pointer;padding:22px 40px 22px 0;position:relative;
  font-family:var(--display);font-weight:600;font-size:clamp(19px,1.55vw,22px);line-height:1.35;
}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{
  content:"";position:absolute;right:6px;top:50%;margin-top:-9px;width:11px;height:11px;
  border-right:2px solid var(--teal);border-bottom:2px solid var(--teal);
  transform:rotate(45deg);transition:transform .2s ease;
}
.faq details[open] summary::after{transform:rotate(225deg)}
.faq p{padding:0 40px 24px 0;color:var(--teal-mid);font-size:clamp(17.5px,1.35vw,19.5px);line-height:1.6;margin:0;max-width:72ch}

/* ---------- form ---------- */
.form{display:grid;gap:20px}
.field{display:grid;gap:8px}
.field label{font-family:var(--display);font-weight:600;font-size:13px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--teal-mid)}
.field input,.field select,.field textarea{
  font-family:var(--body);font-size:17px;color:var(--teal);background:var(--paper);
  border:1.5px solid var(--rule);border-radius:10px;padding:14px 15px;width:100%;
  transition:border-color .16s ease;
}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--teal)}
.field textarea{min-height:150px;resize:vertical}
.field--pair{display:grid;gap:20px;grid-template-columns:1fr}
@media(min-width:680px){.field--pair{grid-template-columns:1fr 1fr}}
.formnote{font-size:14.5px;color:var(--teal-mid);margin:0}
.formstatus{display:none;border-radius:var(--r);border:1.5px solid var(--teal);
  background:var(--paper);padding:22px 24px}
.formstatus.show{display:block}
.formstatus h3{margin-bottom:8px}

/* ---------- contact rail ---------- */
.rail{display:grid;gap:26px}
.rail__item{border-top:1px solid var(--rule);padding-top:18px}
.rail__item h3{font-size:16px;margin-bottom:6px}
.rail__item a{font-family:var(--display);font-weight:500;text-decoration:none;
  border-bottom:1.5px solid var(--coral);padding-bottom:1px}

/* ---------- footer ---------- */
.foot{background:var(--teal);color:var(--cream);padding-block:clamp(52px,6vw,72px) 30px}
.lockup--footer{height:88px;width:auto}
.foot__top{display:grid;gap:40px;grid-template-columns:1fr}
@media(min-width:820px){.foot__top{grid-template-columns:1.2fr .8fr .8fr}}
.foot h4{font-family:var(--display);font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;
  font-weight:600;color:rgba(253,240,220,.62);margin:0 0 16px}
.foot ul{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.foot a{text-decoration:none;font-family:var(--display);font-size:15px;font-weight:400;
  color:rgba(253,240,220,.92)}
.foot a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}
.foot__blurb{margin:22px 0 0;font-size:16px;color:rgba(253,240,220,.78);max-width:38ch}
.foot__base{margin-top:46px;padding-top:22px;border-top:1px solid rgba(253,240,220,.2);
  display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:space-between;
  font-size:13.5px;color:rgba(253,240,220,.62);font-family:var(--display)}

/* ---------- a11y + motion ---------- */
.skip{position:absolute;left:-9999px;top:0;background:var(--teal);color:var(--cream);
  padding:12px 18px;border-radius:0 0 8px 0;z-index:100;font-family:var(--display);font-size:14px}
.skip:focus{left:0}
:focus-visible{outline:3px solid var(--coral);outline-offset:3px;border-radius:4px}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}
.reveal.in{opacity:1;transform:none}
.hero .badge{animation:rise .9s cubic-bezier(.2,.7,.3,1) both}
.hero h1{animation:rise .9s .1s cubic-bezier(.2,.7,.3,1) both}
.hero .lede,.hero .btn-row{animation:rise .9s .18s cubic-bezier(.2,.7,.3,1) both}
@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation:none!important;transition:none!important}
  .reveal{opacity:1;transform:none}
}
"""

JS = r"""
(function(){
  var t=document.querySelector('.navtoggle'), m=document.getElementById('mobilenav');
  if(t&&m){t.addEventListener('click',function(){
    var open=t.getAttribute('aria-expanded')==='true';
    t.setAttribute('aria-expanded',String(!open));
    m.classList.toggle('open',!open);
  });}
  var els=document.querySelectorAll('.reveal');
  if(!window.IntersectionObserver||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    els.forEach(function(e){e.classList.add('in');});
  }else{
    var io=new IntersectionObserver(function(en){
      en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(function(e){io.observe(e);});
  }
  var hz=document.querySelector('.sunrise');
  if(hz){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      hz.style.setProperty('--rise','1');
    }else{
      var ticking=false;
      var upd=function(){
        ticking=false;
        var r=hz.getBoundingClientRect();
        var vh=window.innerHeight||document.documentElement.clientHeight;
        var p=Math.max(0,Math.min(1,(vh-r.top)/(vh*0.55)));
        p=p*p*(3-2*p);
        hz.style.setProperty('--rise',p.toFixed(3));
      };
      var onScroll=function(){if(!ticking){ticking=true;requestAnimationFrame(upd);}};
      window.addEventListener('scroll',onScroll,{passive:true});
      window.addEventListener('resize',onScroll);
      upd();
    }
  }
  var pre={'#pricing':'want-pricing','#call':'want-call'}[location.hash];
  if(pre){var w=document.getElementById(pre);if(w)w.checked=true;}
  var f=document.getElementById('projectform');
  if(f){f.addEventListener('submit',function(ev){
    var action=f.getAttribute('action')||'';
    if(action.indexOf('YOUR_FORM_ID')>-1){
      ev.preventDefault();
      if(!f.checkValidity()){f.reportValidity();return;}
      document.getElementById('formstatus').classList.add('show');
      f.style.display='none';
      window.scrollTo({top:f.parentNode.offsetTop-90,behavior:'smooth'});
    }
  });}
})();
"""

# ------------------------------------------------------------------- chrome
NAV = [("index.html","Home"),("services.html","Packages"),("contact.html","Contact")]

def nav_links(current, cls=""):
    out=[]
    for href,label in NAV:
        cur=' aria-current="page"' if href==current else ''
        out.append('<a href="%s"%s>%s</a>'%(href,cur,label))
    return "\n        ".join(out)

def mobile_links(current):
    out=[]
    for href,label in NAV:
        cur=' aria-current="page"' if href==current else ''
        out.append('<li><a href="%s"%s>%s</a></li>'%(href,cur,label))
    return "\n      ".join(out)

def masthead(current):
    return """<header class="masthead">
  <div class="masthead__in">
    <a class="brandlink" href="index.html" aria-label="Beaumont West Solutions — home">%s%s</a>
    <nav class="nav" aria-label="Primary">
        %s
    </nav>
    <a class="btn btn--primary" href="contact.html">Start a project</a>
    <button class="navtoggle" type="button" aria-expanded="false" aria-controls="mobilenav" aria-label="Menu">
      <svg class="navtoggle__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="nt1" d="M4 7h16"/><path class="nt2" d="M4 12h16"/><path class="nt3" d="M4 17h16"/></svg>
    </button>
  </div>
  <div class="mobilenav" id="mobilenav">
    <ul>
      %s
    </ul>
  </div>
</header>""" % (header_lockup("hd"), stacked_lockup("hs"), nav_links(current), mobile_links(current))

FOOTER = """<footer class="foot">
  <div class="wrap">
    <div class="foot__top">
      <div>
        %s
        <p class="foot__blurb">Websites for service businesses on the coast and everywhere
        else. Designed, built, and handed over — keys included.</p>
      </div>
      <div>
        <h4>Pages</h4>
        <ul>
          <li><a href="index.html">Home</a></li>
          <li><a href="services.html">Packages</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Get in touch</h4>
        <ul>
          <li><a href="mailto:hello@beaumontwest.com">hello@beaumontwest.com</a></li>
          <li><a href="tel:+15550142200">(555) 014-2200</a></li>
          <li><a href="contact.html">Start a project</a></li>
        </ul>
      </div>
    </div>
    <div class="foot__base">
      <span>© 2026 Beaumont West Solutions</span>
      <span>Replies within one business day</span>
    </div>
  </div>
</footer>""" % footer_lockup("ft")

def page(slug, title, desc, body):
    out = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title>
<meta name="description" content="%s">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:type" content="website">
<meta property="og:image" content="%s/assets/bws-social-1200x630.png">
<meta name="theme-color" content="#1B4552">
<link rel="icon" href="assets/bws-favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="assets/bws-favicon-32.png">
<link rel="apple-touch-icon" href="assets/bws-logo-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>%s</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
%s
<main id="main">
%s
</main>
%s
<script>%s</script>
</body>
</html>
""" % (html.escape(title), html.escape(desc), html.escape(title), html.escape(desc),
       SITE_URL, CSS, masthead(slug), body, FOOTER, JS)
    out = out.replace("Beaumont West Solutions", BRAND)
    out = out.replace("hello@beaumontwest.com", EMAIL)
    out = out.replace("(555) 014-2200", PHONE_DISPLAY)
    out = out.replace("+15550142200", PHONE_LINK)
    out = out.replace("\u00a9 2026", "\u00a9 " + YEAR)
    n = [0]
    def _haze(m):
        n[0] += 1
        return 'id="ridge-haze-%d"%surl(#ridge-haze-%d)' % (n[0], m.group(1), n[0])
    out = re.sub(r'id="ridge-haze"(.*?)url\(#ridge-haze\)', _haze, out, flags=re.S)
    return out

# ==========================================================================
#  HOME
# ==========================================================================
home = """
<section class="hero">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="hero__in">
    %s
    <span class="eyebrow">Websites for service businesses</span>
    <h1>Good work deserves to be seen.</h1>
    <p class="lede">For the businesses people call, book and recommend. Three clear packages,
    live in one to three weeks.</p>
    <div class="btn-row">
      <a class="btn btn--primary" href="contact.html">Start a project <span class="arrow">&rarr;</span></a>
      <a class="btn btn--ghost" href="services.html">See the packages</a>
    </div>
    <div class="hero__foot"></div>
  </div>
</section>

%s

<section class="section band-teal">
  <div class="wrap">
    <ul class="facts reveal">
      <li><span class="sun" aria-hidden="true"></span><span>Live in one to three weeks</span></li>
      <li><span class="sun" aria-hidden="true"></span><span>Built for phones first</span></li>
      <li><span class="sun" aria-hidden="true"></span><span>Three fixed packages, no hourly billing</span></li>
      <li><span class="sun" aria-hidden="true"></span><span>Care plans optional</span></li>
    </ul>
  </div>
  <div class="wrap" style="margin-top:clamp(40px,4.8vw,64px)">
    <div class="head reveal">
      <span class="eyebrow">Who we build for</span>
      <h2>Three versions of the same problem</h2>
    </div>
    <div class="grid g3 reveal">
      <article class="card card--who">
        <span class="card__tag">No site at all</span>
        <h3>Running on referrals</h3>
        <p>Which works right up until someone searches your name at 9pm and finds nothing.</p>
        <span class="card__fit">Best fit: <strong>Starter</strong></span>
      </article>
      <article class="card card--who">
        <span class="card__tag">A site you're stuck with</span>
        <h3>Built in 2016</h3>
        <p>You can't change the hours, and nobody remembers who has the login.</p>
        <span class="card__fit">Best fit: <strong>Standard</strong></span>
      </article>
      <article class="card card--who">
        <span class="card__tag">Outgrowing word of mouth</span>
        <h3>Admin after hours</h3>
        <p>Quotes and bookings by text, every evening. The site should take the first pass.</p>
        <span class="card__fit">Best fit: <strong>Premium</strong></span>
      </article>
    </div>
  </div>
</section>

%s

<section class="section band-paper">
  <div class="wrap split">
    <div class="reveal">
      <span class="eyebrow">Packages</span>
      <h2>Three ways to start</h2>
      <span class="accent-bar accent-bar--left" aria-hidden="true"></span>
      <p class="lede" style="margin-top:18px">Pricing is on request. Ask for the price sheet, or we'll
      go through it on a quick call.</p>
      <div class="btn-row" style="margin-top:26px">
        <a class="btn btn--ghost" href="services.html">Compare the packages <span class="arrow">&rarr;</span></a>
      </div>
    </div>
    <ul class="ways reveal">
      <li>
        <span class="card__tag">Get found</span>
        <h3>Starter</h3>
        <p>Everything a customer needs to find you and get in touch, on one page.</p>
      </li>
      <li>
        <span class="card__tag">Look established</span>
        <h3>Standard</h3>
        <p>A full five-page site, with the words written for you.</p>
      </li>
      <li>
        <span class="card__tag">Win more customers</span>
        <h3>Premium</h3>
        <p>Online booking, a page for every service, and your Google profile set up.</p>
      </li>
    </ul>
  </div>
</section>

%s

<section class="section band-cream band-cream--framed" style="padding-block:clamp(32px,3.8vw,52px)">
  <div class="wrap">
    <div class="head reveal">
      <span class="eyebrow">Plain terms</span>
      <h2>How pricing works</h2>
      <p class="lede" style="margin-top:18px">Each package has a fixed price, so you know the full cost
      before anything starts.</p>
    </div>
    <div class="grid g3 reveal">
      <article class="card card--dark card--terms">
        <h3>Fixed, not hourly</h3>
        <p style="margin-top:8px">One price per package. Extra pages and custom work are quoted up front.</p>
      </article>
      <article class="card card--dark card--terms">
        <h3>Half now, half at launch</h3>
        <p style="margin-top:8px">You pay the balance when your site goes live.</p>
      </article>
      <article class="card card--dark card--terms">
        <h3>Upgrade any time</h3>
        <p style="margin-top:8px">Move up within six months and everything you've paid counts toward the new package.</p>
      </article>
    </div>
    <div class="band-foot reveal">
      <span class="accent-bar" aria-hidden="true"></span>
      <p>Want the numbers? <a href="contact.html#pricing">Request the price sheet</a> and it'll be in
      your inbox within one business day.</p>
    </div>
  </div>
</section>

%s

<section class="section band-paper">
  <div class="wrap">
    <div class="head reveal">
      <span class="eyebrow">How it goes</span>
      <h2>Four steps, one to three weeks</h2>
    </div>
    <div class="track reveal">
      <div class="track__step">
        <span class="track__n">01</span>
        <span class="track__marker"><span class="track__dot"></span></span>
        <h3>Intake form</h3>
        <p>Your details, photos and what you want said.</p>
      </div>
      <div class="track__step">
        <span class="track__n">02</span>
        <span class="track__marker"><span class="track__dot"></span></span>
        <h3>Sample page</h3>
        <p>One page first, to confirm the direction.</p>
      </div>
      <div class="track__step">
        <span class="track__n">03</span>
        <span class="track__marker"><span class="track__dot"></span></span>
        <h3>Build out</h3>
        <p>Your feedback, carried through every page.</p>
      </div>
      <div class="track__step">
        <span class="track__n">04</span>
        <span class="track__marker"><span class="track__dot"></span></span>
        <h3>Launch</h3>
        <p>Tested on real phones, then live.</p>
      </div>
    </div>
    <div class="btn-row" style="margin-top:40px">
      <a class="btn btn--primary" href="contact.html">Start a project <span class="arrow">&rarr;</span></a>
    </div>
  </div>
</section>

%s
"""
home = home % (badge("hero"), RIDGE, WAVE, SUN_HORIZON, MOUNTAIN_HORIZON, RIDGE)

# ==========================================================================
#  SERVICES
# ==========================================================================
def pkg(tag, name, line, points, level=1):
    lis = "".join('<li><span class="sun" aria-hidden="true"></span><span>%s</span></li>' % p
                  for p in points)
    return """<article class="card pkg%s reveal">
  <span class="card__tag">%s</span>
  <h3>%s</h3>
  <p class="pkg__line">%s</p>
  <ul class="checks">%s</ul>
</article>""" % (" pkg--l%d" % level, tag, name, line, lis)


def step(n, title, body, open_=False):
    return """      <details%s>
        <summary><span class="stepnum">%s</span>%s</summary>
        <p>%s</p>
      </details>""" % (" open" if open_ else "", n, title, body)


def know(n, q, a):
    return """<div class="know">
  <span class="know__n">%s</span>
  <h3>%s</h3>
  <p>%s</p>
</div>""" % (n, q, a)


def faq(q, a):
    return """      <details>
        <summary>%s</summary>
        <p>%s</p>
      </details>""" % (q, a)


services = """
<section class="hero hero--lite">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="hero__in">
    <div class="head" style="margin-bottom:0">
      <span class="eyebrow">Packages</span>
      <h1 style="font-size:clamp(34px,4.6vw,56px)">Three packages. One standard of work.</h1>
      <p class="lede" style="margin-top:20px">Every site is designed for your business, built for
      phones, and live in one to three weeks. Pick the one that fits where you are now. You can
      move up later.</p>
    </div>
  </div>
</section>

%s

<section class="section band-teal">
  <div class="wrap">
    <div class="grid g3 pkgs">
      %s
      %s
      %s
    </div>
    <div class="pricing-note reveal">
      <p class="lede">Pricing is on request. Ask for the price sheet, or we'll go through it on a
      quick call.</p>
      <div class="btn-row" style="justify-content:center;margin-top:24px">
        <a class="btn btn--primary" href="contact.html#pricing">Request the price sheet <span class="arrow">&rarr;</span></a>
        <a class="btn btn--ghost" href="contact.html#call">Book a call</a>
      </div>
    </div>
  </div>
</section>

%s

<section class="section band-paper">
  <div class="wrap">
    <div class="head reveal">
      <span class="eyebrow">Good to know</span>
      <h2>Room to grow</h2>
    </div>
    <div class="grid g3 reveal">
      %s
      %s
      %s
    </div>
  </div>
</section>

%s

<section class="section band-cream">
  <div class="wrap">
    <div class="head reveal">
      <span class="eyebrow">How a project runs</span>
      <h2>Four steps, one to three weeks</h2>
      <p class="lede" style="margin-top:18px">Open any step to see what happens and what we need
      from you.</p>
    </div>
    <div class="card steps-card steps-card--paper reveal"><div class="faq">
%s
%s
%s
%s
    </div></div>
    <div class="steps-foot reveal">
      <span class="accent-bar" aria-hidden="true"></span>
      <p>Half to start, half at launch. Nothing is charged until you've chosen your package.</p>
    </div>
  </div>
</section>

%s

<section class="section band-teal">
  <div class="wrap">
    <div class="head reveal">
      <span class="eyebrow">After launch</span>
      <h2>Care plans, if you want one</h2>
      <p class="lede" style="margin-top:18px">Optional. Without a plan, we set you up with your own
      hosting account and hand over your site's files at launch. Upkeep and edits are then yours.</p>
    </div>
    <div class="grid g2 reveal">
      <article class="card plan">
        <span class="card__tag">Keep it running</span>
        <h3>Essential</h3>
        <span class="accent-bar" aria-hidden="true"></span>
        <p>Hosting, security, backups and small updates each month, so your site stays fast, safe
        and current.</p>
      </article>
      <article class="card plan">
        <span class="card__tag">Keep it growing</span>
        <h3>Growth</h3>
        <span class="accent-bar" aria-hidden="true"></span>
        <p>Everything in Essential, plus more update time, a monthly post and upkeep on your Google
        profile, and a monthly report on your leads.</p>
      </article>
    </div>
    <div class="yearly reveal"><span class="yearly__a">Pay yearly</span><span class="yearly__b">Two months free</span></div>
  </div>
</section>

%s

<section class="section band-paper">
  <div class="wrap">
    <div class="head reveal" style="max-width:52ch">
      <span class="eyebrow">Common questions</span>
      <h2>Before you call</h2>
    </div>
    <div class="faq reveal">
%s
%s
%s
%s
%s
    </div>
    <div class="card card--dark cta-card reveal" style="text-align:center;margin-top:clamp(48px,5.6vw,72px)">
      <h2 style="max-width:22ch;margin-inline:auto">Not sure which package fits?</h2>
      <span class="accent-bar" aria-hidden="true"></span>
      <p class="lede" style="margin:0 auto;text-align:center">That's what the call is for. Tell
      us about the business and we'll recommend one, including the smaller one if it'll do.</p>
      <div class="btn-row" style="justify-content:center;margin-top:28px">
        <a class="btn btn--primary" href="contact.html">Start a project <span class="arrow">&rarr;</span></a>
        <a class="btn btn--ghost btn--peach" href="contact.html#pricing">Request the price sheet</a>
      </div>
    </div>
  </div>
</section>

%s
""" % (
  RIDGE,
  pkg("Get found", "Starter",
      "Everything a customer needs to find you and get in touch, on one page.",
      ["One-page website", "Contact form and click-to-call", "Built for phones first"]),
  pkg("Look established", "Standard",
      "A full site that looks the part, with the words written for you.",
      ["Everything in Starter",
       "Five pages: home, services, about, reviews and photo gallery",
       "Page copy written from your intake form"], level=2),
  pkg("Win more customers", "Premium",
      "A site that brings in work: bookings online, found in local search.",
      ["Everything in Standard", "Up to eight pages", "A search-ready page for each service",
       "Online booking", "Google Business Profile setup"], level=3),
  WAVE,
  know("1", "Need more pages?", "Standard and Premium can add pages one at a time."),
  know("2", "Something custom?", "Tell us what you need and we'll quote it up front."),
  know("3", "Upgrading later?", "Move up within six months and everything you've paid counts "
       "toward the new package."),
  SUN_HORIZON,
  step("01", "Complete the intake form",
       "Share your business details, services and photos so the site is tailored to you. On "
       "Standard and Premium we write your page copy from it, so the more you share, the more it "
       "sounds like you.", open_=True),
  step("02", "Review a sample page",
       "We design one page first, so you can confirm the direction before the rest is built. On "
       "Starter, that page is your whole site."),
  step("03", "Refine and build out",
       "We incorporate your feedback, then carry it through the remaining pages. Most sites are "
       "ready in one to three weeks, depending on the package and how quickly the intake form "
       "comes back."),
  step("04", "Launch",
       "We point your domain, test on real phones and go live. Then it runs on your own hosting "
       "account, or we look after it on a care plan."),
  TOPO, WAVE,
  faq("How much does a site cost?",
      "Each package has a fixed price, so you'll know the full cost before we start. Ask for the "
      "price sheet on the contact page, or we'll go through it on a quick call."),
  faq("How does payment work?",
      "Half to start and half at launch. Premium can also be split into smaller payments."),
  faq("Do I need a care plan?",
      "No. Without one, we set you up with your own hosting account and hand over your site's "
      "files at launch. From then on, upkeep and edits are yours. Either way, your domain is "
      "registered in your name."),
  faq("I don't have any good photos.",
      "Common, and fixable. We'll work with what's on your phone, or build the design around type "
      "and colour so it doesn't lean on photography at all. What we won't do is fill your site "
      "with stock images of someone else's business."),
  faq("What if I already have a site?",
      "Then the first question is whether it needs rebuilding or just fixing. Sometimes a day of "
      "cleanup beats a new site, and we'll tell you that even though it's the smaller invoice. If "
      "we do rebuild, your existing pages get redirected so you don't lose the search rankings "
      "you've built up."),
  RIDGE)

# ==========================================================================
#  CONTACT
# ==========================================================================
contact = """
<section class="hero hero--lite">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="hero__in">
    <div class="head" style="margin-bottom:0">
      <span class="eyebrow">Contact</span>
      <h1 style="font-size:clamp(34px,4.6vw,56px)">Tell us about the business.</h1>
      <p class="lede" style="margin-top:20px">Ask for the price sheet, book a call, or both. You'll
      hear back within one business day, from a person.</p>
    </div>
  </div>
</section>

<section class="section band-paper" style="padding-top:clamp(28px,3.5vw,44px)">
  <div class="wrap split">
    <div class="reveal">
      <div class="formstatus" id="formstatus" role="status">
        <h3>Form isn't connected yet</h3>
        <p class="small" style="margin-top:10px">Your details look complete, but this site has no
        form handler wired up. Point the form's <code>action</code> at Formspree, Netlify Forms or
        your own endpoint before launch.</p>
      </div>
      <form class="form" id="projectform" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
        <fieldset class="choice">
          <legend>What would you like?</legend>
          <div class="choice__opts">
            <label class="pill"><input type="radio" name="want" value="Price sheet" id="want-pricing" required><span>Send me the price sheet</span></label>
            <label class="pill"><input type="radio" name="want" value="Call" id="want-call"><span>Book a call</span></label>
            <label class="pill"><input type="radio" name="want" value="Both" id="want-both"><span>Both</span></label>
          </div>
        </fieldset>
        <div class="field--pair">
          <div class="field">
            <label for="name">Your name</label>
            <input id="name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="business">Business name</label>
            <input id="business" name="business" type="text" autocomplete="organization" required>
          </div>
        </div>
        <div class="field--pair">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="phone">Phone <span class="optional">(optional)</span></label>
            <input id="phone" name="phone" type="tel" autocomplete="tel">
          </div>
        </div>
        <div class="field">
          <label for="package">Which package are you leaning toward?</label>
          <select id="package" name="package">
            <option>Not sure yet</option>
            <option>Starter</option>
            <option>Standard</option>
            <option>Premium</option>
          </select>
        </div>
        <div class="field--pair">
          <div class="field">
            <label for="kind">What kind of business is it?</label>
            <select id="kind" name="kind" required>
              <option value="">Choose one</option>
              <option>Salon, spa or personal care</option>
              <option>Gym, studio or coaching</option>
              <option>Landscaping, outdoor or property</option>
              <option>Trades and home services</option>
              <option>Food, drink or hospitality</option>
              <option>Professional services</option>
              <option>Something else</option>
            </select>
          </div>
          <div class="field">
            <label for="current">Do you have a website now?</label>
            <select id="current" name="current" required>
              <option value="">Choose one</option>
              <option>No website at all</option>
              <option>Only a social media page</option>
              <option>An old site that needs replacing</option>
              <option>A site that mostly works but needs help</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="notes">Anything we should know? <span class="optional">(optional)</span></label>
          <textarea id="notes" name="notes" placeholder="What you do, where you work, and what's not working right now."></textarea>
        </div>
        <div class="btn-row" style="margin-top:4px">
          <button class="btn btn--primary" type="submit">Send it over <span class="arrow">&rarr;</span></button>
        </div>
        <p class="formnote">We'll only use this to reply to you. No list, no newsletter, no sharing.</p>
      </form>
    </div>

    <div class="reveal">
      <div class="rail">
        <div class="rail__item">
          <h3>Email</h3>
          <p class="small" style="margin-bottom:8px">Best for details, photos and existing site links.</p>
          <a href="mailto:hello@beaumontwest.com">hello@beaumontwest.com</a>
        </div>
        <div class="rail__item">
          <h3>Phone</h3>
          <p class="small" style="margin-bottom:8px">Weekdays, 8am to 6pm Pacific. Text is fine.</p>
          <a href="tel:+15550142200">(555) 014-2200</a>
        </div>
        <div class="rail__item">
          <h3>What happens next</h3>
          <p class="small">Asked for pricing? We'll email you the price sheet within one business
          day. Booked a call? We'll reply with times that suit you. Nothing is charged until you
          choose a package and pay the first half.</p>
        </div>
      </div>
    </div>
  </div>
</section>

%s
""" % RIDGE

# ==========================================================================
PAGES = [
 ("index.html","Beaumont West Solutions — Websites for service businesses",
  "Websites for the businesses people call, book and recommend. Three clear packages, live in one to three weeks.", home),
 ("services.html","Packages — Beaumont West Solutions",
  "Three website packages for service businesses — Starter, Standard and Premium — plus optional monthly care plans. Live in one to three weeks.", services),
 ("contact.html","Contact — Beaumont West Solutions",
  "Request the price sheet or book a call. You'll hear back within one business day, from a person.", contact),
]

os.makedirs(OUT, exist_ok=True)
adir = os.path.join(OUT, "assets")
if os.path.abspath(SRC) != os.path.abspath(adir):
    os.makedirs(adir, exist_ok=True)
    for f in os.listdir(SRC):
        shutil.copy(os.path.join(SRC, f), os.path.join(adir, f))

# pages that no longer exist should not linger in the deploy folder
for gone in ("work.html", "about.html"):
    p = os.path.join(OUT, gone)
    if os.path.exists(p):
        os.remove(p)
        print("removed", gone)

for slug, title, desc, body in PAGES:
    with open(os.path.join(OUT, slug), "w") as fh:
        fh.write(page(slug, title, desc, body))
    print("wrote", slug, os.path.getsize(os.path.join(OUT, slug)), "bytes")
