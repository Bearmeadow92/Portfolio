/**
 * @file Single source of truth for personal info.
 *
 * Edit this file to update the whole site. Components never hardcode these values,
 * so a new job title or link is a one line change.
 */
export const profile = {
  name: "Jesse",
  brand: "NextGenTechnologist",
  role: "Software engineer",
  focus: "Security minded",
  /** Hero headline, one entry per line. */
  headline: ["Hard to break.", "Easy to love."],
  intro: "I'm Jesse. I build fast, careful software, then I try to break it before anyone else can.",
  /** GitHub username and the repository that holds this site (shown in the Source section). */
  github: "Bearmeadow92",
  repo: "Portfolio",
  links: {
    github: "https://github.com/Bearmeadow92",
    // TODO: replace with your real LinkedIn and email before deploying.
    linkedin: "https://www.linkedin.com/",
    /** Leave empty to hide the email link in the Contact section. */
    email: "",
  },
  about: {
    /** Set large, so keep it to a sentence or two. */
    lead: "I studied cybersecurity and I write software, so I think about how something fails before I think about how it looks. Then I make it look good anyway.",
    body: [
      "Discipline came first. I served in the United States Marine Corps, where I learned to plan carefully, stay calm under pressure, and finish what I start. I earned my B.S. in Cybersecurity from Southern New Hampshire University in May 2026.",
      "Everything on this site is built by hand with React, TypeScript, and the plain web platform, including the art moving behind this text. The tools run entirely in your browser. The games have no engine underneath. Poke at all of it.",
    ],
  },
  /** Life outside of work. Short, true, and specific beats long and polished. */
  offTheClock: [
    { title: "Home lab", note: "I build networks and servers at home, then break into them on purpose to see what holds." },
    { title: "Games", note: "I play them, and I take them apart to learn how they work. The three here started that way." },
    { title: "Wrenching", note: "Engines and code reward the same habit: understand the system before you touch it." },
    { title: "Mentoring", note: "I help veterans and new technologists find their first foothold in tech." },
  ],
} as const;

export type Profile = typeof profile;
