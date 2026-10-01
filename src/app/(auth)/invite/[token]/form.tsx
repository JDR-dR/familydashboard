"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        formData.set("token", token);
        startTransition(async () => {
          const result = await acceptInvite(formData);
          if (result.error) setError(result.error);
          else router.push("/");
        });
      }}
    >
      {error ? <div className="err">{error}</div> : null}
      <div className="f">
        <label htmlFor="password">Password</label>
        <input
          className="fld"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <div className="small muted" style={{ marginTop: 6 }}>
          At least 12 characters. A short phrase you will remember works best.
        </div>
      </div>
      <div className="f">
        <label htmlFor="confirm">Confirm password</label>
        <input className="fld" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <button className="btn pri" style={{ width: "100%", padding: 10 }} disabled={pending}>
        {pending ? "Setting up…" : "Set password and sign in"}
      </button>
    </form>
  );
}
