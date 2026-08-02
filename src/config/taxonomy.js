// Clasificarea stirilor. Cheile (id) sunt folosite in JSON-ul returnat de model
// si in HTML; `label` e ce vede cititorul. Ordinea de aici = ordinea in newsletter.

// Paleta e aliniata cu identitatea site-ului personal (navy + crem, ton editorial) —
// culori calde/desaturate in loc de albastru-violet saturat de tip SaaS.
export const TIPURI = [
  { id: 'lansare',      label: 'Lansare / Produs nou', emoji: '🚀', culoare: '#1B3A5C',
    descriere: 'Modele noi, feature-uri, API-uri, versiuni majore' },
  { id: 'cercetare',    label: 'Cercetare',            emoji: '🔬', culoare: '#5B4B8A',
    descriere: 'Papers, benchmark-uri, rezultate tehnice noi' },
  { id: 'business',     label: 'Business & Finantare', emoji: '💰', culoare: '#3D6B4E',
    descriere: 'Runde de investitii, achizitii, evaluari, angajari-cheie' },
  { id: 'reglementare', label: 'Reglementare & Politici', emoji: '⚖️', culoare: '#A85D3D',
    descriere: 'Legislatie, procese, guvernanta, standarde' },
  { id: 'adoptie',      label: 'Adoptie & Studii de caz', emoji: '📊', culoare: '#A6873A',
    descriere: 'Cum folosesc companiile AI-ul, cifre reale, rezultate masurate' },
  { id: 'opinie',       label: 'Opinie & Analiza',     emoji: '💭', culoare: '#6B6458',
    descriere: 'Eseuri, predictii, dezbateri, comentarii' },
  { id: 'incident',     label: 'Incidente & Riscuri',  emoji: '⚠️', culoare: '#B23B3B',
    descriere: 'Esecuri, brese de securitate, probleme de siguranta, abuzuri' },
];

export const DOMENII = [
  { id: 'business-strategie', label: 'Business & Strategie', emoji: '📈' },
  { id: 'munca-hr',           label: 'Munca & HR',           emoji: '👥' },
  { id: 'enterprise',         label: 'Enterprise & Productivitate', emoji: '🏢' },
  { id: 'creative-media',     label: 'Creative & Media',     emoji: '🎨' },
  { id: 'sanatate-stiinte',   label: 'Sanatate & Stiinte',   emoji: '🧬' },
  { id: 'educatie',           label: 'Educatie & Training',  emoji: '🎓' },
  { id: 'infrastructura',     label: 'Infrastructura & Hardware', emoji: '🔌' },
  { id: 'siguranta-etica',    label: 'Siguranta & Etica',    emoji: '🛡️' },
  { id: 'romania-ue',         label: 'Romania & UE',         emoji: '🇪🇺' },
];

export const TIP_IDS = TIPURI.map((t) => t.id);
export const DOMENIU_IDS = DOMENII.map((d) => d.id);

export const tipById = (id) => TIPURI.find((t) => t.id === id) ?? TIPURI.at(-2);
export const domeniuById = (id) => DOMENII.find((d) => d.id === id) ?? DOMENII[0];

// Cate stiri intra in newsletter.
export const LIMITE = {
  minStiri: 12,
  maxStiri: 20,
  // Cate articole brute trimitem modelului spre evaluare (dupa deduplicare).
  maxCandidati: 140,
};
