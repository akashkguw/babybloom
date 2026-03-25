/**
 * All guide data for the app
 * Includes sleep, feeding, safety, visits, teeth, screen time, activities, and medical guides
 */

// ═══ SLEEP GUIDE ═══
export interface SleepGuide {
  age: string;
  total: string;
  pat: string;
  naps: string;
  tips: string[];
}

export const SLEEP: SleepGuide[] = [
  {
    age: "0–3 Mo",
    total: "14–17 hrs",
    pat: "Short bursts 2-4 hrs",
    naps: "Multiple",
    tips: [
      "Back to sleep ALWAYS (ABC rule)",
      "Firm flat mattress only",
      "Room-share 6+ months",
      "No blankets/pillows/toys",
      "Room temp 20-22°C (68-72°F)",
      "Swaddling OK until rolling",
      "White noise helps",
    ],
  },
  {
    age: "4–6 Mo",
    total: "12–16 hrs",
    pat: "Longer night stretches 4-6 hrs",
    naps: "3/day",
    tips: [
      "Start bedtime routine",
      "Put down drowsy but awake",
      "Stop swaddle when rolling",
      "Dark room + white noise",
    ],
  },
  {
    age: "6–9 Mo",
    total: "12–15 hrs",
    pat: "May sleep 6-8 hr stretches",
    naps: "2-3/day",
    tips: [
      "Consistent routine",
      "Sleep regression at 8-9 mo",
      "No screens 1 hr before bed",
    ],
  },
  {
    age: "9–12 Mo",
    total: "12–15 hrs",
    pat: "10-12 hrs night",
    naps: "2/day",
    tips: [
      "Most sleep through night",
      "Predictable schedule",
      "Lovey OK after 12 mo",
    ],
  },
  {
    age: "12–18 Mo",
    total: "11–14 hrs",
    pat: "11-12 hrs night",
    naps: "Transition to 1",
    tips: ["1-nap transition 14-18 mo", "Keep bedtime consistent"],
  },
  {
    age: "18–24 Mo",
    total: "11–14 hrs",
    pat: "11-12 hrs night",
    naps: "1 nap 1-3 hrs",
    tips: [
      "Toddler bed only if climbing out",
      "Night terrors may start",
      "Routine: bath→teeth→books→bed",
    ],
  },
];

// ═══ FEEDING GUIDE ═══
export interface FeedingGuide {
  age: string;
  t: string;
  e: string;
  foods: string[];
  amt: string;
  tips: string[];
}

export const FEEDING: FeedingGuide[] = [
  {
    age: "0–4 Mo",
    t: "Exclusive Milk",
    e: "🍼",
    foods: ["Breast milk or formula ONLY"],
    amt: "8-12x/day breast or 2-4 oz/3-4 hrs formula",
    tips: [
      "Vitamin D 400 IU/day (breastfed)",
      "No honey until 12 mo",
      "No cow's milk until 12 mo",
    ],
  },
  {
    age: "4–6 Mo",
    t: "Ready for Solids?",
    e: "👀",
    foods: ["Continue milk as primary", "Watch readiness signs"],
    amt: "Milk still primary",
    tips: ["Paediatricians recommend solids around 6 mo", "Never cereal in bottle"],
  },
  {
    age: "6–8 Mo",
    t: "Starting Solids!",
    e: "🥄",
    foods: [
      "Iron-fortified cereal",
      "Pureed veggies and fruits",
      "Pureed meats/beans",
      "Allergens: peanut butter, egg, dairy",
    ],
    amt: "1-4 tbsp/meal, 2-3x/day + milk",
    tips: [
      "One new food every 3-5 days",
      "Early allergens reduce allergy risk",
      "No honey, whole nuts, grapes",
    ],
  },
  {
    age: "8–10 Mo",
    t: "Finger Foods",
    e: "🫐",
    foods: ["Mashed foods with lumps", "Soft finger foods", "Scrambled eggs", "Yogurt"],
    amt: "3 meals + 1-2 snacks + milk",
    tips: ["Practice cup drinking", "Pea-sized pieces", "Always supervise"],
  },
  {
    age: "10–12 Mo",
    t: "Table Foods",
    e: "🍝",
    foods: ["Most family foods (small, soft)", "All food groups"],
    amt: "3 meals + 2 snacks + milk",
    tips: ["No added salt or sugar", "Eat together as family"],
  },
  {
    age: "12–24 Mo",
    t: "Toddler Nutrition",
    e: "🥗",
    foods: ["Whole milk at 12 mo", "All food groups daily", "Healthy fats"],
    amt: "3 meals + 2 snacks, 16-24 oz milk",
    tips: [
      "Picky eating is NORMAL",
      "Juice max 4 oz/day",
      "Wean bottle by 15 mo",
    ],
  },
];

// ═══ SAFETY GUIDE ═══
export interface SafetySection {
  t: string;
  icon: string;
  c: string;
  items: string[];
}

export const SAFETY: SafetySection[] = [
  {
    t: "Safe Sleep (ABCs)",
    icon: "shield",
    c: "#FF6B8A",
    items: [
      "Alone, Back, Crib",
      "No bumpers/blankets/toys",
      "Room-share 6+ months",
      "Pacifier reduces SIDS",
      "Room temp 20-22°C (68-72°F)",
    ],
  },
  {
    t: "Baby-Proofing",
    icon: "home",
    c: "#6C63FF",
    items: [
      "Cover outlets",
      "Anchor furniture",
      "Gates at stairs",
      "Lock cabinets",
      "Small objects off floor",
      "Blind cords up high",
    ],
  },
  {
    t: "Car Safety",
    icon: "shield",
    c: "#00C9A7",
    items: [
      "Rear-facing until age 2+",
      "Back seat always",
      "Never alone in car",
      "Snug harness",
      "Register for recalls",
    ],
  },
  {
    t: "Choking Prevention",
    icon: "alert-triangle",
    c: "#FFB347",
    items: [
      "Quarter grapes/tomatoes",
      "No whole nuts/popcorn",
      "No raw carrots/hot dogs",
      "Pea-sized pieces",
      "Supervise all meals",
      "Learn infant CPR!",
    ],
  },
  {
    t: "Water Safety",
    icon: "droplets",
    c: "#42A5F5",
    items: [
      "Never unattended near water",
      "1 inch can drown",
      "Empty buckets",
      "Fence pools",
      "Designate water watcher",
    ],
  },
  {
    t: "Sun & Heat",
    icon: "sun",
    c: "#FFB347",
    items: [
      "Under 6 mo: shade only",
      "6+ mo: SPF 30+",
      "Long sleeves, hat",
      "Avoid 10AM-4PM",
      "Never in parked car",
    ],
  },
];

// ═══ VISITS GUIDE ═══
export interface Visit {
  a: string;
  f: string;
}

export const VISITS: Visit[] = [
  { a: "3-5 Days", f: "Weight, jaundice, feeding" },
  { a: "1 Month", f: "Growth, feeding, development" },
  { a: "2 Months", f: "Vaccinations, tummy time" },
  { a: "4 Months", f: "Vaccinations, solids readiness" },
  { a: "6 Months", f: "Vaccinations, starting solids" },
  { a: "9 Months", f: "Developmental screening" },
  { a: "12 Months", f: "Vaccinations, whole milk, lead" },
  { a: "15 Months", f: "Vaccinations, language" },
  { a: "18 Months", f: "Autism screening (M-CHAT)" },
  { a: "24 Months", f: "Autism screening, dental" },
];

// ═══ TEETH ORDER ═══
export interface Tooth {
  name: string;
  age: string;
  pos: string;
}

export const TEETH_ORDER: Tooth[] = [
  { name: "Lower Central Incisors", age: "6-10 mo", pos: "bottom-center" },
  { name: "Upper Central Incisors", age: "8-12 mo", pos: "top-center" },
  { name: "Upper Lateral Incisors", age: "9-13 mo", pos: "top-side" },
  { name: "Lower Lateral Incisors", age: "10-16 mo", pos: "bottom-side" },
  { name: "First Molars (upper)", age: "13-19 mo", pos: "top-molar" },
  { name: "First Molars (lower)", age: "14-18 mo", pos: "bottom-molar" },
  { name: "Canines (upper)", age: "16-22 mo", pos: "top-canine" },
  { name: "Canines (lower)", age: "17-23 mo", pos: "bottom-canine" },
  { name: "Second Molars (lower)", age: "23-31 mo", pos: "bottom-back" },
  { name: "Second Molars (upper)", age: "25-33 mo", pos: "top-back" },
];

// ═══ SCREEN TIME GUIDE ═══
export interface ScreenTimeGuide {
  age: string;
  rule: string;
  detail: string;
}

export const SCREEN_TIME: ScreenTimeGuide[] = [
  {
    age: "0–18 Months",
    rule: "No screens",
    detail:
      "Except video chatting with family. Babies learn from live interaction, not screens.",
  },
  {
    age: "18–24 Months",
    rule: "Limited, with parent",
    detail:
      "Only high-quality programming (like Sesame Street). Watch TOGETHER and talk about what you see.",
  },
  {
    age: "2+ Years",
    rule: "Max 1 hour/day",
    detail:
      "High-quality programs only. No screens during meals or 1 hour before bed. No screens in bedroom.",
  },
];

// ═══ ACTIVITIES ═══
export interface Activities {
  [key: number]: string[];
}

export const ACTIVITIES: Activities = {
  0: [
    "Black and white contrast cards",
    "Gentle music and singing",
    "Tummy time on your chest",
    "Talk narrate everything you do",
  ],
  1: [
    "Colorful mobile above crib",
    "Gentle rattles",
    "Sing nursery rhymes",
    "Tummy time 5 min",
  ],
  2: [
    "Reach for dangling toys",
    "Read simple board books",
    "Make funny faces",
    "Play mat with toys",
  ],
  4: [
    "Peek-a-boo",
    "Textured toys to explore",
    "Play airplane",
    "Read books with big pictures",
    "Sing with hand motions",
  ],
  6: [
    "Stacking cups",
    "Cause-effect toys (push button)",
    "Read lift-the-flap books",
    "Clapping games",
    "Bang pots and spoons",
    "Play in front of mirror",
  ],
  9: [
    "Ball rolling back and forth",
    "Shape sorters",
    "Finger foods practice",
    "Pat-a-cake, Itsy Bitsy Spider",
    "Simple puzzles",
    "Hide and seek with toy",
  ],
  12: [
    "Push/pull toys",
    "Crayons and paper",
    "Stacking blocks",
    "Simple pretend play (phone)",
    "Dancing to music",
    "Water play (supervised)",
  ],
  18: [
    "Play-dough",
    "Simple puzzles 3-4 pieces",
    "Pretend cooking/cleaning",
    "Playground climbing",
    "Read and name objects",
    "Drawing and scribbling",
  ],
  24: [
    "Dress-up and pretend play",
    "Simple board games",
    "Tricycle or ride-on toys",
    "Painting",
    "Play dates with peers",
    "Imaginative storytelling",
  ],
};

// ═══ PPD QUESTIONS ═══
export const PPD_QUESTIONS: string[] = [
  "I have been able to laugh and see the funny side of things",
  "I have looked forward with enjoyment to things",
  "I have blamed myself unnecessarily when things went wrong",
  "I have been anxious or worried for no good reason",
  "I have felt scared or panicky for no very good reason",
  "Things have been getting on top of me",
  "I have been so unhappy that I have had difficulty sleeping",
  "I have felt sad or miserable",
  "I have been so unhappy that I have been crying",
  "The thought of harming myself has occurred to me",
];

// ═══ FEVER GUIDE ═══
export interface FeverGuide {
  age: string;
  temp: string;
  action: string;
  urgent: boolean;
  detail: string;
}

export const FEVER_GUIDE: FeverGuide[] = [
  {
    age: "0–3 months",
    temp: "100.4°F+ (38°C+)",
    action: "CALL DOCTOR IMMEDIATELY or go to ER",
    urgent: true,
    detail:
      "Any fever in a newborn is a medical emergency. Do not give medication without doctor's instruction.",
  },
  {
    age: "3–6 months",
    temp: "101°F+ (38.3°C+)",
    action: "Call doctor",
    urgent: true,
    detail: "Call if fever lasts more than 1 day or baby seems very uncomfortable.",
  },
  {
    age: "6–24 months",
    temp: "102°F+ (38.9°C+)",
    action: "Call doctor if lasts 1+ day",
    urgent: false,
    detail:
      "Give infant acetaminophen (Tylenol) or ibuprofen (Advil, 6+ mo). Push fluids. Call if fever persists 24+ hrs.",
  },
  {
    age: "Any age",
    temp: "104°F+ (40°C+)",
    action: "SEEK IMMEDIATE CARE",
    urgent: true,
    detail: "Very high fever needs medical evaluation regardless of age.",
  },
  {
    age: "Any age",
    temp: "Febrile seizure",
    action: "CALL 911",
    urgent: true,
    detail:
      "Lay child on side, don't put anything in mouth, time the seizure. Call 911 if it lasts more than 5 minutes.",
  },
];

// ═══ CPR STEPS ═══
export interface CPRStep {
  step: number;
  title: string;
  detail: string;
}

export const CPR_STEPS: CPRStep[] = [
  {
    step: 1,
    title: "Check Responsiveness",
    detail:
      "Tap the baby's foot and shout. If no response, call 911 (or have someone call). Put phone on speaker.",
  },
  {
    step: 2,
    title: "Open Airway",
    detail:
      "Place baby on firm flat surface. Tilt head back slightly with one hand on forehead, lift chin with other hand.",
  },
  {
    step: 3,
    title: "Check Breathing",
    detail:
      "Look, listen, and feel for breathing for no more than 10 seconds. If not breathing normally, begin CPR.",
  },
  {
    step: 4,
    title: "Give 30 Compressions",
    detail:
      "Place 2 fingers on breastbone just below nipple line. Push down 1.5 inches (4 cm), fast — 100-120/min. Let chest fully recoil.",
  },
  {
    step: 5,
    title: "Give 2 Rescue Breaths",
    detail:
      "Cover baby's mouth AND nose with your mouth. Give 2 gentle puffs (1 second each). Watch for chest rise.",
  },
  {
    step: 6,
    title: "Continue 30:2 Cycle",
    detail:
      "Repeat 30 compressions + 2 breaths. Continue until baby responds, EMS arrives, or you're too exhausted.",
  },
];

// ═══ CHOKING STEPS ═══
export interface ChokingStep {
  step: number;
  title: string;
  detail: string;
}

export const CHOKING_STEPS: ChokingStep[] = [
  {
    step: 1,
    title: "Assess the Situation",
    detail:
      "If baby can cough or cry, let them try to clear it. If baby cannot breathe, cry, or cough — act NOW.",
  },
  {
    step: 2,
    title: "5 Back Blows",
    detail:
      "Hold baby face-down on your forearm, head lower than body. Support head with your hand. Give 5 firm back blows between shoulder blades with heel of your hand.",
  },
  {
    step: 3,
    title: "5 Chest Thrusts",
    detail:
      "Turn baby face-up on your forearm. Place 2 fingers on breastbone just below nipple line. Give 5 quick chest thrusts (push down 1.5 inches).",
  },
  {
    step: 4,
    title: "Check Mouth",
    detail:
      "Look in baby's mouth. If you SEE the object, sweep it out with a finger. Do NOT do blind finger sweeps.",
  },
  {
    step: 5,
    title: "Repeat Until Clear",
    detail:
      "Alternate 5 back blows and 5 chest thrusts until object comes out, baby can breathe, or baby becomes unconscious.",
  },
  {
    step: 6,
    title: "If Unconscious",
    detail:
      "Call 911 if not done already. Begin infant CPR (30 compressions, 2 breaths). Check mouth before each set of breaths.",
  },
];

// ═══ GROWTH PERCENTILES ═══
export interface GrowthPoint {
  m: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface Growth {
  w: GrowthPoint[];
  h: GrowthPoint[];
}

export const GROWTH: Growth = {
  w: [
    { m: 0, p5: 5.5, p50: 7.5, p95: 9.5 },
    { m: 3, p5: 9.5, p50: 12.5, p95: 16 },
    { m: 6, p5: 13, p50: 16.5, p95: 21 },
    { m: 9, p5: 15.5, p50: 19.5, p95: 24.5 },
    { m: 12, p5: 17, p50: 21, p95: 27 },
    { m: 18, p5: 19, p50: 24, p95: 30.5 },
    { m: 24, p5: 21.5, p50: 27, p95: 34 },
  ],
  h: [
    { m: 0, p5: 18, p50: 19.5, p95: 21 },
    { m: 3, p5: 22, p50: 24, p95: 25.5 },
    { m: 6, p5: 24.5, p50: 26.5, p95: 28 },
    { m: 9, p5: 26.5, p50: 28.5, p95: 30 },
    { m: 12, p5: 28, p50: 30, p95: 32 },
    { m: 18, p5: 30, p50: 32.5, p95: 34.5 },
    { m: 24, p5: 32, p50: 34.5, p95: 37 },
  ],
};

// ═══ SOLIDS GUIDE ═══
export interface Food {
  f: string;
  n: string;
}

export interface SolidsAgeGuide {
  [key: number]: Food[];
}

export interface SolidsDiet {
  label: string;
  foods: SolidsAgeGuide;
}

export interface Allergens {
  title: string;
  items: string[];
  tip: string;
}

export interface SolidsGuide {
  veg: SolidsDiet;
  nonveg: SolidsDiet;
  vegan: SolidsDiet;
  allergens: Allergens;
}

export const SOLIDS_GUIDE: SolidsGuide = {
  veg: {
    label: "Vegetarian",
    foods: {
      6: [
        {
          f: "Iron-fortified rice cereal",
          n: "Start with 1-2 tbsp",
        },
        {
          f: "Pureed sweet potato, carrot, peas",
          n: "One new food every 3-5 days",
        },
        {
          f: "Pureed banana, avocado, apple",
          n: "Mash soft",
        },
        {
          f: "Pureed lentils, dal",
          n: "Great iron source",
        },
        {
          f: "Yogurt (full fat)",
          n: "Excellent protein",
        },
        {
          f: "Mashed tofu",
          n: "Soft, iron-rich",
        },
      ],
      8: [
        {
          f: "Mashed paneer / cottage cheese",
          n: "Protein + calcium",
        },
        {
          f: "Soft cooked pasta, rice",
          n: "Finger food size",
        },
        {
          f: "Scrambled eggs",
          n: "Whole egg OK now",
        },
        {
          f: "Hummus with soft pita",
          n: "Iron + protein",
        },
        {
          f: "Oatmeal with fruit",
          n: "Iron-fortified",
        },
        {
          f: "Soft cheese cubes",
          n: "Calcium",
        },
      ],
      10: [
        {
          f: "Mixed veggie curry (mild)",
          n: "Family meals adapted",
        },
        {
          f: "Chapati/roti torn small",
          n: "Soft bread",
        },
        {
          f: "Khichdi / rice-lentil",
          n: "Complete protein",
        },
        {
          f: "Idli / dosa pieces",
          n: "Soft, fermented",
        },
        {
          f: "Nut butters (thin spread)",
          n: "Allergen intro",
        },
        {
          f: "All fruits diced small",
          n: "Variety",
        },
      ],
      12: [
        {
          f: "Family foods (mild spice OK)",
          n: "All textures",
        },
        {
          f: "Whole milk, yogurt, cheese",
          n: "16-24 oz milk/day",
        },
        {
          f: "Beans, lentils, eggs daily",
          n: "Protein at each meal",
        },
        {
          f: "All vegetables cooked soft",
          n: "Variety of colors",
        },
        {
          f: "Whole grain bread, cereal",
          n: "Fiber",
        },
        {
          f: "Healthy fats: ghee, olive oil",
          n: "Brain development",
        },
      ],
    },
  },
  nonveg: {
    label: "Non-Vegetarian",
    foods: {
      6: [
        {
          f: "Iron-fortified cereal + pureed veggies",
          n: "Same as veg start",
        },
        {
          f: "Pureed chicken or turkey",
          n: "Excellent iron + zinc",
        },
        {
          f: "Pureed fish (salmon, cod)",
          n: "DHA for brain",
        },
        {
          f: "Pureed lentils + veggies",
          n: "Iron-rich",
        },
        {
          f: "Egg yolk (well cooked)",
          n: "6 mo+ whole egg OK",
        },
        {
          f: "Yogurt",
          n: "Probiotics",
        },
      ],
      8: [
        {
          f: "Flaked fish (salmon, tilapia)",
          n: "Soft, boneless pieces",
        },
        {
          f: "Shredded chicken",
          n: "Small, soft pieces",
        },
        {
          f: "Scrambled eggs",
          n: "Easy protein",
        },
        {
          f: "Soft cooked shrimp (diced)",
          n: "Allergen intro",
        },
        {
          f: "Lamb/mutton pureed or minced",
          n: "Iron + B12",
        },
        {
          f: "Bone broth with rice",
          n: "Nutrients + minerals",
        },
      ],
      10: [
        {
          f: "Fish cakes (soft)",
          n: "Easy finger food",
        },
        {
          f: "Mini meatballs",
          n: "Soft, small pieces",
        },
        {
          f: "Chicken soup with rice",
          n: "Complete meal",
        },
        {
          f: "Fish curry (mild, boneless)",
          n: "Family meal adapted",
        },
        {
          f: "Egg bhurji / omelette strips",
          n: "Quick protein",
        },
        {
          f: "Turkey/chicken strips (soft)",
          n: "Self-feeding",
        },
      ],
      12: [
        {
          f: "Family meals with protein",
          n: "All safe meats",
        },
        {
          f: "Fish 2-3x/week (low mercury)",
          n: "Salmon, sardines, cod",
        },
        {
          f: "Avoid: shark, swordfish, king mackerel",
          n: "High mercury",
        },
        {
          f: "Chicken, lamb, beef all OK",
          n: "Well cooked",
        },
        {
          f: "Shellfish if no allergy",
          n: "Watch for reactions",
        },
        {
          f: "Organ meats occasionally",
          n: "Very nutrient dense",
        },
      ],
    },
  },
  vegan: {
    label: "Vegan",
    foods: {
      6: [
        {
          f: "Iron-fortified cereal",
          n: "Essential first food",
        },
        {
          f: "Pureed tofu",
          n: "Iron + protein",
        },
        {
          f: "Mashed avocado + banana",
          n: "Healthy fats",
        },
        {
          f: "Pureed lentils, chickpeas",
          n: "Iron + protein",
        },
        {
          f: "Sweet potato, butternut squash",
          n: "Beta-carotene",
        },
        {
          f: "Pea puree",
          n: "Protein-rich veg",
        },
      ],
      8: [
        {
          f: "Nut butter (thin on toast)",
          n: "Peanut, almond — allergens",
        },
        {
          f: "Tahini with banana",
          n: "Calcium + iron",
        },
        {
          f: "Soft cooked quinoa",
          n: "Complete protein",
        },
        {
          f: "Edamame (mashed)",
          n: "Protein",
        },
        {
          f: "Fortified oat cereal",
          n: "Iron + B12",
        },
        {
          f: "Tofu strips (soft)",
          n: "Self-feeding",
        },
      ],
      10: [
        {
          f: "Bean patties (soft)",
          n: "Iron + fiber",
        },
        {
          f: "Tempeh (soft cubes)",
          n: "Fermented soy, B12",
        },
        {
          f: "Pasta with lentil sauce",
          n: "Complete meal",
        },
        {
          f: "Seaweed strips",
          n: "Iodine",
        },
        {
          f: "Nutritional yeast on foods",
          n: "B12 source",
        },
        {
          f: "Coconut yogurt + fruit",
          n: "Calcium fortified",
        },
      ],
      12: [
        {
          f: "Fortified plant milk (soy preferred)",
          n: "Closest to whole milk nutrients",
        },
        {
          f: "Tofu, tempeh, legumes daily",
          n: "Protein at every meal",
        },
        {
          f: "B12 supplement REQUIRED",
          n: "No plant sources",
        },
        {
          f: "Iron-rich foods + vitamin C together",
          n: "Absorption boost",
        },
        {
          f: "Chia/flax seeds",
          n: "Omega-3 (ALA)",
        },
        {
          f: "Algae-based DHA supplement",
          n: "Brain development",
        },
      ],
    },
  },
  allergens: {
    title: "Top Allergens — Introduce 6-12 mo",
    items: [
      "Peanut (thin butter)",
      "Egg (well-cooked)",
      "Cow's milk (in food, not drink)",
      "Tree nuts (butters)",
      "Wheat",
      "Soy",
      "Fish",
      "Shellfish",
      "Sesame",
    ],
    tip: "Early introduction (6-12 mo) REDUCES allergy risk. Give 2-3x/week once introduced. Watch for: hives, swelling, vomiting, difficulty breathing within 2 hours.",
  },
};

// ═══ MILK GUIDE ═══
export interface MilkGuide {
  age: string;
  breast: string;
  formula: string;
  total: string;
  notes: string;
}

export const MILK_GUIDE: MilkGuide[] = [
  {
    age: "0-1 Mo",
    breast: "8-12 feeds/day, on demand",
    formula: "2-3 oz per feed, 8-12x/day",
    total: "16-24 oz/day",
    notes: "Cluster feeding is normal. Feed on demand, not by clock.",
  },
  {
    age: "1-2 Mo",
    breast: "8-10 feeds/day",
    formula: "3-4 oz per feed, 7-8x/day",
    total: "20-28 oz/day",
    notes: "Baby finding rhythm. One longer sleep stretch at night.",
  },
  {
    age: "2-4 Mo",
    breast: "7-9 feeds/day",
    formula: "4-5 oz per feed, 6-7x/day",
    total: "24-32 oz/day",
    notes: "Max 32 oz formula/day. Breastfed babies self-regulate.",
  },
  {
    age: "4-6 Mo",
    breast: "6-8 feeds/day",
    formula: "5-6 oz per feed, 5-6x/day",
    total: "24-32 oz/day",
    notes: "Milk is still primary nutrition. Solids are practice.",
  },
  {
    age: "6-9 Mo",
    breast: "5-7 feeds/day + solids",
    formula: "6-8 oz per feed, 4-5x/day",
    total: "24-32 oz/day",
    notes: "Solids 2-3x/day but milk first. Water in open cup OK.",
  },
  {
    age: "9-12 Mo",
    breast: "4-6 feeds/day + solids",
    formula: "6-8 oz per feed, 3-4x/day",
    total: "24-30 oz/day",
    notes: "3 meals + 2 snacks + milk. Solids becoming more important.",
  },
  {
    age: "12-18 Mo",
    breast: "3-4 feeds/day",
    formula: "Transition to whole milk",
    total: "16-24 oz whole milk/day",
    notes: "Wean bottle by 15 mo. Use open cup or straw cup.",
  },
  {
    age: "18-24 Mo",
    breast: "2-3 feeds/day (if continuing)",
    formula: "N/A",
    total: "16-20 oz whole milk/day",
    notes: "Milk is supplement to balanced diet. Max 24 oz to not displace food.",
  },
];

// ═══ NAP GUIDE ═══
export interface NapGuide {
  age: string;
  naps: string;
  wake: string;
  total: string;
  tips: string[];
}

export const NAP_GUIDE: NapGuide[] = [
  {
    age: "0-6 Weeks",
    naps: "4-8 naps",
    wake: "45-60 min",
    total: "15-18 hrs total sleep",
    tips: [
      "Naps are irregular — that's normal",
      "Nap anywhere safe: crib, bassinet, arms",
      "Don't try to force a schedule yet",
      "Watch for sleepy cues: yawning, fussing, eye rubbing",
    ],
  },
  {
    age: "2-3 Months",
    naps: "4-5 naps",
    wake: "60-90 min",
    total: "14-17 hrs total",
    tips: [
      "Start noticing patterns",
      "Last nap before 5pm ideal",
      "Drowsy but awake practice",
      "Dark room + white noise helps",
    ],
  },
  {
    age: "4-5 Months",
    naps: "3-4 naps",
    wake: "1.5-2.5 hrs",
    total: "12-16 hrs total",
    tips: [
      "Sleep regression common at 4 mo",
      "Try consistent nap routine (mini bedtime)",
      "Naps in crib when possible",
      "Morning nap usually consolidates first",
    ],
  },
  {
    age: "6-8 Months",
    naps: "2-3 naps",
    wake: "2-3 hrs",
    total: "12-15 hrs total",
    tips: [
      "Transition to 2 naps around 7-8 mo",
      "Morning nap ~9-10am, afternoon ~1-2pm",
      "Drop the late afternoon catnap",
      "Consistent timing helps",
    ],
  },
  {
    age: "9-12 Months",
    naps: "2 naps",
    wake: "2.5-3.5 hrs",
    total: "12-15 hrs total",
    tips: [
      "Solid 2-nap schedule",
      "Nap 1: ~9:30am (1-1.5 hrs)",
      "Nap 2: ~1:30pm (1-2 hrs)",
      "Sleep regression at 8-10 mo common",
    ],
  },
  {
    age: "12-15 Months",
    naps: "1-2 naps",
    wake: "3-4 hrs",
    total: "11-14 hrs total",
    tips: [
      "Most still need 2 naps",
      "Don't rush to 1 nap",
      "Signs ready for 1 nap: fighting second nap consistently",
      "Transition takes 2-4 weeks",
    ],
  },
  {
    age: "15-18 Months",
    naps: "1 nap",
    wake: "4-5.5 hrs",
    total: "11-14 hrs total",
    tips: [
      "One midday nap (12-2pm)",
      "Nap 1.5-3 hours",
      "Move bedtime earlier during transition",
      "Quiet time if nap is skipped",
    ],
  },
  {
    age: "18-24 Months",
    naps: "1 nap",
    wake: "5-6 hrs",
    total: "11-14 hrs total",
    tips: [
      "Nap around 12:30-1pm",
      "1.5-2.5 hours ideal",
      "Bedtime 7-8pm",
      "Resist dropping the nap too early",
    ],
  },
];

// ═══ REMEDIES ═══
export interface Remedy {
  r: string;
  d: string;
}

export interface RemedySection {
  title: string;
  icon: string;
  items: Remedy[];
}

export const REMEDIES: { [key: string]: RemedySection } = {
  gas: {
    title: "Gas & Colic Relief",
    icon: "💨",
    items: [
      {
        r: "Bicycle legs",
        d: "Gently move baby's legs in cycling motion for 1-2 min. Helps move trapped gas.",
      },
      {
        r: "Tummy massage",
        d: "Clockwise circles on belly with warm hands. Use coconut oil. Do between feeds.",
      },
      {
        r: "Burp thoroughly",
        d: "Burp after every 2-3 oz (bottle) or when switching breasts. Try upright, over shoulder, or sitting positions.",
      },
      {
        r: "Warm compress",
        d: "Warm (not hot) washcloth on tummy. Test on your wrist first.",
      },
      {
        r: "Tummy time",
        d: "Pressure on belly during supervised tummy time can help release gas.",
      },
      {
        r: "Gas drops (simethicone)",
        d: "Simethicone drops (gas drops) — safe, ask your doctor for dosing.",
      },
      {
        r: "Check bottle flow",
        d: "Slow-flow nipple prevents swallowing air. Tilt bottle to fill nipple completely.",
      },
      {
        r: "Dietary check (breastfeeding)",
        d: "Common triggers: dairy, caffeine, broccoli, onions, beans. Eliminate one at a time for 2 weeks.",
      },
    ],
  },
  reflux: {
    title: "Acid Reflux / Spit-Up",
    icon: "🤢",
    items: [
      {
        r: "Keep upright 20-30 min after feeds",
        d: "Don't lay flat right after eating. Hold upright or use bouncer at slight incline.",
      },
      {
        r: "Smaller, more frequent feeds",
        d: "Overfull stomach worsens reflux. Feed less, more often.",
      },
      {
        r: "Burp frequently during feeds",
        d: "Every 1-2 oz for bottle, each time baby pauses for breast.",
      },
      {
        r: "Slightly elevate crib head",
        d: "Place a towel under the mattress (not under baby). Only slight angle.",
      },
      {
        r: "Avoid tight diapers/clothes",
        d: "Pressure on tummy worsens reflux.",
      },
      {
        r: "Pace bottle feeding",
        d: "Hold bottle horizontal, let baby control flow. Pause every few sips.",
      },
      {
        r: "Check for milk allergy",
        d: "If excessive spit-up + fussiness, discuss CMPA with doctor. May need hydrolyzed formula.",
      },
      {
        r: "When to call doctor",
        d: "Projectile vomiting, green/bloody vomit, refusing feeds, poor weight gain, arching back in pain.",
      },
    ],
  },
  lowMilk: {
    title: "Low Milk Supply",
    icon: "🍼",
    items: [
      {
        r: "Feed/pump more often",
        d: "Supply = demand. Nurse or pump 8-12x/day. Add a nighttime session.",
      },
      {
        r: "Power pumping",
        d: "Pump 20 min, rest 10, pump 10, rest 10, pump 10. Once daily for 3-5 days.",
      },
      {
        r: "Skin-to-skin contact",
        d: "Increases oxytocin and prolactin. Hold baby against bare chest.",
      },
      {
        r: "Check latch",
        d: "Poor latch = inefficient removal = less production. See a lactation consultant.",
      },
      {
        r: "Stay hydrated",
        d: "Drink to thirst + extra 16 oz. Keep water bottle at nursing station.",
      },
      {
        r: "Eat enough calories",
        d: "Need 400-500 extra cal/day while nursing. Don't diet aggressively.",
      },
      {
        r: "Oatmeal & lactation foods",
        d: "Oats, brewer's yeast, flaxseed, fenugreek may help (evidence varies).",
      },
      {
        r: "How to measure: is baby getting enough?",
        d: "6+ wet diapers/day, steady weight gain, content between feeds, 3+ dirty diapers/day (first month).",
      },
    ],
  },
  general: {
    title: "Everyday Questions",
    icon: "❓",
    items: [
      {
        r: "Hiccups",
        d: "Normal! Feed a little, change position, or wait. Will stop on their own. Don't startle baby.",
      },
      {
        r: "Cradle cap",
        d: "Apply coconut/olive oil, wait 15 min, gently brush with soft brush. Shampoo. Repeat daily.",
      },
      {
        r: "Baby acne",
        d: "Normal at 2-4 weeks. Don't pick or scrub. Wash with water. Clears by 3-4 months.",
      },
      {
        r: "Blocked tear duct",
        d: "Gently massage inner corner of eye downward. Warm compress. Usually resolves by 12 months.",
      },
      {
        r: "Diaper rash",
        d: "Barrier cream (zinc oxide based) every change. Air dry when possible. Oatmeal bath. Call doctor if yeasty (bright red with dots).",
      },
      {
        r: "Congestion",
        d: "Saline drops + bulb suction. Run humidifier. Elevate mattress slightly. Steam from shower.",
      },
      {
        r: "Constipation (solids)",
        d: "P foods: prunes, pears, peaches, plums. Tummy massage. Bicycle legs. Call doctor if no poop 5+ days.",
      },
      {
        r: "Teething pain",
        d: "Cold washcloth to chew. Refrigerated teething ring. Gum massage. Fever reducer if needed (6mo+), consult doctor.",
      },
    ],
  },
};

// ═══ MASSAGE GUIDE ═══
export interface MassageItem {
  r?: string;
  d?: string;
}

export interface MassageSection {
  title: string;
  icon: string;
  items: (string | MassageItem)[];
}

export const MASSAGE_GUIDE: { [key: string]: MassageSection } = {
  benefits: {
    title: "Why Baby Massage?",
    icon: "💜",
    items: [
      "Promotes bonding and attachment between parent and baby",
      "Improves sleep quality and helps baby fall asleep faster",
      "Relieves gas, colic, and constipation through tummy strokes",
      "Supports healthy weight gain in premature babies (research-backed)",
      "Reduces cortisol (stress hormone) and increases oxytocin",
      "Stimulates nervous system development and body awareness",
      "Improves circulation and strengthens immune system",
      "Helps with teething pain when gentle face/jaw massage is included",
    ],
  },
  bestTime: {
    title: "When to Massage",
    icon: "🕐",
    items: [
      {
        r: "After bath time",
        d: "Baby is already relaxed, warm skin absorbs oil well. Most popular time.",
      },
      {
        r: "Before bedtime",
        d: "Calming massage helps signal sleep time. Great for bedtime routine.",
      },
      {
        r: "Between feeds",
        d: "Wait 45 min after feeding to avoid spit-up. Baby shouldn't be hungry either.",
      },
      {
        r: "When baby is calm & alert",
        d: "Look for quiet alert state — eyes open, relaxed body, not fussy.",
      },
      {
        r: "Avoid when",
        d: "Baby is crying, hungry, just fed, has fever, has skin infection, or after vaccinations (24 hrs).",
      },
    ],
  },
  oils: {
    title: "Recommended Oils",
    icon: "🫒",
    items: [
      {
        r: "Coconut oil (top choice)",
        d: "Natural, antimicrobial, gentle on sensitive skin. Cold-pressed virgin is best.",
      },
      {
        r: "Sesame oil (traditional)",
        d: "Used in Ayurvedic tradition. Warming, great for winter. Rich in vitamin E.",
      },
      {
        r: "Olive oil",
        d: "Rich in antioxidants and vitamin E. Use extra virgin. Good for dry skin.",
      },
      {
        r: "Almond oil",
        d: "Light, easily absorbed. Rich in vitamin E. Avoid if nut allergy in family.",
      },
      {
        r: "Sunflower oil",
        d: "Rich in linoleic acid, supports skin barrier. Pediatrician-recommended.",
      },
      {
        r: "Avoid",
        d: "Mineral oil, mustard oil (can irritate), essential oils (too strong for babies), fragranced oils.",
      },
    ],
  },
  techniques: {
    title: "Massage Techniques by Body Part",
    icon: "🤲",
    items: [
      {
        r: "Legs & Feet (start here)",
        d: "Hold ankle, stroke from thigh to foot with gentle pressure. Squeeze gently down the leg. Thumb circles on sole of foot. Gently squeeze each toe.",
      },
      {
        r: "Tummy (clockwise only)",
        d: "Clockwise circles around belly button — follows digestion. 'I Love You' strokes: I down left side, L across and down, U shape. Great for gas relief.",
      },
      {
        r: "Chest",
        d: "Hands flat on chest, stroke outward from center to sides like opening a book. Heart shape from center, up, around, and back to center.",
      },
      {
        r: "Arms & Hands",
        d: "Same as legs — stroke from shoulder to wrist. Roll arm gently between hands. Open palm and do thumb circles. Gently squeeze each finger.",
      },
      {
        r: "Back",
        d: "Place baby on tummy. Long strokes from shoulders to bottom. Small circles along spine (never ON spine). Side-to-side rocking strokes.",
      },
      {
        r: "Face & Head",
        d: "Thumbs from center of forehead outward. Small circles on temples. Stroke from nose bridge outward across cheeks. Gentle jaw circles for teething.",
      },
    ],
  },
  ageGuide: {
    title: "By Age",
    icon: "📅",
    items: [
      {
        r: "Newborn (0-6 weeks)",
        d: "Very gentle, light touch only. Keep sessions to 5 min. Focus on legs and feet. Use minimal oil. Stop if baby fusses.",
      },
      {
        r: "2-4 months",
        d: "Can increase to 10-15 min. Add tummy and chest. Baby starts to enjoy it. Good time to establish routine.",
      },
      {
        r: "4-6 months",
        d: "15-20 min sessions. Include all body parts. Baby may try to roll — that's OK! Can be more playful.",
      },
      {
        r: "6-12 months",
        d: "Baby may not stay still — make it fun! Sing songs during massage. Let them play with oil. Focus on legs after crawling.",
      },
      {
        r: "12-24 months",
        d: "Toddlers may prefer shorter targeted massage — feet after walking, back before bed. Make it part of wind-down routine.",
      },
    ],
  },
  tips: {
    title: "Pro Tips",
    icon: "💡",
    items: [
      {
        r: "Warm the oil",
        d: "Rub oil between your palms for 30 seconds before applying. Never microwave oil.",
      },
      {
        r: "Talk and sing",
        d: "Narrate what you're doing: 'Now I'm massaging your little feet.' Eye contact and voice soothe baby.",
      },
      {
        r: "Follow baby's cues",
        d: "If baby turns away, arches back, or cries — stop that area or end the session. It should be enjoyable.",
      },
      {
        r: "Be consistent",
        d: "Daily massage at the same time builds routine. Even 5 min daily is better than 20 min occasionally.",
      },
      {
        r: "Skin patch test",
        d: "First time with a new oil, apply a small amount to baby's inner arm. Wait 24 hours for any reaction.",
      },
      {
        r: "Pressure guide",
        d: "Use the pressure you'd use to comfortably close your eyelid. Firm enough to not tickle, gentle enough to not press.",
      },
      {
        r: "Keep baby warm",
        d: "Room should be warm (24-27°C / 75-80°F). Undress only the part you're massaging, or use a warm room with full undress.",
      },
    ],
  },
};

// ═══ BOTTLE GUIDE ═══
export interface BottleGuideSection {
  title: string;
  items: Remedy[];
}

export const BOTTLE_GUIDE: { [key: string]: BottleGuideSection } = {
  types: {
    title: "Bottle Types",
    items: [
      {
        r: "Anti-Colic Bottles",
        d: "Have built-in vent or straw system to reduce air intake. Best for gassy or colicky babies. Look for venting at the bottom or in the nipple.",
      },
      {
        r: "Standard/Classic Bottles",
        d: "Simple cylindrical shape, easy to clean, widely available. Good starting option. Usually the most affordable.",
      },
      {
        r: "Wide-Neck Bottles",
        d: "Wider opening makes filling and cleaning easier. Nipple shape mimics breast — good for combo breast/bottle feeding.",
      },
      {
        r: "Angled/Curved Bottles",
        d: "Tilted shape keeps milk in the nipple to reduce air swallowing. Slightly harder to clean due to shape.",
      },
      {
        r: "Disposable Liner Bottles",
        d: "Use pre-sterilized disposable liners. Very convenient for travel. Liner collapses as baby drinks, reducing air.",
      },
      {
        r: "Glass Bottles",
        d: "Chemical-free (no BPA concerns), easy to clean, longer lasting. Heavier and can break — use silicone sleeves for grip and protection.",
      },
      {
        r: "Silicone Bottles",
        d: "Soft, squeezable, lightweight, and unbreakable. No chemicals. Gentle feel similar to skin. Good for on-the-go.",
      },
      {
        r: "Stainless Steel Bottles",
        d: "Very durable, no chemicals, keeps milk temperature stable longer. More expensive. Cannot see milk level.",
      },
    ],
  },
  nipples: {
    title: "Nipple Flow Rates",
    items: [
      {
        r: "Preemie/Slow Flow (Size 0)",
        d: "Slowest flow for premature babies or newborns who need extra time. Very small hole.",
      },
      {
        r: "Slow Flow (Size 1) — 0-3 months",
        d: "Best for newborns. Baby should take 15-20 min per feed. If milk drips out at corners of mouth, try this.",
      },
      {
        r: "Medium Flow (Size 2) — 3-6 months",
        d: "Slightly faster. Move up if baby seems frustrated, takes >30 min, or collapses nipple from sucking hard.",
      },
      {
        r: "Fast Flow (Size 3) — 6+ months",
        d: "For older babies who eat efficiently. If baby coughs or gulps, go back to medium.",
      },
      {
        r: "Variable Flow",
        d: "Lets baby control flow by how they latch. Good for breastfed babies who switch between breast and bottle.",
      },
    ],
  },
  tips: {
    title: "Bottle Feeding Tips",
    items: [
      {
        r: "Pace the feeding",
        d: "Hold bottle nearly horizontal. Let baby pull milk in. Pause every few minutes. Mimics breastfeeding rhythm and prevents overfeeding.",
      },
      {
        r: "Hold baby semi-upright",
        d: "45-degree angle minimum. Never prop the bottle. Reduces ear infections and choking risk.",
      },
      {
        r: "Watch for hunger cues, not the clock",
        d: "Rooting, hand sucking, fussiness. Don't force baby to finish the bottle — they know when they're full.",
      },
      {
        r: "Burp frequently",
        d: "Every 2-3 oz for formula, every few minutes for pumped milk. Try upright, over shoulder, or seated positions.",
      },
      {
        r: "Replace bottles every 4-6 months",
        d: "Check for cracks, discoloration, or stickiness. Replace nipples every 2-3 months or if torn/stretched.",
      },
      {
        r: "Sterilize for first use",
        d: "Boil new bottles for 5 min or use steam sterilizer. After that, hot soapy water and bottle brush is sufficient for healthy full-term babies.",
      },
    ],
  },
};

// ═══ FORMULA GUIDE ═══
export const FORMULA_GUIDE: { [key: string]: BottleGuideSection } = {
  types: {
    title: "Formula Types",
    items: [
      {
        r: "Cow's Milk-Based (standard)",
        d: "Most common type. Suitable for most babies. Iron-fortified formula is recommended from birth if not breastfeeding.",
      },
      {
        r: "Partially Hydrolyzed (gentle)",
        d: "Proteins partially broken down for easier digestion. Good for mild fussiness or gas. Not for true milk allergy.",
      },
      {
        r: "Extensively Hydrolyzed",
        d: "Proteins fully broken down. For babies with confirmed cow's milk protein allergy (CMPA). Prescription may be needed.",
      },
      {
        r: "Soy-Based",
        d: "Plant protein alternative. For lactose intolerance or families preferring no animal products. Not recommended for premature babies.",
      },
      {
        r: "Amino Acid-Based (elemental)",
        d: "For severe allergies when hydrolyzed formula is not tolerated. Most broken-down form. Usually prescription only.",
      },
      {
        r: "Organic Formula",
        d: "Made with organic ingredients. Meets same nutritional standards as non-organic. Personal preference.",
      },
      {
        r: "European-Style Formula",
        d: "Stricter EU regulations on ingredients. Often includes prebiotics/probiotics. May be harder to source.",
      },
    ],
  },
  choosing: {
    title: "How to Choose",
    items: [
      {
        r: "Start with standard cow's milk formula",
        d: "Recommended as the default for non-breastfed babies. It works for 80%+ of infants.",
      },
      {
        r: "Signs formula isn't working",
        d: "Persistent vomiting, bloody stool, severe rash, constant crying during/after feeds, poor weight gain. Talk to pediatrician.",
      },
      {
        r: "Don't switch too often",
        d: "Give each formula 1-2 weeks before deciding. Babies need time to adjust. Frequent switching can cause more digestive upset.",
      },
      {
        r: "Generic/store brands are fine",
        d: "All formula sold must meet strict regulatory standards. Generic or store brands have the same nutrients at lower cost.",
      },
      {
        r: "Check for iron fortification",
        d: "All infant formula should be iron-fortified. Low-iron formula is not recommended by paediatric authorities.",
      },
      {
        r: "Ask your pediatrician",
        d: "If baby was premature, has allergies in the family, or has special medical needs, get personalized guidance.",
      },
    ],
  },
  prep: {
    title: "Safe Preparation",
    items: [
      {
        r: "Always follow package instructions",
        d: "Too much or too little water is dangerous. Use the scoop provided. Level off — don't pack it.",
      },
      {
        r: "Water safety",
        d: "Use clean, safe water. Boil and cool water for infant formula preparation. If water quality is uncertain, use bottled water or a reliable filter.",
      },
      {
        r: "Temperature",
        d: "Body temperature (37°C / 98.6°F) or room temperature is fine. Test on your wrist. Never microwave formula.",
      },
      {
        r: "Use within 1 hour",
        d: "Prepared formula at room temp must be used within 1 hour. In fridge, use within 24 hours.",
      },
      {
        r: "Discard after feeding",
        d: "Once baby has drunk from a bottle, bacteria from saliva can grow. Throw away any remaining formula within 1 hour.",
      },
      {
        r: "Storage",
        d: "Unopened powder: room temp, use by expiration date. Opened powder: use within 1 month. Ready-to-feed: refrigerate after opening, use within 48 hours.",
      },
    ],
  },
};

// ═══ MOM NUTRITION ═══
export interface MomNutritionSection {
  title: string;
  items: string[];
}

export interface MomNutritionByMonth {
  period: string;
  focus: string;
  tips: string[];
}

export interface MomNutrition {
  general: MomNutritionSection;
  eat: MomNutritionSection;
  avoid: MomNutritionSection;
  byMonth: MomNutritionByMonth[];
}

export const MOM_NUTRITION: MomNutrition = {
  general: {
    title: "Daily Nutrition Goals",
    items: [
      "2,300-2,500 calories/day while breastfeeding",
      "Protein: 65g/day (lean meat, eggs, beans, tofu, dairy)",
      "Calcium: 1,000mg/day (dairy, fortified foods, leafy greens)",
      "Iron: 9-10mg/day (red meat, lentils, spinach, fortified cereals)",
      "DHA/Omega-3: 200-300mg/day (fatty fish 2-3x/week, or supplement)",
      "Vitamin D: 600 IU/day (supplement recommended)",
      "Water: 128+ oz/day (drink at every nursing session)",
      "Continue prenatal vitamin while breastfeeding",
    ],
  },
  eat: {
    title: "Best Foods to Eat",
    items: [
      "Salmon, sardines (omega-3, protein, vitamin D)",
      "Eggs (protein, choline, B12)",
      "Oats, oatmeal (may boost milk supply, iron, fiber)",
      "Leafy greens: spinach, kale (iron, calcium, folate)",
      "Lean meats: chicken, turkey, lean beef (iron, B12, zinc)",
      "Legumes: lentils, chickpeas, beans (iron, protein, fiber)",
      "Nuts & seeds: almonds, flax, chia (healthy fats, calcium)",
      "Sweet potatoes (vitamin A, energy)",
      "Berries (antioxidants, vitamin C)",
      "Whole grains (sustained energy, fiber)",
    ],
  },
  avoid: {
    title: "Foods to Limit or Avoid",
    items: [
      "High-mercury fish: shark, swordfish, king mackerel, tilefish",
      "Caffeine: max 200-300mg/day (2-3 cups coffee)",
      "Alcohol: avoid or wait 2+ hours per drink before nursing",
      "Excessive dairy (if baby shows sensitivity: eczema, fussiness, bloody stool)",
      "Spicy foods may change milk taste (baby may fuss, usually harmless)",
      "Peppermint & sage in large amounts (may reduce supply)",
      "Processed/junk food (empty calories, less nutrition)",
    ],
  },
  byMonth: [
    {
      period: "Weeks 1-6 (Recovery)",
      focus: "Healing & establishing supply",
      tips: [
        "Eat warm, nourishing foods (soups, stews)",
        "Don't restrict calories — you need 500 extra/day",
        "Iron-rich foods (you lost blood during delivery)",
        "Hydrate: drink water every time you nurse",
        "Collagen-rich bone broth for recovery",
      ],
    },
    {
      period: "Months 2-3",
      focus: "Supply stabilization",
      tips: [
        "Include galactagogues: oats, brewer's yeast, fenugreek",
        "Healthy snacks ready: trail mix, hard-boiled eggs, fruit",
        "Omega-3 focus: salmon, walnuts, flax seeds",
        "Don't skip meals — set reminders if needed",
      ],
    },
    {
      period: "Months 4-6",
      focus: "Pre-solids preparation",
      tips: [
        "Diverse diet = diverse breastmilk flavors",
        "Baby tastes what you eat via milk",
        "Introduce variety of spices in your food",
        "Stay hydrated as baby feeds more",
        "Iron stores may deplete — check with doctor",
      ],
    },
    {
      period: "Months 6-12",
      focus: "Balanced with baby's solids",
      tips: [
        "Continue eating well even as baby eats more",
        "Calcium important: dairy or fortified alternatives",
        "If pumping at work: pack protein-rich lunch",
        "May gradually reduce to maintenance calories",
        "Vitamin D supplement year-round",
      ],
    },
    {
      period: "Months 12-24 (if continuing)",
      focus: "Sustained nutrition",
      tips: [
        "Can slowly reduce extra calories if weaning",
        "Keep taking multivitamin",
        "Calcium and vitamin D remain important",
        "Replenish iron stores",
        "Self-care: eat for YOUR health now too",
      ],
    },
  ],
};

// ═══ TUMMY TIME GUIDE ═══
export const TUMMY_TIME_GUIDE: { [key: string]: MassageSection } = {
  benefits: {
    title: "Why Tummy Time Matters",
    icon: "🧒",
    items: [
      "Strengthens neck, shoulder, and core muscles needed for rolling and crawling",
      "Prevents flat spots on the back of the head (positional plagiocephaly)",
      "Builds the arm and hand strength needed for future milestones",
      "Improves visual development — a new perspective from the floor",
      "Supports motor development and coordination",
      "Paediatricians recommend tummy time from the very first day home",
    ],
  },
  ageGuide: {
    title: "How Much by Age",
    icon: "📅",
    items: [
      {
        r: "Newborn (0–1 month)",
        d: "Start with 2–3 short sessions per day, 1–2 minutes each. Do it when baby is awake, alert, and recently fed.",
      },
      {
        r: "1–3 months",
        d: "Work up to 10–15 minutes total per day, spread across multiple sessions.",
      },
      {
        r: "3–4 months",
        d: "Aim for 20–30 minutes total per day. Baby should be lifting head 45–90°.",
      },
      {
        r: "4–6 months",
        d: "30+ minutes spread throughout the day. Baby may start pushing up on arms.",
      },
      {
        r: "6+ months",
        d: "Continue until baby is rolling both ways and spending time crawling.",
      },
    ],
  },
  positions: {
    title: "Tummy Time Positions",
    icon: "🤸",
    items: [
      {
        r: "Classic floor tummy time",
        d: "Place baby on a firm, flat surface (play mat or blanket on the floor). Stay close and make eye contact.",
      },
      {
        r: "On your chest",
        d: "Lie back at a slight recline and place baby on your chest face-down. Great for newborns who resist the floor.",
      },
      {
        r: "Tummy-to-lap",
        d: "Lay baby across your lap face-down with head just past your knee. Rub their back gently.",
      },
      {
        r: "Supported with a rolled towel",
        d: "Place a small rolled towel under baby's chest and shoulders to give a little boost. Helps reluctant tummy-timers.",
      },
    ],
  },
  tips: {
    title: "Tips for Success",
    icon: "💡",
    items: [
      {
        r: "Make it fun",
        d: "Get down on the floor, make faces, use a mirror — babies are motivated by faces and reflections.",
      },
      {
        r: "Best timing",
        d: "Do tummy time when baby is awake and alert, 30–60 minutes after a feeding to avoid spit-up.",
      },
      {
        r: "Stay close",
        d: "Always supervise. Tummy time is for awake time only — never for sleep.",
      },
      {
        r: "Use toys",
        d: "Place colorful toys or a high-contrast book just out of reach to encourage lifting and reaching.",
      },
      {
        r: "Short and often",
        d: "Multiple short sessions add up faster than trying one long session. Stop if baby becomes very distressed.",
      },
    ],
  },
  safety: {
    title: "Safety Rules",
    icon: "🛡️",
    items: [
      "ALWAYS supervise — never leave baby unattended during tummy time",
      "Tummy time is for awake, alert babies only — not for sleep",
      "Stop immediately if baby seems in pain, has breathing difficulty, or turns blue",
      "If baby has reflux, wait longer after feeds (60+ minutes) and try inclined positions first",
      "Consult your pediatrician if baby strongly resists tummy time or seems to have neck tightness (torticollis)",
    ],
  },
};

