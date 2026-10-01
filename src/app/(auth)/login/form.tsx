"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signIn(formData);
          if (result?.error) setError(result.error);
          else router.push("/");
        });
      }}
    >
      {error ? <div className="err">{error}</div> : null}
      <div className="f">
        <label htmlFor="email">Email</label>
        <input className="fld" id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="f">
        <label htmlFor="password">Password</label>
        <input
          className="fld"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn pri" style={{ width: "100%", padding: 10 }} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
