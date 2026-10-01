/**
 * Every record in the app is an item with a `kind`. This file is the single source
 * of truth for what each kind is called, which states it moves through, which of
 * those count as done, and which demand action. Screens, pills, boards and the
 * cash-required calculation all read from here.
 */

export const KINDS = [
  "task", "income", "bill", "onceoff", "maintenance", "project", "projectexp",
  "medical", "investment", "experience", "prayer", "sowing", "goal", "lifegoal",
  "decision",
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
  defaults: Record<string, string | number | null>;
}

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
    categories: ["Salaries", "Studio M sales / income", "Dividends", "Rental income",
      "Interest", "Other income", "Possible future income"],
    defaults: { confidence: "Expected", stream: "Active" },
  },
  bill: {
    label: "Bill", hint: "Regular household bill", section: "home",
    stateField: "status",
    states: ["To pay", "Scheduled", "Paid"], done: ["Paid"], action: ["To pay"],
    categories: ["Medical", "Rates and taxes", "Electricity", "Water", "Insurance",
      "Fibre", "Security", "Household services", "Other"],
    defaults: { status: "To pay", repeat: "Monthly" },
  },
  onceoff: {
    label: "Once-off expense", hint: "Purchase, repair or improvement", section: "home",
    stateField: "status",
    states: ["Considering", "To buy", "Paid"], done: ["Paid"], action: ["To buy"],
    categories: ["Appliances", "Furniture", "Repairs", "Household purchases",
      "Improvements", "Other"],
    defaults: { status: "To buy" },
  },
  maintenance: {
    label: "Maintenance", hint: "Something in or around the house", section: "home",
    stateField: "status",
    states: ["Fine", "Keep an eye on", "Needs Action", "Booked", "Done"],
    done: ["Done", "Fine"], action: ["Needs Action"],
    categories: MAINTENANCE_CATEGORIES,
    defaults: { status: "Needs Action" },
  },
  project: {
    label: "Project", hint: "A build, renovation or capital project", section: "projects",
    stateField: "status",
    states: ["Planning", "In progress", "On hold", "Done"],
    done: ["Done"], action: ["In progress"],
    defaults: { status: "Planning" },
  },
  projectexp: {
    label: "Project expense", hint: "A cost inside a project", section: "projects",
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
    defaults: { status: "To pay" },
  },
  investment: {
    label: "Investment", hint: "Opportunity or deal", section: "investments",
    stateField: "stage",
    states: ["Idea", "Research", "Considering", "Due Diligence", "Committed",
      "Invested", "Passed"],
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
  sowing: {
    label: "Sowing", hint: "Giving to a person or organisation", section: "kingdom",
    stateField: "status",
    states: ["Considering", "Committed", "Given"], done: ["Given"], action: ["Committed"],
    defaults: { status: "Considering", who: "both" },
  },
  goal: {
    label: "Strategy", hint: "How we get there, per business or area", section: "goals",
    stateField: "status", states: [], done: [], action: [],
    defaults: {},
  },
  lifegoal: {
    label: "Goal", hint: "Something you want to achieve", section: "goals",
    stateField: "status",
    states: ["Not started", "In progress", "On track", "Achieved"],
    done: ["Achieved"], action: [],
    defaults: { status: "In progress", horizon: "This year", area: "Family", who: "both" },
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

export const HORIZONS = ["This year", "3 years", "10 years", "Lifetime"] as const;
export const LIFE_AREAS = ["Faith", "Family", "Health", "Wealth", "Business",
  "Personal", "Experiences"] as const;
export const CONFIDENCE = ["Confirmed", "Expected", "Possible"] as const;
export const STREAMS = ["Active", "Passive"] as const;
export const REPEATS = ["Once", "Monthly", "Annually"] as const;

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
