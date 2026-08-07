/* חיפוש מקומות — בלי מפתח API ובלי ספריות חיצוניות.
   חיפוש שמות מקומות: Nominatim (OpenStreetMap).
   מקומות באזור לפי קטגוריה: Overpass API.
   תצוגת המפה עצמה: מפת גוגל מוטמעת (iframe). */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// ברירת המחדל שנטענת מיד עם פתיחת המפה — כל מה שמעניין בטיול משפחתי
export const AROUND_CATEGORY = {
  key: 'around', label: '✨ מה יש באזור',
  filters: [
    '["tourism"~"^(attraction|viewpoint|museum|zoo|theme_park|picnic_site)$"]',
    '["natural"~"^(beach|spring|waterfall)$"]',
    '["leisure"~"^(park|playground|water_park)$"]',
  ],
};

export const CATEGORIES = [
  { key: 'food', label: '🍽️ אוכל', filters: ['["amenity"~"^(restaurant|cafe|fast_food|ice_cream)$"]'] },
  { key: 'beach', label: '🏖️ חופים', filters: ['["natural"="beach"]', '["leisure"="beach_resort"]'] },
  { key: 'water', label: '💧 מעיינות ומפלים', filters: ['["natural"~"^(spring|waterfall)$"]'] },
  { key: 'park', label: '🌳 פארק ופיקניק', filters: ['["leisure"="park"]', '["tourism"="picnic_site"]'] },
  { key: 'fun', label: '🎡 אטרקציות', filters: ['["tourism"~"^(attraction|museum|zoo|theme_park|viewpoint)$"]'] },
  { key: 'play', label: '🛝 מתקני משחקים', filters: ['["leisure"="playground"]'] },
  { key: 'camp', label: '⛺ קמפינג', filters: ['["tourism"~"^(camp_site|caravan_site)$"]'] },
  { key: 'water_tap', label: '🚻 שירותים וברזיות', filters: ['["amenity"~"^(toilets|drinking_water)$"]'] },
  { key: 'parking', label: '🅿️ חניה', filters: ['["amenity"="parking"]'] },
];

/* ---------- חיפוש לפי שם ---------- */

export async function searchPlaces(query, near) {
  const params = new URLSearchParams({
    format: 'jsonv2', q: query, limit: '10', 'accept-language': 'he', addressdetails: '1',
  });
  if (near) {
    // הטיה לאזור הנוכחי, בלי לחסום תוצאות מחוצה לו
    const d = 0.6;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${NOMINATIM}?${params}`);
  if (!res.ok) throw new Error('search failed');
  const data = await res.json();
  return data.map((r) => ({
    name: shortName(r),
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

function shortName(r) {
  const parts = (r.display_name || '').split(',');
  return (r.name || parts[0] || '').trim() || parts[0]?.trim() || 'מקום';
}

/* ---------- מקומות באזור לפי קטגוריה ---------- */

export async function nearbyPlaces(category, center, radiusMeters = 5000) {
  const around = `around:${radiusMeters},${center.lat},${center.lng}`;
  const union = category.filters.map((f) => `nwr(${around})${f};`).join('');
  const query = `[out:json][timeout:25];(${union});out center 60;`;

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error('overpass failed');
  const data = await res.json();

  return (data.elements || [])
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const tags = e.tags || {};
      const name = tags['name:he'] || tags.name;
      if (!lat || !lng || !name) return null;
      return { name, lat, lng, address: describeTags(tags), distance: distanceKm(center, { lat, lng }) };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 30);
}

const TAG_LABELS = {
  restaurant: 'מסעדה', cafe: 'בית קפה', fast_food: 'אוכל מהיר', ice_cream: 'גלידה',
  beach: 'חוף', beach_resort: 'חוף מוסדר', spring: 'מעיין', waterfall: 'מפל',
  park: 'פארק', picnic_site: 'פיקניק', attraction: 'אטרקציה', museum: 'מוזיאון',
  zoo: 'גן חיות', theme_park: 'פארק שעשועים', viewpoint: 'תצפית', playground: 'מתקני משחקים',
  camp_site: 'קמפינג', caravan_site: 'קרוואנים', toilets: 'שירותים',
  drinking_water: 'ברזייה', parking: 'חניה',
};

function describeTags(tags) {
  for (const key of ['amenity', 'tourism', 'leisure', 'natural']) {
    const label = TAG_LABELS[tags[key]];
    if (label) return label;
  }
  return '';
}

/* ---------- מרחק ---------- */

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} מ׳` : `${km.toFixed(1)} ק״מ`;
}

/* ---------- קישורים למפות ---------- */

export function googleEmbedUrl(place, zoom = 15) {
  return `https://maps.google.com/maps?q=${place.lat},${place.lng}&z=${zoom}&hl=iw&output=embed`;
}

export function googleMapsUrl(place) {
  if (place.lat && place.lng) {
    const q = `${place.lat},${place.lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || '')}`;
}

export function wazeUrl(place) {
  if (place.lat && place.lng) return `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(place.name || '')}&navigate=yes`;
}

/* מסלול הנסיעה של כל היום בגוגל מפות (נפתח באפליקציה עם כל העצירות) */
export function googleRouteUrl(stops) {
  const pts = stops.filter((s) => s.lat && s.lng).map((s) => `${s.lat},${s.lng}`);
  if (pts.length < 2) return null;
  const origin = pts[0];
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(1, -1).join('|');
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params}`;
}
