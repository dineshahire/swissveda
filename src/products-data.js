// Product catalog — drives the data-bound PDP (product.html?id=...) and the
// home Products dropdown. Add a product = add an entry here.
const GHEE = [
  'Carries the actives deep into the body',
  'Strengthens the immune system',
  'Rich in vitamins A, E & D',
  'Protects the gut lining',
  'From free-roaming Alpine herds',
  'Full traceability, Swiss-made',
];

export const PRODUCTS = {
  tribulus: {
    name: 'Natural Tribulus', sub: 'in 100% Natural Swiss Ghee', accent: '#d4a017',
    eyebrow: 'Ayurvedic Botanical', price: 'CHF 49', img: 'products/product-box.png',
    lede: 'A well-known traditional plant valued for its compounds — for those seeking a holistic, balanced everyday.',
    self: ['Supports a balanced wellness routine', 'Aids stamina & physical drive', 'Traditional plant for vitality', 'Supports hormonal balance', 'Antioxidant-rich', 'Long natural-practice heritage'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat)*, rapeseed oil, tribulus terrestris extract, emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
  shilajit: {
    name: 'Natural Shilajit', sub: 'in 100% Natural Swiss Ghee', accent: '#6b5ca5',
    eyebrow: 'Ayurvedic Adaptogen', price: 'CHF 49', img: 'products/product-box.png',
    lede: 'A mineral-rich Himalayan resin, slow-bound into pure Alpine ghee so your body actually absorbs it.',
    self: ['Boosts energy & endurance', 'Rich in fulvic acid & 80+ minerals', 'Supports vitality, libido & fertility', 'Helps balance hormones', 'Sharpens focus & cognition', 'Fights inflammation & cellular ageing'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat, 500 mg)*, rapeseed oil, shilajit extract (Asphaltum punjabianum, 340 mg incl. 170 mg fulvic acid), emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
  shatavari: {
    name: 'Natural Shatavari', sub: 'in 100% Natural Swiss Ghee', accent: '#c9789f',
    eyebrow: 'Ayurvedic Adaptogen', price: 'CHF 49', img: 'products/product-box.png',
    lede: 'A key Ayurvedic adaptogen supporting hormonal balance, vitality and calm.',
    self: ['Supports female hormonal balance', 'Boosts vitality & energy', 'Aids digestion', 'Adaptogenic — manages stress', 'Rich in antioxidants', 'Protects cells from ageing'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat)*, rapeseed oil, shatavari extract (Asparagus racemosus), emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
  bacopa: {
    name: 'Natural Bacopa', sub: 'in 100% Natural Swiss Ghee', accent: '#4aa7d8',
    eyebrow: 'Ayurvedic Nootropic', price: 'CHF 49', img: 'img/bacopa.png', bannerImg: 'img/bacopa.png',
    lede: 'A revered Ayurvedic herb for memory, focus and mental clarity.',
    self: ['Stimulates memory & concentration', 'Supports mental clarity', 'Natural antioxidant', 'Helps reduce stress', 'Protects brain cells from ageing', 'Supports cognition'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat)*, rapeseed oil, bacopa monnieri extract, emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
  turmeric: {
    name: 'Natural Turmeric / Piperine', sub: 'in 100% Natural Swiss Ghee', accent: '#e08a2e',
    eyebrow: 'Ayurvedic Botanical', price: 'CHF 49', img: 'products/product-box.png',
    lede: 'Curcumin paired with bioperine — far better absorbed, bound in pure Swiss ghee.',
    self: ['Curcumin + piperine synergy', 'Anti-inflammatory properties', 'Antioxidant support', 'Supports joints & recovery', 'Piperine boosts uptake', 'Swiss-ghee bound for absorption'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat)*, rapeseed oil, turmeric extract (curcumin), black pepper extract (piperine), emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
  ashwagandha: {
    name: 'Natural Ashwagandha KSM-66®', sub: 'in 100% Natural Swiss Ghee', accent: '#7aa84a',
    eyebrow: 'Ayurvedic Adaptogen', price: 'CHF 49', img: 'products/product-box.png',
    lede: 'The gold-standard KSM-66® ashwagandha — roots only, in pure Swiss ghee.',
    self: ['KSM-66® · 5% withanolides', 'Roots only — no added leaves', 'Reduces stress & fatigue', 'Supports vitality & recovery', 'Aids focus & calm', 'Premium standardized extract'],
    ghee: GHEE,
    ingredients: 'Ghee (clarified butter, anhydrous milk fat)*, rapeseed oil, ashwagandha KSM-66® root extract (5% withanolides), emulsifier: sunflower lecithin. Capsule: gelatin (fish)*, glycerol, water, sorbitol. *allergens',
  },
};

export const ORDER = ['tribulus', 'shilajit', 'shatavari', 'bacopa', 'turmeric', 'ashwagandha'];
