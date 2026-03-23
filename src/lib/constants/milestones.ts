/**
 * Developmental milestones by age
 * Tracks motor, cognitive, social, and language development
 */

export interface Milestone {
  l: string;      // label
  r: string;      // range
  e: string;      // emoji
  motor: string[];
  cog: string[];
  soc: string[];
  lang: string[];
  tips: string;
  red: string[];
}

export interface MilestonesData {
  [key: number]: Milestone;
}

export interface Tooth {
  name: string;
  age: string;
  pos: string;
}

export const MILESTONES: MilestonesData = {
  0: {
    l: "Newborn",
    r: "0–1 Mo",
    e: "👶",
    motor: [
      "Reflexive arm/leg movements",
      "Brief head lift on tummy",
      "Grasp reflex",
      "Moro reflex (startle)",
    ],
    cog: [
      "Prefers faces",
      "Recognizes parent voice",
      "Follows objects briefly",
    ],
    soc: ["Calms when held", "Looks at face during feeding"],
    lang: ["Cries to communicate", "Small throaty sounds"],
    tips: "Skin-to-skin contact is crucial. Talk and sing often.",
    red: [
      "Not responding to loud sounds",
      "Not looking at faces or bright objects",
      "Body seems very stiff or very floppy",
    ],
  },
  1: {
    l: "1 Month",
    r: "1–2 Mo",
    e: "🌙",
    motor: [
      "Lifts head briefly on tummy",
      "Smoother arm movements",
      "Opens/closes hands",
    ],
    cog: [
      "Focuses 8-12 inches",
      "Follows moving objects",
      "Prefers high contrast",
    ],
    soc: ["First social smile", "Calms when rocked"],
    lang: ["Cooing begins", "Vowel sounds (ah, oh)"],
    tips: "Daily tummy time 3-5 min. Always supervise.",
    red: [
      "No smile by 2 months",
      "Doesn't bring hands to mouth",
      "Can't hold head up when pushing up on tummy",
    ],
  },
  2: {
    l: "2 Months",
    r: "2–3 Mo",
    e: "😊",
    motor: [
      "Steadier head on tummy",
      "Pushes up on arms",
      "Smoother movements",
    ],
    cog: ["Follows wider arc", "Recognizes people at distance"],
    soc: ["True social smile!", "Self-calms (sucking hand)"],
    lang: ["Coos and gurgles", "Turns toward sounds"],
    tips: "First vaccinations now. Social smiles are wonderful!",
    red: [
      "Doesn't respond to loud sounds",
      "Doesn't watch things as they move",
      "Doesn't smile at people",
    ],
  },
  4: {
    l: "4 Months",
    r: "4–5 Mo",
    e: "🎯",
    motor: [
      "Head steady without support",
      "May roll tummy to back",
      "Reaches for toys",
    ],
    cog: ["Follows smoothly", "Explores by mouthing"],
    soc: ["Smiles spontaneously", "Copies expressions"],
    lang: ["Babbles with expression", "Copies sounds"],
    tips: "Exclusive breastfeeding/formula until 6 months recommended.",
    red: [
      "Doesn't watch things as they move",
      "Doesn't bring things to mouth",
      "Can't hold head steady",
      "Doesn't coo or make sounds",
    ],
  },
  6: {
    l: "6 Months",
    r: "6–7 Mo",
    e: "🥄",
    motor: ["Rolls both ways", "Begins sitting alone", "Passes hand to hand"],
    cog: ["Curious explorer", "Cause and effect"],
    soc: ["Knows strangers vs familiar", "Enjoys mirror"],
    lang: ["Responds to name", "Babbles: ba-ba, da-da"],
    tips: "Start solid foods! One new food every 3-5 days.",
    red: [
      "Doesn't reach for things",
      "Shows no affection for caregivers",
      "Doesn't respond to sounds",
      "Doesn't make vowel sounds",
      "Doesn't roll",
    ],
  },
  9: {
    l: "9 Months",
    r: "9–10 Mo",
    e: "👋",
    motor: [
      "Stands holding furniture",
      "Pulls to stand",
      "Crawls",
      "Pincer grasp",
    ],
    cog: ["Object permanence!", "Plays peek-a-boo"],
    soc: ["Separation anxiety", "Has favorite toys"],
    lang: ["Understands 'no'", "Points at things"],
    tips: "Baby-proof everything! Developmental screening recommended.",
    red: [
      "Doesn't bear weight on legs with support",
      "Doesn't sit with help",
      "Doesn't babble (mama, baba)",
      "Doesn't play games like peek-a-boo",
      "Doesn't respond to own name",
    ],
  },
  12: {
    l: "12 Months",
    r: "12–13 Mo",
    e: "🎂",
    motor: [
      "Cruises furniture",
      "May take steps",
      "Pokes with finger",
    ],
    cog: ["Uses cup, brush", "Finds hidden objects"],
    soc: ["Plays pat-a-cake", "Cries when parent leaves"],
    lang: ["1-3 words", "Waves, shakes head 'no'"],
    tips: "Switch to whole milk. Happy 1st birthday!",
    red: [
      "Doesn't point to things",
      "Doesn't learn gestures (waving)",
      "Doesn't stand when supported",
      "Doesn't search for hidden objects",
      "Loses skills they once had",
    ],
  },
  15: {
    l: "15 Months",
    r: "15–16 Mo",
    e: "🚶",
    motor: ["Walks alone", "Stacks 2 blocks", "Scribbles"],
    cog: ["Follows 1-step commands", "Explores near parent"],
    soc: ["Shows affection", "Points to show you things"],
    lang: ["3-5+ words", "Says 'no'"],
    tips: "Let them self-feed — messy but important!",
    red: [
      "Doesn't point to show you things",
      "Doesn't walk",
      "Doesn't have at least 3 words",
      "Doesn't notice when caregiver leaves/returns",
    ],
  },
  18: {
    l: "18 Months",
    r: "18–19 Mo",
    e: "🗣️",
    motor: ["Walks well", "Eats with spoon", "Stacks 3-4 blocks"],
    cog: ["Knows what things are for", "Scribbles alone"],
    soc: ["Simple pretend play", "Checks for parent"],
    lang: ["10-25 words", "Understands more than says"],
    tips: "AAP autism screening at 18 months. Read daily!",
    red: [
      "Doesn't point to show others",
      "Doesn't walk steadily",
      "Doesn't know what familiar things are for",
      "Doesn't copy others",
      "Doesn't gain new words",
      "Doesn't have at least 6 words",
    ],
  },
  24: {
    l: "24 Months",
    r: "23–24 Mo",
    e: "🎉",
    motor: [
      "Runs well",
      "Kicks ball",
      "Walks stairs",
      "Stacks 6+ blocks",
    ],
    cog: ["Sorts shapes/colors", "Follow 2-step instructions", "Make-believe play"],
    soc: ["Parallel play", "Increasing independence"],
    lang: [
      "50+ words",
      "2-4 word sentences",
      "Names body parts",
    ],
    tips: "2nd birthday! Autism screening again.",
    red: [
      "Doesn't use 2-word phrases",
      "Doesn't know what to do with common things",
      "Doesn't copy actions/words",
      "Doesn't walk steadily",
      "Loses skills previously had",
    ],
  },
};

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
