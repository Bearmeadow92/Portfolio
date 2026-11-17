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
  { period: "Before", title: "U.S. Marine Corps", org: "Where the discipline started" },
  { period: "The grind", title: "Home lab, self taught", org: "One broken server at a time" },
  { period: "May 2026", title: "B.S. Cybersecurity", org: "Southern New Hampshire University" },
  { period: "Now", title: "Software engineer", org: "Open to software, security, and full stack roles" },
];
