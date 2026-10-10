// Neighborhoods and purchase sources. These are the defaults; admins edit the
// live lists in config/lists from the admin page, and the app reads those.
export const DEFAULT_HOODS = [
  { id: 'ramat-a', he: "רמה א'", en: 'Ramat A' },
  { id: 'ramat-b', he: "רמה ב'", en: 'Ramat B' },
  { id: 'ramat-g1', he: "רמה ג'1", en: 'Ramat G1' },
  { id: 'ramat-g2', he: "רמה ג'2", en: 'Ramat G2' },
  { id: 'ramat-d', he: "רמה ד'", en: 'Ramat D' },
  { id: 'ramat-e', he: "רמה ה'", en: 'Ramat E' },
  { id: 'givat-sharet', he: 'גבעת שרת', en: 'Givat Sharett' },
  { id: 'sheinfeld', he: 'שיינפלד', en: 'Sheinfeld' },
  { id: 'nofei-aviv', he: 'נופי אביב', en: 'Nofei Aviv' },
  { id: 'old-city', he: 'בית שמש הוותיקה', en: 'Old Beit Shemesh' },
  { id: 'mishkenot-yaakov', he: 'משכנות יעקב', en: 'Mishkenot Yaakov' },
  { id: 'migdal-hamayim', he: 'מגדל המים', en: 'Migdal HaMayim' },
  { id: 'nachala', he: 'נחלה ומנוחה', en: 'Nachala uMenucha' },
  { id: 'nofei-hashemesh', he: 'נופי השמש', en: 'Nofei HaShemesh' },
];

export const DEFAULT_SOURCES = [
  { id: 'shein', he: 'Shein', en: 'Shein' },
  { id: 'temu', he: 'Temu', en: 'Temu' },
  { id: 'aliexpress', he: 'AliExpress', en: 'AliExpress' },
  { id: 'amazon', he: 'Amazon', en: 'Amazon' },
  { id: 'next', he: 'Next', en: 'Next' },
  { id: 'asos', he: 'ASOS', en: 'ASOS' },
  { id: 'zara', he: 'Zara', en: 'Zara' },
  { id: 'hm', he: 'H&M', en: 'H&M' },
  { id: 'terminalx', he: 'Terminal X', en: 'Terminal X' },
  { id: 'ksp', he: 'KSP', en: 'KSP' },
  { id: 'other', he: 'אחר', en: 'Other' },
];

export const CATS = ['clothes', 'shoes', 'toys', 'electronics', 'home', 'other'];
export const WHO = ['women', 'men', 'girls', 'boys', 'baby', 'unisex', 'na'];
export const AGES = ['a0', 'a2', 'a6', 'a12', 'adult', 'na'];
export const CONDS = ['tag', 'notag', 'once'];
export const PROBLEMS = ['big', 'small', 'color', 'pattern', 'quality', 'dislike', 'other'];
export const REPORT_REASONS = ['notnew', 'spam', 'wrong', 'offensive', 'other'];

export const CAT_EMOJI = { clothes: '👕', shoes: '👟', toys: '🧸', electronics: '🎧', home: '🛋️', other: '📦' };
