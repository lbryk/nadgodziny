export interface ReportOptions {
  /** Weekly table in the layout of the school's paper form. */
  weekly: boolean;
  /** Monthly summary (what accounting pays). */
  monthly: boolean;
  /** Events: trips, practice, substitutions … */
  events: boolean;
  /** Written-out calculation steps and notes. */
  steps: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  weekly: true,
  monthly: true,
  events: true,
  steps: true,
};

/** Fixed print palette — independent of the on-screen (possibly dark) theme. */
export const PRINT_COLORS = {
  off: '#cfcfcf',
  void: '#b9b9b9',
  exam: '#ffe08a',
  green: '#1b8a3b',
  line: '#222222',
  soft: '#eef1f8',
  head: '#e7eaf3',
} as const;
