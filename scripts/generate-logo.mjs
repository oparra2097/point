import sharp from 'sharp';
import fs from 'node:fs';

const NAVY = '#0B1220';
const BLUE_LIGHT = '#2E7CF6';
const BLUE_DEEP = '#0B3D91';
const GHOST = '#8FC0FF';

/**
 * One lowercase "p": a descending stem plus a bowl drawn as a donut so the
 * counter is genuinely transparent rather than filled with a background
 * colour -- which matters for the adaptive-icon foreground and the splash,
 * where whatever sits behind must show through.
 */
function glyph(fill, opacity = 1) {
  return `
    <g fill="${fill}" opacity="${opacity}">
      <rect x="25" y="21" width="11.5" height="57" rx="5.75"/>
      <path fill-rule="evenodd" d="
        M 47 22 a 17.5 17.5 0 1 1 0 35 a 17.5 17.5 0 1 1 0 -35 Z
        M 47 31.5 a 8 8 0 1 0 0 16 a 8 8 0 1 0 0 -16 Z
      "/>
    </g>`;
}

/**
 * Two offset letterforms, the mark's whole idea: depth from overlap.
 *
 * The front glyph's counter is masked out of the ghost behind it, so the hole
 * shows clean background instead of the ghost's own bowl. The mask sits OUTSIDE
 * the ghost's own translate -- a transform on the masked element moves its mask
 * with it, which lands the knockout in the wrong place. Without that the
 * counter fills with a muddy crescent and reads as an accident rather than
 * part of the letterform.
 */
function mark(maskId = 'counter') {
  return `
    <g transform="translate(50,50) skewX(-7) translate(-52,-50)">
      <mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect x="-20" y="-20" width="140" height="140" fill="#FFFFFF"/>
        <circle cx="47" cy="39.5" r="8" fill="#000000"/>
      </mask>
      <g mask="url(#${maskId})"><g transform="translate(9,7)">${glyph(GHOST, 0.92)}</g></g>
      ${glyph('#FFFFFF')}
    </g>`;
}

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BLUE_LIGHT}"/>
      <stop offset="1" stop-color="${BLUE_DEEP}"/>
    </linearGradient>
  </defs>`;

const svg = (body, bg = '') =>
  `<svg width="1024" height="1024" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${gradient}${bg}${body}</svg>`;

// Full-bleed square: iOS applies its own corner mask, so no rounding here.
const icon = svg(mark('m1'), `<rect width="100" height="100" fill="url(#bg)"/>`);

// Android adaptive foreground: transparent, and inset to the 66% safe zone
// so the launcher can crop to a circle or squircle without clipping the mark.
const adaptiveFg = svg(`<g transform="translate(50,50) scale(0.62) translate(-50,-50)">${mark('m2')}</g>`);
const adaptiveBg = svg('', `<rect width="100" height="100" fill="url(#bg)"/>`);

// Monochrome (themed icons): single flat colour, no gradient, no two-tone.
const monochrome = svg(
  `<g transform="translate(50,50) scale(0.62) translate(-50,-50)">
     <g transform="translate(50,50) skewX(-7) translate(-52,-50)">${glyph('#FFFFFF')}</g>
   </g>`,
);

// Splash: transparent so the configured background colour shows through.
const splash = svg(`<g transform="translate(50,50) scale(0.82) translate(-50,-50)">${mark('m3')}</g>`);

const out = async (svgStr, file, size) => {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(`assets/${file}`);
  const { size: bytes } = fs.statSync(`assets/${file}`);
  console.log(`  assets/${file}  ${size}x${size}  ${(bytes / 1024).toFixed(1)}KB`);
};

await out(icon, 'icon.png', 1024);
await out(adaptiveFg, 'android-icon-foreground.png', 1024);
await out(adaptiveBg, 'android-icon-background.png', 1024);
await out(monochrome, 'android-icon-monochrome.png', 1024);
await out(splash, 'splash-icon.png', 512);
await out(icon, 'favicon.png', 64);

fs.writeFileSync('assets/logo.svg', icon);
console.log('\nNAVY reference:', NAVY);
