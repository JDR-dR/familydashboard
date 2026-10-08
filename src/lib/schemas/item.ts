import { z } from "zod";
import { KINDS, SECTIONS, SLOTS, PEOPLE } from "@/lib/domain/kinds";

const optionalString = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null));

/** Accepts "R12 500", "12,500.50" or empty, and returns a numeric string or null. */
const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned || Number.isNaN(Number(cleaned))) return null;
    return Number(cleaned).toFixed(2);
  });

export const itemFormSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  kind: z.enum(KINDS),
  title: z.string().trim().min(1, "Give it a name").max(300),
  who: z
    .string()
    .optional()
    .transform((value) => (value && value in PEOPLE ? value : null)),
  dueDate: optionalDate,
  amount: optionalMoney,
  status: optionalString,
  stage: optionalString,
  section: z
    .string()
    .optional()
    .transform((value) => (value && value in SECTIONS ? value : null)),
  slot: z
    .string()
    .optional()
    .transform((value) =>
      value && (SLOTS as readonly string[]).includes(value) ? value : null,
    ),
  nextStep: optionalString,
  notes: optionalString,
  category: optionalString,
  projectId: optionalString,
  linkedItemId: optionalString,

  // kind-specific, all stored in `data`
  stream: optionalString,
  confidence: optionalString,
  actual: optionalMoney,
  receivedDate: optionalDate,
  repeat: optionalString,
  need: optionalString,
  truth: optionalString,
  type: optionalString,
  provider: optionalString,
  reimbursed: optionalMoney,
  startedDate: optionalDate,
  answer: optionalString,
  answeredDate: optionalDate,
  purpose: optionalString,
  area: optionalString,
  horizon: optionalString,
  measure: optionalString,
  turnover: optionalMoney,
  profit: optionalMoney,
  strategy: optionalString,
  focus: optionalString,
  actions: optionalString,

  // up to three steps and two links, flattened for the form
  step0: optionalString, step0done: optionalString,
  step1: optionalString, step1done: optionalString,
  step2: optionalString, step2done: optionalString,
  link0url: optionalString, link0label: optionalString,
  link1url: optionalString, link1label: optionalString,
});

export type ItemFormInput = z.input<typeof itemFormSchema>;
export type ItemFormValues = z.output<typeof itemFormSchema>;

/** Which form fields belong in the jsonb `data` column. */
export const DATA_FIELDS = [
  "stream", "confidence", "actual", "receivedDate", "repeat", "need", "truth",
  "type", "provider", "reimbursed", "startedDate", "answer", "answeredDate",
  "purpose", "area", "horizon", "measure", "turnover", "profit", "strategy",
  "focus", "actions", "spawnedId",
] as const;

export const noteSchema = z.object({
  itemId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export const meetingSchema = z.object({
  periodType: z.enum(["week", "month", "quarter", "year"]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  step: z.coerce.number().int().min(1).max(12).optional(),
  discussed: z.coerce.boolean().optional(),
  notes: z.string().max(10_000).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("That does not look like an email address"),
  password: z.string().min(1, "Enter your password"),
});

export const inviteSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  personKey: z.string().optional(),
  role: z.enum(["partner", "member"]),
});

export const passwordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "The two passwords do not match",
    path: ["confirm"],
  });

export const namesSchema = z.object({
  dad: z.string().trim().max(60).optional(),
  mom: z.string().trim().max(60).optional(),
  c1: z.string().trim().max(60).optional(),
  c2: z.string().trim().max(60).optional(),
  c3: z.string().trim().max(60).optional(),
});

/** The monthly spend you decide on. Blank means "work it out from the bills". */
export const freedomBaselineSchema = z.object({
  monthlyNeeds: optionalMoney,
  monthlyWants: optionalMoney,
});

/** Taking a reading of the score and keeping it. */
export const freedomCaptureSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passive: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  needs: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  wants: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  score: z.coerce.number().int().min(0).max(100000),
  note: z.string().trim().max(2000).optional(),
});
