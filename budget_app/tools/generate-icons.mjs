/**
 * Regenerates every app icon in ../assets from one SVG mark.
 *
 * Kept out of the app bundle deliberately: it is a build-time tool, and it
 * needs Playwright, which is not a dependency of the app.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/generate-icons.mjs ./assets
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];

/**
 * The mark: a coin tucked behind a pocket. Two shapes, high contrast, no thin
 * strokes — so it still reads at 48px in a tab or a home-screen grid.
 * Its bounding box is x 192-832, y 270-800 (centre 512, 535).
 */
const mark = (pocket, coin, coinRim) => `
  <circle cx="512" cy="404" r="132" fill="${coin}"/>
  <circle cx="512" cy="404" r="132" fill="none" stroke="${coinRim}" stroke-width="14"/>
  <path d="M192 470 Q512 596 832 470 L832 736 Q832 800 768 800 L256 800 Q192 800 192 736 Z" fill="${pocket}"/>
`;

const GREEN_DARK = '#15803D';
const GREEN = '#16A34A';
const WHITE = '#FFFFFF';
const AMBER = '#FBBF24';
const AMBER_RIM = '#D97706';

function svg({ size, background, content, scale = 1, centreY = 535 }) {
  const transform =
    scale === 1 ? '' : `transform="translate(512 512) scale(${scale}) translate(-512 -${centreY})"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GREEN}"/>
        <stop offset="1" stop-color="${GREEN_DARK}"/>
      </linearGradient>
    </defs>
    ${background}
    <g ${transform}>${content}</g>
  </svg>`;
}

const FULL_BG = '<rect width="1024" height="1024" fill="url(#bg)"/>';

const assets = [
  // iOS and the general-purpose icon: full bleed, the OS masks the corners.
  // Scaled a touch and re-centred: the mark's own centre sits below the
  // canvas centre, which otherwise leaves a band of empty green above it.
  { file: 'icon.png', size: 1024, svg: svg({ size: 1024, background: FULL_BG, content: mark(WHITE, AMBER, AMBER_RIM), scale: 1.06 }) },
  { file: 'favicon.png', size: 96, svg: svg({ size: 96, background: FULL_BG, content: mark(WHITE, AMBER, AMBER_RIM), scale: 1.06 }) },

  // Android adaptive layers. The foreground is scaled into the central safe
  // zone, because the launcher masks and can zoom the outer third away.
  { file: 'android-icon-background.png', size: 1024, svg: svg({ size: 1024, background: FULL_BG, content: '' }) },
  {
    file: 'android-icon-foreground.png',
    size: 1024,
    transparent: true,
    svg: svg({ size: 1024, background: '', content: mark(WHITE, AMBER, AMBER_RIM), scale: 0.62 }),
  },
  // Themed icons: only the alpha channel is used, so this is one flat colour.
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    transparent: true,
    svg: svg({ size: 1024, background: '', content: mark(WHITE, WHITE, WHITE), scale: 0.62 }),
  },

  // Splash: sits on the dark splash background, so it needs no plate of its own.
  {
    file: 'splash-icon.png',
    size: 1024,
    transparent: true,
    svg: svg({ size: 1024, background: '', content: mark(WHITE, AMBER, AMBER_RIM), scale: 0.78 }),
  },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const asset of assets) {
  const page = await browser.newPage({ viewport: { width: asset.size, height: asset.size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${asset.svg}`,
    { waitUntil: 'load' }
  );
  await page.screenshot({ path: `${OUT}/${asset.file}`, omitBackground: asset.transparent === true });
  console.log(`${asset.file} ${asset.size}x${asset.size}${asset.transparent ? ' (transparent)' : ''}`);
  await page.close();
}
await browser.close();
