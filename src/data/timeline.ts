/**
 * @file Milestones shown in the About section timeline, oldest first.
 */

export interface TimelineEntry {
  /** Short label for when this happened, such as a year or "Now". */
  period: string;
  title: string;
  org: string;
  detail: string;
  icon: string;
}

export const timeline: TimelineEntry[] = [
  {
    period: "Service",
    title: "United States Marine",
    org: "U.S. Marine Corps",
    detail: "Leadership, accountability, and focus. Learned that preparation beats panic every single time.",
    icon: "🎖️",
  },
  {
    period: "Transition",
    title: "Self-taught to systematic",
    org: "The home lab",
    detail: "Built home labs, broke them, fixed them, and discovered that solving problems with code is my favorite kind of challenge.",
    icon: "🛠️",
  },
  {
    period: "May 2026",
    title: "B.S. Cybersecurity",
    org: "Southern New Hampshire University",
    detail: "Network defense, secure software, cryptography, and risk management. Graduated with a security-first engineering mindset.",
    icon: "🎓",
  },
  {
    period: "Now",
    title: "Software Engineer, ready to deploy",
    org: "NextGenTechnologist",
    detail: "Building React apps, HTML5 games, and developer tools, and looking for a team where I can ship and grow.",
    icon: "🚀",
  },
];
