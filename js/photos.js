// Photos are compressed in the browser before they leave the phone: a 4MB
// camera shot becomes ~80KB. They are stored as data URLs in Firestore, so
// the whole app runs on one free service with no card on file.

const MAX_SIDE = 1000;
const THUMB_W = 360, THUMB_H = 450; // 4:5, the feed card's shape
const BUDGET = 900000;               // a Firestore document holds 1MB

async function bitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}

function encode(canvas, quality) {
  // Safari cannot encode WebP and silently returns PNG; JPEG is the fallback.
  let url = canvas.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
  return url;
}

function draw(img, w, h, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}

export async function compress(file, side = MAX_SIDE, quality = 0.74) {
  const img = await bitmap(file);
  const s = Math.min(1, side / Math.max(img.width, img.height));
  return encode(draw(img, Math.round(img.width * s), Math.round(img.height * s)), quality);
}

// The feed thumbnail: cropped to 4:5 around the centre.
export async function thumbFrom(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const want = THUMB_W / THUMB_H;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (sw / sh > want) { sw = sh * want; sx = (img.width - sw) / 2; } else { sh = sw / want; sy = (img.height - sh) / 2; }
  let q = 0.66, out;
  do { out = encode(draw(img, THUMB_W, THUMB_H, sx, sy, sw, sh), q); q -= 0.1; } while (out.length > 80000 && q > 0.3);
  return out;
}

// Keep all photos together under the document limit.
export async function fitBudget(files) {
  let side = MAX_SIDE, q = 0.74, list = [];
  for (let i = 0; i < 4; i++) {
    list = [];
    for (const f of files) list.push(await compress(f, side, q));
    if (list.reduce((n, s) => n + s.length, 0) <= BUDGET) return list;
    side = Math.round(side * 0.82); q -= 0.06;
  }
  return list;
}
