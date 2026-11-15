/**
 * Single source of truth for personal info.
 * Edit this file to update the whole site. Components never hardcode these values.
 */
export const profile = {
  name: "Jesse",
  brand: "NextGenTechnologist",
  role: "Software Engineer",
  tagline: "Marine Corps veteran building secure, playful, and genuinely useful software.",
  location: "United States",
  // Roles cycled in the hero typewriter.
  roles: [
    "Software Engineer",
    "React Developer",
    "Cybersecurity Graduate",
    "HTML5 Game Tinkerer",
    "Marine Corps Veteran",
  ],
  github: "bearmeadow92",
  links: {
    github: "https://github.com/bearmeadow92",
    // TODO: replace with your real LinkedIn and email before deploying.
    linkedin: "https://www.linkedin.com/",
    email: "",
    blog: "",
  },
  about: [
    "I learned discipline, teamwork, and how to stay calm under pressure in the United States Marine Corps. Today I bring that same mindset to software: plan the mission, execute with precision, and never leave a teammate (or a bug) behind.",
    "I earned my B.S. in Cybersecurity from Southern New Hampshire University in May 2026, which means I write code with a security-first mindset. I think about input validation, least privilege, and threat models while I build, not after.",
    "This portfolio is my proving ground. Everything here, from the canvas games to the subnet calculator, was built from scratch with React, TypeScript, and native HTML5 APIs. Go ahead and poke at it. Break things. That is how we learn.",
  ],
  stats: [
    { label: "Years of service mindset", value: "∞" },
    { label: "Playable games on this site", value: "3" },
    { label: "Working mini apps", value: "4" },
    { label: "Coffee per bug fixed", value: "1.6" },
  ],
} as const;

export type Profile = typeof profile;
