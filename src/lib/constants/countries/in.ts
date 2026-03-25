/**
 * India Country Configuration
 * Medical guidelines: IAP (Indian Academy of Pediatrics)
 * Vaccine schedule: IAP Recommended Immunization Schedule 2024
 * Drug authority: CDSCO / FSSAI
 *
 * Key differences from US:
 * - BCG vaccine at birth (not in US schedule)
 * - OPV (oral polio) used alongside IPV
 * - Typhoid conjugate vaccine recommended
 * - Paracetamol (not acetaminophen/Tylenol) — 120mg/5ml standard
 * - Metric system: kg, ml, Celsius
 * - Emergency: 112 (unified), 102/108 (ambulance)
 * - IAP is the primary pediatric authority (not AAP)
 * - FSSAI regulates food/formula (not FDA)
 */

import type { CountryConfig } from './types';

export const IN_CONFIG: CountryConfig = {
  code: 'IN',
  name: 'India',
  flag: '\u{1F1EE}\u{1F1F3}',
  defaultLocale: 'en-IN',
  locales: ['en-IN', 'hi-IN'],

  defaults: {
    volumeUnit: 'ml',
    temperatureUnit: 'C',
    dateFormat: 'DD/MM/YYYY',
    weightUnit: 'kg',
    weightToKgDivisor: 1,
    weightPlaceholder: 'Weight in kg (0.5\u201330)',
    weightLimits: { min: 0.5, max: 30 },
  },

  emergency: {
    primaryNumber: '112',
    poisonControl: '1800-599-0019',
    pediatricHotline: '102',
    defaultContacts: [
      { id: 1, name: 'Emergency', phone: '112', role: 'Emergency (Police/Fire/Ambulance)' },
      { id: 2, name: 'Ambulance', phone: '108', role: 'Ambulance (most states)' },
    ],
    bannerTitle: 'Emergency: Call 112',
    bannerSubtitle: 'Ambulance: 108 \u00B7 Poison: 1800-599-0019',
  },

  medical: {
    authority: 'IAP',
    authorityFull: 'Indian Academy of Pediatrics',
    formulaRegulator: 'FSSAI',
    cprOrganization: 'Indian Red Cross Society',
    cprOrganizationFull: 'Indian Red Cross Society or St John Ambulance India',
    normalTempRange: '36.1\u201337.9\u00B0C (97\u2013100.3\u00B0F)',
    sleepRoomTemp: '20-22\u00B0C',
    massageRoomTemp: '24-27\u00B0C',
  },

  // ─── IAP RECOMMENDED IMMUNIZATION SCHEDULE 2024 ───
  vaccines: [
    {
      age: 'Birth',
      v: [
        { n: 'BCG', d: 'Single dose' },
        { n: 'OPV-0', d: 'Birth dose (oral)' },
        { n: 'Hepatitis B', d: '1st dose (within 24 hrs)' },
      ],
    },
    {
      age: '6 Weeks',
      v: [
        { n: 'DTwP / DTaP', d: '1st dose' },
        { n: 'IPV', d: '1st dose' },
        { n: 'Hepatitis B', d: '2nd dose' },
        { n: 'Hib', d: '1st dose' },
        { n: 'Rotavirus', d: '1st dose' },
        { n: 'PCV', d: '1st dose' },
      ],
    },
    {
      age: '10 Weeks',
      v: [
        { n: 'DTwP / DTaP', d: '2nd dose' },
        { n: 'IPV', d: '2nd dose' },
        { n: 'Hib', d: '2nd dose' },
        { n: 'Rotavirus', d: '2nd dose' },
        { n: 'PCV', d: '2nd dose' },
      ],
    },
    {
      age: '14 Weeks',
      v: [
        { n: 'DTwP / DTaP', d: '3rd dose' },
        { n: 'IPV', d: '3rd dose' },
        { n: 'Hib', d: '3rd dose' },
        { n: 'Rotavirus', d: '3rd dose' },
        { n: 'PCV', d: '3rd dose' },
      ],
    },
    {
      age: '6 Months',
      v: [
        { n: 'OPV-1', d: '1st booster (oral)' },
        { n: 'Hepatitis B', d: '3rd dose' },
        { n: 'Influenza', d: '1st dose (6+ months)' },
      ],
    },
    {
      age: '7 Months',
      v: [
        { n: 'Influenza', d: '2nd dose (4 weeks after 1st)' },
      ],
    },
    {
      age: '9 Months',
      v: [
        { n: 'MMR', d: '1st dose' },
        { n: 'OPV-2', d: '2nd booster (oral)' },
        { n: 'Typhoid Conjugate (TCV)', d: 'Single dose' },
      ],
    },
    {
      age: '12 Months',
      v: [
        { n: 'Hepatitis A', d: '1st dose' },
        { n: 'PCV', d: 'Booster' },
      ],
    },
    {
      age: '15 Months',
      v: [
        { n: 'MMR', d: '2nd dose' },
        { n: 'Varicella', d: '1st dose' },
      ],
    },
    {
      age: '16\u201318 Months',
      v: [
        { n: 'DTwP / DTaP', d: '1st booster' },
        { n: 'IPV', d: '1st booster' },
        { n: 'Hib', d: 'Booster' },
        { n: 'Hepatitis A', d: '2nd dose' },
      ],
    },
  ],
  vaccineSource: 'IAP (Indian Academy of Pediatrics) Advisory Committee on Vaccines & Immunization Practices 2024',

  medicines: {
    antipyretic: {
      name: 'Paracetamol (Calpol / Crocin)',
      genericName: 'Paracetamol',
      concentrationMg: 120,
      concentrationLabel: '120 mg / 5 mL',
      doseLowPerKg: 10,
      doseHighPerKg: 15,
      frequency: 'Every 4-6 hours as needed',
      maxDoses: 'Max 4-5 doses in 24 hrs',
      emoji: '\u{1F7E3}',
      minAgeMonths: null,
    },
    antiInflammatory: {
      name: 'Ibuprofen (Brufen / Ibugesic)',
      genericName: 'Ibuprofen',
      concentrationMg: 100,
      concentrationLabel: '100 mg / 5 mL',
      doseLowPerKg: 5,
      doseHighPerKg: 10,
      frequency: 'Every 6-8 hours as needed',
      maxDoses: 'Max 3-4 doses in 24 hrs',
      emoji: '\u{1F7E0}',
      minAgeMonths: 6,
      ageRestriction: '6+ months only!',
    },
    tips: [
      'Never alternate Paracetamol & Ibuprofen without doctor\u2019s advice',
      'Use the measuring syringe or dropper that comes with the medicine',
      'Do not use adult formulations for infants',
      'Fever reducers treat discomfort, not the underlying infection',
      'Consult your paediatrician before giving any medicine to babies under 3 months',
      'Store medicines away from heat and direct sunlight',
    ],
  },

  feverGuide: [
    {
      age: '0\u20133 months',
      temp: '38\u00B0C+ (100.4\u00B0F+)',
      action: 'CONSULT DOCTOR IMMEDIATELY or visit hospital',
      urgent: true,
      detail: 'Any fever in a newborn is a medical emergency. Do not give medication without doctor\u2019s instruction. Visit nearest hospital.',
    },
    {
      age: '3\u20136 months',
      temp: '38.3\u00B0C+ (101\u00B0F+)',
      action: 'Consult paediatrician',
      urgent: true,
      detail: 'Call your paediatrician if fever lasts more than 1 day or baby seems very uncomfortable or lethargic.',
    },
    {
      age: '6\u201324 months',
      temp: '38.9\u00B0C+ (102\u00B0F+)',
      action: 'Consult doctor if lasts 1+ day',
      urgent: false,
      detail: 'Give Paracetamol (Calpol/Crocin) or Ibuprofen (Brufen, 6+ mo) as per weight-based dosing. Push fluids. Consult paediatrician if fever persists 24+ hrs.',
    },
    {
      age: 'Any age',
      temp: '40\u00B0C+ (104\u00B0F+)',
      action: 'SEEK IMMEDIATE MEDICAL CARE',
      urgent: true,
      detail: 'Very high fever needs urgent medical evaluation regardless of age. Visit nearest hospital or emergency.',
    },
    {
      age: 'Any age',
      temp: 'Febrile seizure',
      action: 'CALL 112 / Rush to hospital',
      urgent: true,
      detail: 'Lay child on side, don\u2019t put anything in mouth, time the seizure. Call 112 or rush to nearest hospital if it lasts more than 5 minutes.',
    },
  ],

  cprSteps: [
    {
      step: 1,
      title: 'Check Responsiveness',
      detail: 'Tap the baby\u2019s foot and call out loudly. If no response, call 112 or shout for help. Put phone on speaker.',
    },
    {
      step: 2,
      title: 'Open Airway',
      detail: 'Place baby on firm flat surface. Tilt head back slightly with one hand on forehead, lift chin with other hand.',
    },
    {
      step: 3,
      title: 'Check Breathing',
      detail: 'Look, listen, and feel for breathing for no more than 10 seconds. If not breathing normally, begin CPR.',
    },
    {
      step: 4,
      title: 'Give 30 Compressions',
      detail: 'Place 2 fingers on breastbone just below nipple line. Push down 4 cm (1.5 inches), fast \u2014 100-120/min. Let chest fully recoil.',
    },
    {
      step: 5,
      title: 'Give 2 Rescue Breaths',
      detail: 'Cover baby\u2019s mouth AND nose with your mouth. Give 2 gentle puffs (1 second each). Watch for chest rise.',
    },
    {
      step: 6,
      title: 'Continue 30:2 Cycle',
      detail: 'Repeat 30 compressions + 2 breaths. Continue until baby responds, ambulance arrives, or you\u2019re too exhausted.',
    },
  ],
  cprDisclaimer: 'This guide is for reference only. Please take a certified infant CPR class through the Indian Red Cross Society or St John Ambulance India.',

  chokingSteps: [
    {
      step: 1,
      title: 'Assess the Situation',
      detail: 'If baby can cough or cry, let them try to clear it. If baby cannot breathe, cry, or cough \u2014 act NOW.',
    },
    {
      step: 2,
      title: '5 Back Blows',
      detail: 'Hold baby face-down on your forearm, head lower than body. Support head with your hand. Give 5 firm back blows between shoulder blades with heel of your hand.',
    },
    {
      step: 3,
      title: '5 Chest Thrusts',
      detail: 'Turn baby face-up on your forearm. Place 2 fingers on breastbone just below nipple line. Give 5 quick chest thrusts (push down 4 cm).',
    },
    {
      step: 4,
      title: 'Check Mouth',
      detail: 'Look in baby\u2019s mouth. If you SEE the object, sweep it out with a finger. Do NOT do blind finger sweeps.',
    },
    {
      step: 5,
      title: 'Repeat Until Clear',
      detail: 'Alternate 5 back blows and 5 chest thrusts until object comes out, baby can breathe, or baby becomes unconscious.',
    },
    {
      step: 6,
      title: 'If Unconscious',
      detail: 'Call 112 if not done already. Begin infant CPR (30 compressions, 2 breaths). Check mouth before each set of breaths. Rush to nearest hospital.',
    },
  ],

  safety: [
    {
      t: 'Safe Sleep',
      icon: 'shield',
      c: '#FF6B8A',
      items: [
        'Baby should sleep on back on a firm surface',
        'No pillows, loose blankets, or soft toys in sleeping area',
        'Room-share for at least 6 months (same room, separate bed)',
        'Keep baby\u2019s sleeping area away from windows and curtains',
        'Room temperature 20-22\u00B0C is ideal',
        'Light cotton clothing \u2014 avoid over-bundling',
      ],
    },
    {
      t: 'Home Safety',
      icon: 'home',
      c: '#6C63FF',
      items: [
        'Cover electrical outlets and sockets',
        'Secure heavy furniture to walls (almirah, TV units)',
        'Gates at stairs and balcony doors',
        'Lock kitchen cabinets with chemicals/sharp objects',
        'Keep small objects (coins, buttons, beads) out of reach',
        'Window grilles and balcony safety nets',
        'Keep hot vessels (chai, dal) away from edges',
        'Cover overhead water tank openings',
      ],
    },
    {
      t: 'Car & Travel Safety',
      icon: 'shield',
      c: '#00C9A7',
      items: [
        'Use a rear-facing car seat for infants',
        'Baby in back seat, never on front passenger seat',
        'Never leave baby alone in a parked car',
        'Use certified child car seats (BIS/ECE marked)',
        'On two-wheelers: never carry infants \u2014 use a car/auto instead',
        'In auto-rickshaws: hold baby securely, sit on inside',
      ],
    },
    {
      t: 'Choking Prevention',
      icon: 'alert-triangle',
      c: '#FFB347',
      items: [
        'Cut grapes, cherry tomatoes into quarters',
        'No whole nuts, popcorn, or hard candies',
        'No raw carrots or whole sausages',
        'Small, pea-sized pieces for finger foods',
        'Supervise all meals \u2014 no eating while playing/running',
        'Learn infant CPR and choking response!',
      ],
    },
    {
      t: 'Water Safety',
      icon: 'droplets',
      c: '#42A5F5',
      items: [
        'Never leave baby unattended near water \u2014 even a bucket',
        'A few centimeters of water can drown a child',
        'Empty buckets and tubs after use',
        'Cover wells, bore-wells, and overhead tanks',
        'Swimming pools/ponds: constant adult supervision',
        'Keep bathroom doors closed',
      ],
    },
    {
      t: 'Sun, Heat & Monsoon',
      icon: 'sun',
      c: '#FFB347',
      items: [
        'Under 6 months: keep in shade, avoid direct sun',
        '6+ months: use baby-safe sunscreen SPF 30+',
        'Light cotton clothes, wide-brimmed hat',
        'Avoid going out 11 AM \u2013 3 PM in summer',
        'Keep baby well-hydrated in hot weather',
        'During monsoon: protect from mosquitoes (nets, repellents)',
        'Use mosquito nets at night in endemic areas',
      ],
    },
  ],

  visits: [
    { a: 'Within 24-48 hrs', f: 'Newborn exam, weight, BCG/OPV/Hep B vaccines' },
    { a: '6 Weeks', f: 'Growth, feeding, first set of vaccinations' },
    { a: '10 Weeks', f: 'Vaccinations, growth check' },
    { a: '14 Weeks', f: 'Vaccinations, development review' },
    { a: '6 Months', f: 'OPV booster, Hep B, growth, starting solids discussion' },
    { a: '9 Months', f: 'MMR-1, Typhoid, developmental screening' },
    { a: '12 Months', f: 'Hep A, PCV booster, growth, nutrition assessment' },
    { a: '15 Months', f: 'MMR-2, Varicella, developmental milestones' },
    { a: '16-18 Months', f: 'DTwP/DTaP booster, IPV booster, Hib booster' },
    { a: '24 Months', f: 'Developmental screening, dental check, nutrition review' },
  ],

  formulaNotes: [
    {
      r: 'Start with standard cow\u2019s milk formula',
      d: 'IAP recommends cow\u2019s milk-based, iron-fortified formula as the default when breastfeeding is not possible.',
    },
    {
      r: 'Check for FSSAI certification',
      d: 'All infant formula in India must carry the FSSAI mark. Buy from authorized retailers. Check manufacturing and expiry dates.',
    },
    {
      r: 'Boil and cool water for preparation',
      d: 'Always use boiled and cooled water to prepare formula. Tap water quality varies \u2014 boiling ensures safety.',
    },
    {
      r: 'Iron-fortified formula preferred',
      d: 'IAP recommends iron-fortified formula to prevent iron deficiency anaemia, which is common in Indian infants.',
    },
  ],

  remedyBrands: {
    gasDrops: 'Colicaid / Bonnisan',
    diaperCream: 'Himalaya / Sebamed / Mamaearth',
    feverReducer: 'Calpol/Crocin',
  },
};
