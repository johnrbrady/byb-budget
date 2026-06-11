export const PALETTE = {
  primary: "#7FB069",
  primaryDeep: "#5F8A4F",
  secondary: "#B8D4AE",
  accent: "#8FA876",
  textLight: "#1A1A1A",
  textDark: "#F5F5F5",
  surfaceLight: "#FFFFFF",
  surfaceLightAlt: "#F7F8F6",
  surfaceDark: "#1A1A1A",
  surfaceDarkAlt: "#242624",
  border: "#E4E8E0",
  borderDark: "#2F322F",
  warn: "#C27B3F",
  danger: "#DC2626",
};

export const DEFAULT_USERS = [
  { id: "u-user1", name: "User 1", role: "owner", colour: "#7FB069" },
];

export const INCIDENTALS_CAT = {
  id: "c-incidentals",
  name: "Household Incidentals",
  type: "expense",
  colour: "#9CA3AF",
  monthlyBudget: 0,
  baseAmount: 0,
  envelopeBalance: 0,
  isAccumulating: false,
  protected: true,
};

export const SAVINGS_CAT = {
  id: "c-savings",
  name: "Savings",
  type: "expense",
  colour: "#7FB069",
  monthlyBudget: 0,
  baseAmount: 0,
  envelopeBalance: 0,
  isAccumulating: true,
  protected: true,
};

export const DEFAULT_CATEGORIES = [
  { id: "c-salary",     name: "Salary",       type: "income", colour: "#7FB069", monthlyBudget: null },
  { id: "c-other-in",  name: "Other Income", type: "income", colour: "#A0B894", monthlyBudget: null },
  // Housing
  { id: "c-mortgage",  name: "Mortgage Repayments",       type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 31 },
  { id: "c-bodycorp",  name: "Body Corporate Fees",        type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2  },
  { id: "c-council",   name: "Council Rates",              type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2  },
  { id: "c-homeins",   name: "Home Contents Insurance",    type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  { id: "c-homemaint", name: "Home Maintenance & Repairs", type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2  },
  // Utilities
  { id: "c-utilities", name: "Utilities",             type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3   },
  { id: "c-internet",  name: "Internet & Data Services", type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1   },
  { id: "c-mobile",    name: "Mobile Phone",            type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  // Food & Home
  { id: "c-groceries",   name: "Groceries",              type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 10 },
  { id: "c-incidentals", name: "Household Incidentals",  type: "expense", colour: "#9CA3AF", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2,  protected: true },
  // Health
  { id: "c-healthins", name: "Health Insurance",  type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 4   },
  { id: "c-medical",   name: "Medical Expenses",  type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1.5 },
  { id: "c-gym",       name: "Gym & Fitness",     type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1.5 },
  // Personal care
  { id: "c-care-p1", name: "Personal Care – Partner 1", type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  { id: "c-care-p2", name: "Personal Care – Partner 2", type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  // Transport
  { id: "c-carins",  name: "Car Insurance",                      type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2   },
  { id: "c-vehreg",  name: "Vehicle Registration",               type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 0.5 },
  { id: "c-vehserv", name: "Vehicle Servicing & Maintenance",    type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1   },
  { id: "c-fuel",    name: "Fuel",                               type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3   },
  { id: "c-tolls",   name: "Road Tolls & Parking",               type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 0.5 },
  // Allowances & discretionary
  { id: "c-allow-p1", name: "Partner 1 – Personal Allowance",      type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-allow-p2", name: "Partner 2 – Personal Allowance",      type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-disc-p1",  name: "Partner 1 – Discretionary Spending",  type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-disc-p2",  name: "Partner 2 – Discretionary Spending",  type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  // Family
  { id: "c-children",   name: "Children's Allowance",     type: "expense", colour: "#B8D4AE", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-famsupport", name: "Family Support Payments",  type: "expense", colour: "#5F8A4F", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 3 },
  // Lifestyle
  { id: "c-entertain",   name: "Entertainment",            type: "expense", colour: "#6B9559", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 2 },
  { id: "c-gifts",       name: "Gifts & Celebrations",     type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 1 },
  { id: "c-travel",      name: "Travel",                   type: "expense", colour: "#8FA876", baseAmount: 0, envelopeBalance: 0, isAccumulating: true,  suggestedPct: 2 },
  { id: "c-charitable",  name: "Charitable Contributions", type: "expense", colour: "#A0B894", baseAmount: 0, envelopeBalance: 0, isAccumulating: false, suggestedPct: 1 },
  // Savings — protected, always accumulating, always last
  { id: "c-savings", name: "Savings", type: "expense", colour: "#7FB069", baseAmount: 0, envelopeBalance: 0, isAccumulating: true, suggestedPct: 11, protected: true },
];

export const VIEW_ORDER = ["dashboard", "transactions", "categories", "recurring", "reports"];

export const VIEW_TITLES = {
  dashboard: "Dashboard",
  transactions: "Transactions",
  categories: "Envelopes",
  recurring: "Recurring",
  reports: "Reports",
};
