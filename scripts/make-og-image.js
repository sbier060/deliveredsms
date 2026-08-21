#!/usr/bin/env node
// The social card: public/og.png, 1200x630.
//
//   node scripts/make-og-image.js           write it
//   node scripts/make-og-image.js --check   fail if the committed file differs
//
// ── Why a static file and not app/opengraph-image.tsx ───────────────────────
//
// ImageResponse would render this per request at the edge. That is a runtime
// dependency for something that changes when the tagline changes, i.e. almost
// never, and a failure there is invisible until someone pastes a link. A file
// in public/ is one CDN fetch, cannot fail at request time, and `curl -I
// https://resms.com/og.png` after a deploy is the whole verification.
//
// ── Why it exists ───────────────────────────────────────────────────────────
//
// Every page carried og:title and og:description and no image, and the Twitter
// card was `summary`, so a link to any of the 35 indexed pages unfurled as a
// grey box with a hostname. For an API whose docs get pasted developer to
// developer in Slack all day, that is the most-seen surface the site has.
//
// Colours are the tokens in tailwind.config.js and DESIGN.md: near-black
// surfaces, one signal-green accent. Type is a neutral grotesk, because the
// site itself renders in system-ui and shipping a webfont for one PNG would be
// a second type system.

const { execFileSync } = require('child_process');
const { existsSync, readFileSync, mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REAL = path.join(ROOT, 'public', 'og.png');
const CHECK = process.argv.includes('--check');
const OUT = CHECK ? path.join(mkdtempSync(path.join(tmpdir(), 'resms-og-')), 'og.png') : REAL;

const FONT = '/usr/share/fonts/truetype/dejavu';
if (!existsSync(FONT)) {
  console.error(`no font directory at ${FONT} — install fonts-dejavu or point FONT at another grotesk`);
  process.exit(1);
}

const py = `
import pathlib
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
GROUND = (17, 17, 18, 255)      # #111112, the page surface
CARD   = (28, 28, 30, 255)      # #1C1C1E, the raised surface
LINE   = (46, 44, 40, 255)      # #2E2C28, the hairline
INK    = (239, 238, 236, 255)   # #EFEEEC
MUTED  = (201, 198, 191, 255)   # #C9C6BF
ACCENT = (0, 210, 106, 255)     # #00D26A, the one accent

card = Image.new('RGBA', (W, H), GROUND)
d = ImageDraw.Draw(card)

bold = ImageFont.truetype('${FONT}/DejaVuSans-Bold.ttf', 76)
body = ImageFont.truetype('${FONT}/DejaVuSans.ttf', 30)
mono = ImageFont.truetype('${FONT}/DejaVuSansMono.ttf', 26)
meta = ImageFont.truetype('${FONT}/DejaVuSans.ttf', 24)

# The hero glow, flattened: the landing page's one loud element, as a soft
# green wash off the top edge. Drawn as concentric alpha bands rather than a
# real gradient because PIL has no radial fill and 24 bands is invisible.
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for i in range(24, 0, -1):
    r = 300 + i * 26
    a = int(9 * (i / 24) ** 2)
    gd.ellipse([W / 2 - r, -r * 0.62, W / 2 + r, r * 0.5], fill=(0, 210, 106, a))
card.alpha_composite(glow)

# Wordmark: a green dot and the name. The site has no logotype file, so this is
# the name set in type rather than an invented mark.
d.ellipse([80, 92, 104, 116], fill=ACCENT)
d.text((120, 78), 'Resms', font=ImageFont.truetype('${FONT}/DejaVuSans-Bold.ttf', 38), fill=INK)

d.text((80, 210), 'SMS for developers', font=bold, fill=INK)
d.text((80, 320), 'Send and receive texts, verify phone numbers, and', font=body, fill=MUTED)
d.text((80, 362), 'provision real US and Canada numbers with one API.', font=body, fill=MUTED)

# The one concrete fact worth putting on a card someone glances at: a free
# sandbox key, instantly, is the objection this removes.
d.rounded_rectangle([80, 436, 720, 502], radius=12, fill=CARD, outline=LINE, width=1)
d.text((104, 456), 'curl -H "Authorization: Bearer resms_sk_test_..."', font=mono, fill=MUTED)

d.text((80, H - 76), 'resms.com', font=meta, fill=INK)
d.text((80 + d.textlength('resms.com', font=meta) + 24, H - 76),
       'Free sandbox, no card', font=meta, fill=ACCENT)

out = pathlib.Path(${JSON.stringify(OUT)})
out.parent.mkdir(parents=True, exist_ok=True)
card.convert('RGB').save(out, 'PNG', optimize=True)
print(f'  og.png  {W}x{H}  {out.stat().st_size // 1024} KB')
`;

execFileSync('python3', ['-c', py], { stdio: 'inherit' });

if (CHECK) {
  const same = existsSync(REAL) && Buffer.compare(readFileSync(REAL), readFileSync(OUT)) === 0;
  if (!same) {
    console.error('\n  public/og.png is stale — run: node scripts/make-og-image.js\n');
    process.exit(1);
  }
  console.log('  public/og.png is current');
}
