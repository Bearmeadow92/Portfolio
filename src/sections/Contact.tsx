/**
 * @file Contact section with a Netlify Forms powered message form.
 */
import { useState } from "react";
import { profile } from "../data/profile";
import { Button } from "../components/Button";
import { pulse } from "../art/Backdrop";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { sfx } from "../lib/sound";

/** The form's field names. They must match the hidden blueprint form in index.html. */
interface Fields {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: "", email: "", subject: "", message: "" };

/** Client side validation. The server (Netlify) still treats all input as untrusted. */
function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Please share your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "That email does not look quite right.";
  if (f.message.trim().length < 10) e.message = "A few more words, please (10 characters minimum).";
  return e;
}

/**
 * Contact form handled by Netlify Forms. React submits it with fetch as URL encoded data,
 * and the hidden blueprint form in index.html lets Netlify detect it at deploy time.
 */
export function Contact() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [botField, setBotField] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  /** Curried change handler: updates one field and clears its error as the user types. */
  const update = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  /** Validates, then posts the form to Netlify as URL encoded data. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("sending");
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "contact", "bot-field": botField, ...fields }).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
      setFields(EMPTY);
      sfx.win();
      pulse(1.5);
    } catch {
      setStatus("error");
    }
  };

  /** Renders a labeled text input wired up with validation and ARIA error messaging. */
  const field = (key: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${key}`} className="label mb-2 block opacity-70">{label}</label>
      <input
        id={`c-${key}`}
        name={key}
        value={fields[key]}
        onChange={update(key)}
        className={`input ${errors[key] ? "!border-bad" : ""}`}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `c-${key}-err` : undefined}
        {...props}
      />
      {errors[key] && <p id={`c-${key}-err`} className="mt-1 text-sm text-bad">{errors[key]}</p>}
    </div>
  );

  return (
    <section id="contact" className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-28 sm:px-10">
      <SectionHeading index="05" label="Contact" title="Let's build something good.">
        Hiring, collaborating, or just starting out and looking for advice? My inbox is open, and I answer every message, usually within a day or two.
      </SectionHeading>

      <div className="grid gap-x-16 gap-y-12 md:pl-[11rem] lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <ul className="border-b border-border">
            <li>
              <a href={profile.links.github} target="_blank" rel="noreferrer" className="row flex items-baseline justify-between gap-4 px-2 py-5">
                <span className="font-display text-2xl font-medium tracking-tight">GitHub</span>
                <span className="label opacity-70">@{profile.github} ↗</span>
              </a>
            </li>
            <li>
              <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="row flex items-baseline justify-between gap-4 px-2 py-5">
                <span className="font-display text-2xl font-medium tracking-tight">LinkedIn</span>
                <span className="label opacity-70">Connect ↗</span>
              </a>
            </li>
            {profile.links.email && (
              <li>
                <a href={`mailto:${profile.links.email}`} className="row flex items-baseline justify-between gap-4 px-2 py-5">
                  <span className="font-display text-2xl font-medium tracking-tight">Email</span>
                  <span className="label opacity-70">{profile.links.email}</span>
                </a>
              </li>
            )}
          </ul>
        </Reveal>

        <Reveal delay={100}>
          {status === "sent" ? (
            <div className="panel p-8 sm:p-12" role="status">
              <p className="display text-4xl sm:text-5xl">Message sent.</p>
              <p className="mt-4 text-muted">Thank you for reaching out. I will get back to you soon.</p>
              <Button className="mt-8" onClick={() => setStatus("idle")}>
                Send another
              </Button>
            </div>
          ) : (
            <form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} noValidate className="panel space-y-5 p-6 sm:p-8">
              <input type="hidden" name="form-name" value="contact" />
              {/* Honeypot: hidden from humans, irresistible to bots. */}
              <p className="hidden">
                <label>
                  Leave this empty <input name="bot-field" value={botField} onChange={(e) => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" />
                </label>
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {field("name", "Name", { autoComplete: "name", placeholder: "Ada Lovelace" })}
                {field("email", "Email", { type: "email", autoComplete: "email", placeholder: "ada@company.com" })}
              </div>
              {field("subject", "Subject (optional)", { placeholder: "Software engineer role" })}
              <div>
                <label htmlFor="c-message" className="label mb-2 block opacity-70">Message</label>
                <textarea
                  id="c-message"
                  name="message"
                  value={fields.message}
                  onChange={update("message")}
                  rows={5}
                  maxLength={2000}
                  className={`input resize-y ${errors.message ? "!border-bad" : ""}`}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "c-message-err" : undefined}
                  placeholder="Tell me about your team and what you are building."
                />
                {errors.message && <p id="c-message-err" className="mt-1 text-sm text-bad">{errors.message}</p>}
              </div>
              {status === "error" && (
                <p className="text-sm text-bad" role="alert">
                  The message did not go through. Please try again, or reach me on LinkedIn.
                </p>
              )}
              <Button type="submit" variant="primary" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? "Sending" : "Send message"} <span aria-hidden>→</span>
              </Button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
