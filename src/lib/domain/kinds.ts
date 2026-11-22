/**
 * Every record in the app is an item with a `kind`. This file is the single source
 * of truth for what each kind is called, which states it moves through, which of
 * those count as done, and which demand action. Screens, pills, boards and the
 * cash-required calculation all read from here.
 */

export const KINDS = [
  "task", "income", "saving", "bill", "onceoff", "maintenance", "project",
  "projectexp", "medical", "investment", "experience", "prayer", "unbelief",
  "sowing", "goal", "lifegoal", "decision",
] as const;

export type Kind = (typeof KINDS)[number];

export const SLOTS = [
  "This week",
  "Next week",
  "Monthly drive",
  "To decide together",
] as const;
export type Slot = (typeof SLOTS)[number];

export const SECTIONS = {
  general: "General",
  goals: "Goals & strategy",
  experiences: "Experiences",
  kingdom: "Kingdom",
  income: "Income",
  home: "Expenses & home",
  projects: "Projects",
  medical: "Medical",
  investments: "Investing & deals",
} as const;
export type Section = keyof typeof SECTIONS;

export const PEOPLE = {
  dad: "Dad",
  mom: "Mom",
  c1: "Child 1",
  c2: "Child 2",
  c3: "Child 3",
  both: "Both",
  family: "Family",
  external: "External person",
} as const;
export type PersonKey = keyof typeof PEOPLE;

export const MAINTENANCE_CATEGORIES = [
  "Roof and waterproofing", "Plumbing", "Geysers", "Electrical",
  "Solar / inverter / batteries", "Security / alarm / fence",
  "Gates and garage doors", "Pool", "Garden and irrigation", "Pest control",
  "Windows and doors", "Appliances", "Painting", "Damp / mould", "Paving",
  "Boundary walls", "Fire / household safety",
] as const;

/**
 * The budget's own sections and line items, from John & Moniek — Budget (Monthly +
 * Annual) FY2026. A cost added here is already a line the budget knows about.
 * "Other" is deliberate: the budget is not the whole of life, and an item it has
 * never seen must still land somewhere rather than be forced into the nearest
 * wrong box.
 */
export const INCOME_CATEGORIES = ["DI — Salary (John)", "DI — Salary (Moniek)",
  "DI — Dividends (medical)", "DI — Trust transfer", "TBH — Dividends",
  "Other income"] as const;
export const INVEST_CATEGORIES = ["TFSA — John", "TFSA — Moniek", "Other investment"] as const;
export const EFUND_CATEGORIES = ["Emergency fund"] as const;
export const NEEDS_CATEGORIES = ["Home mortgage", "Rates, taxes, electricity & water",
  "Food", "Vehicles", "Bank charges", "Medical aid", "Gap cover",
  "Life & buy-sell policy", "Insurance — personal", "Other need"] as const;
export const WANTS_CATEGORIES = ["Clothing", "Home & garden", "Pets & food",
  "Wellness & personal care", "Sport & subscriptions", "Gear repairs", "Gifts",
  "Homeware", "Entertainment", "Printing & stationery", "Travel — national",
  "Travel — international", "Tithing", "Other want"] as const;
export const MEDICAL_CATEGORIES = ["Medical — expenses", "Medical — doctors",
  "Medical — dental & provision", "Other medical"] as const;
export const BUCKETS = ["Investments", "Emergency fund"] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface KindDef {
  label: string;
  hint: string;
  /** Which section a task created from this kind belongs to. */
  section: Section | null;
  /** The state field: most kinds use status; deals and experiences use stage. */
  stateField: "status" | "stage";
  states: readonly string[];
  /** States that mean the item is finished. */
  done: readonly string[];
  /** States that mean someone must act — these show orange. */
  action: readonly string[];
  categories?: readonly string[];
  /**
   * Categories that depend on the item itself — a bill's options follow whether it
   * is a need or a want, and a saving's follow its bucket. Read through catsOf().
   */
  categoriesFor?: (item: { need?: string | null; bucket?: string | null }) => readonly string[];
  defaults: Record<string, string | number | null>;
}

/** The only way to ask what categories an item may choose from. */
export function catsOf(
  kind: Kind,
  item?: { need?: string | null; bucket?: string | null },
): readonly string[] {
  const def = KIND_DEFS[kind];
  if (def.categoriesFor) return def.categoriesFor(item ?? {});
  return def.categories ?? [];
}

/**
 * Steps are the strategy. A goal or an experience carries the agreed way to get
 * there; a task carries up to three. Nothing else has steps.
 */
export const STEPS_FOR: Partial<Record<Kind, number>> = {
  task: 3, lifegoal: 5, experience: 5,
};

export const KIND_DEFS: Record<Kind, KindDef> = {
  task: {
    label: "Task", hint: "Who, what, when, how much", section: null,
    stateField: "status",
    states: ["Needs Action", "Waiting", "Planned", "Done"],
    done: ["Done"], action: ["Needs Action"],
    defaults: { status: "Needs Action", slot: "This week", section: "general" },
  },
  income: {
    label: "Income", hint: "Active or passive money in", section: "income",
    stateField: "status", states: [], done: [], action: [],
    categories: INCOME_CATEGORIES,
    defaults: { confidence: "Expected", stream: "Active", repeat: "Monthly" },
  },
  saving: {
    label: "Saving / investment", hint: "Money you put away each month", section: "income",
    stateField: "status",
    states: ["To pay", "Scheduled", "Paid"], done: ["Paid"], action: ["To pay"],
    categoriesFor: (item) =>
      item.bucket === "Emergency fund" ? EFUND_CATEGORIES : INVEST_CATEGORIES,
    defaults: { status: "To pay", repeat: "Monthly", bucket: "Investments" },
  },
  bill: {
    label: "Budget line", hint: "A recurring need or want", section: "home",
    stateField: "status",
    states: ["To pay", "Scheduled", "Paid"], done: ["Paid"], action: ["To pay"],
    categoriesFor: (item) => (item.need === "Want" ? WANTS_CATEGORIES : NEEDS_CATEGORIES),
    defaults: { status: "To pay", repeat: "Monthly", need: "Need" },
  },
  onceoff: {
    label: "Once-off expense", hint: "Purchase or repair, not a monthly line", section: "home",
    stateField: "status",
    states: ["Considering", "To buy", "Paid"], done: ["Paid"], action: ["To buy"],
    categoriesFor: (item) => (item.need === "Want" ? WANTS_CATEGORIES : NEEDS_CATEGORIES),
    defaults: { status: "To buy", need: "Want" },
  },
  maintenance: {
    label: "Maintenance", hint: "Something in or around the house", section: "home",
    stateField: "status",
    states: ["Fine", "Keep an eye on", "Needs Action", "Booked", "Done"],
    done: ["Done", "Fine"], action: ["Needs Action"],
    categories: MAINTENANCE_CATEGORIES,
    defaults: { status: "Needs Action", need: "Need" },
  },
  project: {
    label: "Project (retired)", hint: "Now a capex goal", section: "projects",
    stateField: "status",
    states: ["Planning", "In progress", "On hold", "Done"],
    done: ["Done"], action: ["In progress"],
    defaults: { status: "Planning" },
  },
  projectexp: {
    label: "Capex cost", hint: "A cost inside a capex goal", section: "goals",
    stateField: "status",
    states: ["Planned", "Quoted", "Approved", "Paid"],
    done: ["Paid"], action: ["Approved"],
    defaults: { status: "Planned" },
  },
  medical: {
    label: "Medical expense", hint: "Doctor, hospital, medicine or claim", section: "medical",
    stateField: "status",
    states: ["To pay", "Paid", "Claim submitted", "Reimbursed"],
    done: ["Reimbursed"], action: ["To pay"],
    categories: MEDICAL_CATEGORIES,
    defaults: { status: "To pay" },
  },
  investment: {
    label: "Investment", hint: "Opportunity or deal", section: "investments",
    stateField: "stage",
    states: ["Idea", "Research", "Due Diligence", "Committed", "Invested", "Passed"],
    done: ["Invested", "Passed"], action: [],
    defaults: { stage: "Idea", type: "Property" },
  },
  experience: {
    label: "Experience", hint: "Holiday, outing or bucket-list idea", section: "experiences",
    stateField: "stage",
    states: ["Dreaming", "Considering", "Planning", "Booked", "Done"],
    done: ["Done"], action: [],
    categories: ["Holiday", "Weekend away", "Restaurant", "Event", "Concert",
      "Family experience", "Couple experience", "Bucket list"],
    defaults: { stage: "Dreaming", who: "both" },
  },
  prayer: {
    label: "Prayer", hint: "Person or situation", section: "kingdom",
    stateField: "status",
    states: ["Praying", "Answered"], done: ["Answered"], action: [],
    defaults: { status: "Praying", who: "both" },
  },
  unbelief: {
    label: "Unbelief", hint: "Where it is hard to believe God right now", section: "kingdom",
    stateField: "status",
    states: ["Named", "Wrestling", "Believing"], done: ["Believing"], action: [],
    categories: ["Provision", "Health", "Family", "Business", "Calling",
      "Protection", "The future", "Other"],
    defaults: { status: "Named", who: "both" },
  },
  sowing: {
    label: "Sowing", hint: "Giving to a person or organisation", section: "kingdom",
    stateField: "status",
    states: ["Considering", "Committed", "Given"], done: ["Given"], action: ["Committed"],
    defaults: { status: "Considering", who: "both" },
  },
  /**
   * Retired. The migration turns these into goals; the definition stays so that a
   * row the migration somehow missed still renders rather than crashing a screen.
   */
  goal: {
    label: "Strategy (retired)", hint: "Now a goal", section: "goals",
    stateField: "status", states: [], done: [], action: [],
    defaults: {},
  },
  lifegoal: {
    label: "Goal", hint: "Where you are heading, and the steps to get there", section: "goals",
    stateField: "status",
    states: ["Not started", "In progress", "On track", "At risk", "Achieved"],
    done: ["Achieved"], action: ["At risk"],
    defaults: { status: "In progress", horizon: "1 year", area: "Family", who: "both" },
  },
  decision: {
    label: "Decision", hint: "What we agreed", section: null,
    stateField: "status", states: [], done: [], action: [],
    defaults: { section: "general" },
  },
};

export const INVESTMENT_TYPES = ["Property", "Stocks", "Business", "Fund", "Other"] as const;
export const DEAL_GROUPS = {
  property: { title: "Property", types: ["Property"], blurb: "Land, homes and rental property." },
  stocks: { title: "Stocks", types: ["Stocks", "Fund"], blurb: "Listed shares, ETFs and funds." },
  business: { title: "Business", types: ["Business", "Other"], blurb: "Private businesses and other deals." },
} as const;
export type DealGroup = keyof typeof DEAL_GROUPS;

/** One, three, five. Far enough to matter, close enough to picture. */
export const HORIZONS = ["1 year", "3 years", "5 years"] as const;
export const LIFE_AREAS = ["Faith", "Family", "Health", "Wealth", "Business",
  "Personal", "Experiences"] as const;
export const CONFIDENCE = ["Confirmed", "Expected", "Possible"] as const;
export const STREAMS = ["Active", "Passive"] as const;
export const REPEATS = ["Once", "Monthly", "Annually"] as const;

/**
 * Every expense is a need or a want. This is the one lever you fully control on
 * the Financial Freedom Score: the needs number is the line passive income has to
 * clear, and wants are what you choose on top of it.
 */
export const NEED_WANT = ["Need", "Want"] as const;
export type NeedWant = (typeof NEED_WANT)[number];

/** Kinds that carry a need-or-want classification. */
export const EXPENSE_KINDS: readonly Kind[] = ["bill", "onceoff", "maintenance"];

/** The state value of an item, whichever field its kind keeps it in. */
export function stateOf(item: { kind: Kind; status: string | null; stage: string | null }): string {
  return (KIND_DEFS[item.kind].stateField === "stage" ? item.stage : item.status) ?? "";
}

export function isDone(item: {
  kind: Kind;
  status: string | null;
  stage: string | null;
  receivedDate?: string | null;
  actual?: string | number | null;
}): boolean {
  if (item.kind === "income") {
    return Boolean(item.receivedDate) || (item.actual !== null && item.actual !== undefined && item.actual !== "");
  }
  return KIND_DEFS[item.kind].done.includes(stateOf(item));
}

export function needsAction(item: { kind: Kind; status: string | null; stage: string | null }): boolean {
  return KIND_DEFS[item.kind].action.includes(stateOf(item));
}

export type Tone = "action" | "waiting" | "done";

export function toneOf(item: Parameters<typeof isDone>[0]): Tone {
  if (isDone(item)) return "done";
  if (needsAction(item as Parameters<typeof needsAction>[0])) return "action";
  return "waiting";
}
