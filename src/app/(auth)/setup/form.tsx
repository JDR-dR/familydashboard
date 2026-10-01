"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFirstOwner } from "./actions";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createFirstOwner(formData);
          if (result.error) setError(result.error);
          else router.push("/");
        });
      }}
    >
      {error ? <div className="err">{error}</div> : null}
      <div className="f">
        <label htmlFor="name">Your name</label>
        <input className="fld" id="name" name="name" required autoFocus placeholder="John" />
      </div>
      <div className="f">
        <label htmlFor="email">Email</label>
        <input className="fld" id="email" name="email" type="email" required autoComplete="username" />
      </div>
      <div className="f">
        <label htmlFor="password">Password</label>
        <input
          className="fld"
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
        <div className="small muted" style={{ marginTop: 6 }}>
          At least 12 characters. A short phrase you will remember beats something cryptic.
        </div>
      </div>
      <div className="f">
        <label htmlFor="confirm">Confirm password</label>
        <input className="fld" id="confirm" name="confirm" type="password" required autoComplete="new-password" />
      </div>
      <button className="btn pri" style={{ width: "100%", padding: 10 }} disabled={pending}>
        {pending ? "Setting up…" : "Create my account"}
      </button>
    </form>
  );
}
