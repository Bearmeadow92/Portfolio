/**
 * @file Single source of truth for personal info.
 *
 * Edit this file to update the whole site. Components never hardcode these values,
 * so a new job title or link is a one line change.
 *
 * Voice guide: warm and encouraging. Talk to the reader like a mentor who also happens
 * to be a solid engineer. Short sentences, real details, no buzzwords.
 */
export const profile = {
  name: "Jesse",
  brand: "NextGenTechnologist",
  role: "Software engineer",
  focus: "Security first",
  /** Hero headline, one entry per line. */
  headline: ["Strong systems.", "Stronger people."],
  intro: "I'm Jesse. I build secure, dependable software, and I love helping the next person find their way into tech.",
  /** GitHub username and the repository that holds this site (shown in the Source section). */
  github: "Bearmeadow92",
  repo: "Portfolio",
  links: {
    github: "https://github.com/Bearmeadow92",
    // TODO: replace with your real LinkedIn profile URL.
    linkedin: "https://www.linkedin.com/",
    /** Leave empty to hide the email link in the Contact section. */
    email: "jadamsfletcher@gmail.com",
  },
  about: {
    /** Set large, so keep it to a sentence or two. */
    lead: "I learned tech the hard way, one broken lab at a time. Now I build software with security baked in from the first line, and I pass along everything I learn.",
    body: [
      "It started in my home lab. I spun up servers, broke them, read the logs, and rebuilt them until the pieces made sense. That habit of digging until I truly understand something stuck with me, and it shapes every line of code I write.",
      "I earned my B.S. in Cybersecurity from Southern New Hampshire University in May 2026. I think about how software can fail before it ships, so the people using it never have to. Validate the input, limit the access, plan for the bad day.",
      "The part I care about most is people. I mentor new technologists and career changers, because someone once did that for me. The best thing you can do with a hard won lesson is hand it forward.",
    ],
  },
  /** Life outside of work. Short, true, and specific beats long and polished. */
  offTheClock: [
    { title: "Home lab", note: "Where I learn by breaking things on purpose, then fixing them properly." },
    { title: "Games", note: "I play them and take them apart to see how they tick. The arcade on this site grew from that." },
    { title: "Wrenching", note: "Engines taught me patience. Understand the whole system first, then pick up the wrench." },
    { title: "Mentoring", note: "Helping someone land their first win in tech is the best part of my week." },
  ],
} as const;

export type Profile = typeof profile;
