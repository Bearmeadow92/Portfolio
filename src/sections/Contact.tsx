/**
 * @file Contact section with a Netlify Forms powered message form.
 */
import { useState } from "react";
import { profile } from "../data/profile";
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
    } catch {
      setStatus("error");
    }
  };

  /** Renders a labeled text input wired up with validation and ARIA error messaging. */
  const field = (key: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${key}`} className="mb-1 block text-sm text-muted">{label}</label>
      <input
        id={`c-${key}`}
        name={key}
        value={fields[key]}
        onChange={update(key)}
        className={`input font-sans ${errors[key] ? "border-bad" : ""}`}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `c-${key}-err` : undefined}
        {...props}
      />
      {errors[key] && <p id={`c-${key}-err`} className="mt-1 text-sm text-bad">{errors[key]}</p>}
    </div>
  );

  return (
    <section id="contact" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index="07" kicker="contact" title="Let's build something together">
        Hiring, collaborating, or just want to talk shop about React, security, or the veteran to tech journey? My inbox is open.
      </SectionHeading>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <div className="space-y-3">
            <a href={profile.links.github} target="_blank" rel="noreferrer" className="panel panel-hover flex items-center gap-4 p-5">
              <span className="text-2xl" aria-hidden>🐙</span>
              <div>
                <p className="font-semibold">GitHub</p>
                <p className="font-mono text-sm text-muted">@{profile.github}</p>
              </div>
            </a>
            <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className="panel panel-hover flex items-center gap-4 p-5">
              <span className="text-2xl" aria-hidden>💼</span>
              <div>
                <p className="font-semibold">LinkedIn</p>
                <p className="text-sm text-muted">Let's connect</p>
              </div>
            </a>
            {profile.links.email && (
              <a href={`mailto:${profile.links.email}`} className="panel panel-hover flex items-center gap-4 p-5">
                <span className="text-2xl" aria-hidden>✉️</span>
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-sm text-muted">{profile.links.email}</p>
                </div>
              </a>
            )}
            <div className="panel p-5 font-mono text-sm text-muted">
              <span className="text-accent">$</span> response_time <span className="text-good">--fast</span>
              <br />
              <span className="text-muted/70"># Usually within a day or two.</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          {status === "sent" ? (
            <div className="panel grid h-full place-items-center p-10 text-center" role="status">
              <div>
                <p className="text-5xl">📡</p>
                <p className="mt-4 text-2xl font-bold text-gradient">Transmission received!</p>
                <p className="mt-2 text-muted">Thanks for reaching out. I'll get back to you soon.</p>
                <button className="btn btn-ghost mt-6" onClick={() => setStatus("idle")}>Send another</button>
              </div>
            </div>
          ) : (
            <form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} noValidate className="panel space-y-4 p-6">
              <input type="hidden" name="form-name" value="contact" />
              {/* Honeypot: hidden from humans, irresistible to bots. */}
              <p className="hidden">
                <label>
                  Leave this empty <input name="bot-field" value={botField} onChange={(e) => setBotField(e.target.value)} tabIndex={-1} autoComplete="off" />
                </label>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("name", "Name", { autoComplete: "name", placeholder: "Ada Lovelace" })}
                {field("email", "Email", { type: "email", autoComplete: "email", placeholder: "ada@company.com" })}
              </div>
              {field("subject", "Subject (optional)", { placeholder: "Software Engineer role" })}
              <div>
                <label htmlFor="c-message" className="mb-1 block text-sm text-muted">Message</label>
                <textarea
                  id="c-message"
                  name="message"
                  value={fields.message}
                  onChange={update("message")}
                  rows={5}
                  maxLength={2000}
                  className={`input resize-y font-sans ${errors.message ? "border-bad" : ""}`}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "c-message-err" : undefined}
                  placeholder="Tell me about your team and what you're building."
                />
                {errors.message && <p id="c-message-err" className="mt-1 text-sm text-bad">{errors.message}</p>}
              </div>
              {status === "error" && (
                <p className="text-sm text-bad" role="alert">
                  Hmm, the message did not go through. Please try again, or reach me on LinkedIn.
                </p>
              )}
              <button type="submit" className="btn btn-primary w-full" disabled={status === "sending"}>
                {status === "sending" ? "Transmitting..." : "Send message ↗"}
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
