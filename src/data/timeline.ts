/**
 * @file Milestones shown in the About section, oldest first.
 */

export interface TimelineEntry {
  /** Short label for when this happened, such as a year or "Now". */
  period: string;
  title: string;
  org: string;
}

export const timeline: readonly TimelineEntry[] = [
  { period: "Service", title: "United States Marine", org: "U.S. Marine Corps" },
  { period: "Transition", title: "Home lab, self taught", org: "Built it, broke it, fixed it" },
  { period: "May 2026", title: "B.S. Cybersecurity", org: "Southern New Hampshire University" },
  { period: "Now", title: "Software engineer", org: "Open to work" },
];
