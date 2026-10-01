"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPassword, invitePerson, saveNames } from "@/lib/actions/settings";
import { ImportPanel } from "@/components/ImportPanel";

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  personKey: string | null;
  hasPassword: boolean;
}

export function SettingsForms({
  names,
  isOwner,
  people,
  personOptions,
}: {
  names: Record<string, string>;
  isOwner: boolean;
  people: Person[];
  personOptions: Array<{ key: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  return (
    <>
      {message ? <div className="ok">{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}

      <div className="block">
        <div className="bh">
          <h2 className="st">Family names</h2>
          <span className="note">Used everywhere someone is assigned</span>
        </div>
        <form
          className="list"
          style={{ padding: 18 }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await saveNames(formData);
              if (result.ok) {
                setMessage("Names saved.");
                router.refresh();
              } else setError(result.error ?? "That could not be saved");
            });
          }}
        >
          <div className="frow">
            {[
              ["dad", "Dad"],
              ["mom", "Mom"],
            ].map(([key, label]) => (
              <div className="f" key={key}>
                <label>{label}</label>
                <input className="fld" name={key} defaultValue={names[key] ?? ""} placeholder={label} />
              </div>
            ))}
          </div>
          <div className="frow">
            {[
              ["c1", "Child 1"],
              ["c2", "Child 2"],
            ].map(([key, label]) => (
              <div className="f" key={key}>
                <label>{label}</label>
                <input className="fld" name={key} defaultValue={names[key] ?? ""} placeholder={label} />
              </div>
            ))}
          </div>
          <div className="f">
            <label>Child 3</label>
            <input className="fld" name="c3" defaultValue={names.c3 ?? ""} placeholder="Child 3" />
          </div>
          <button className="btn pri" disabled={pending}>
            Save names
          </button>
        </form>
      </div>

      <div className="block">
        <div className="bh">
          <h2 className="st">Who can sign in</h2>
          <span className="note">{people.length} account{people.length === 1 ? "" : "s"}</span>
        </div>
        <div className="list">
          {people.map((person) => (
            <div className="row" key={person.id}>
              <div className="r-check" />
              <div className="r-main">
                <div className="r-title">{person.name}</div>
                <div className="r-sub">{person.email}</div>
              </div>
              <div className="r-meta">
                <div className="r-who">{person.role}</div>
                <div className="r-date" />
              </div>
              <div className="r-amt" />
              <div className="r-status">
                <span className={`pill ${person.hasPassword ? "done" : "action"}`}>
                  {person.hasPassword ? "Active" : "Invited"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {isOwner ? (
          <form
            className="list"
            style={{ padding: 18, marginTop: 12 }}
            action={(formData) => {
              setError(null);
              setInviteLink(null);
              startTransition(async () => {
                const result = await invitePerson(formData);
                if (result.ok) {
                  setMessage("Account created. Send them the link below.");
                  setInviteLink(result.link ?? null);
                  router.refresh();
                } else setError(result.error ?? "That invitation could not be created");
              });
            }}
          >
            <div className="bh">
              <h2 className="st" style={{ fontSize: 15 }}>
                Invite someone
              </h2>
            </div>
            <div className="frow">
              <div className="f">
                <label>Name</label>
                <input className="fld" name="name" required placeholder="Moniek" />
              </div>
              <div className="f">
                <label>Email</label>
                <input className="fld" name="email" type="email" required />
              </div>
            </div>
            <div className="frow">
              <div className="f">
                <label>They are</label>
                <select className="fld" name="personKey" defaultValue="mom">
                  <option value="">—</option>
                  {personOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {names[option.key] ?? option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label>Access</label>
                <select className="fld" name="role" defaultValue="partner">
                  <option value="partner">Partner — everything</option>
                  <option value="member">Member — tasks and notes</option>
                </select>
              </div>
            </div>
            <button className="btn pri" disabled={pending}>
              Create account
            </button>
            {inviteLink ? (
              <div className="post" style={{ marginTop: 12 }}>
                <b>Invitation link, valid for 3 days</b>
                {inviteLink}
              </div>
            ) : null}
          </form>
        ) : null}
      </div>

      {isOwner ? <ImportPanel /> : null}

      <div className="block">
        <div className="bh">
          <h2 className="st">Your password</h2>
          <span className="note">Changing it signs you out everywhere</span>
        </div>
        <form
          className="list"
          style={{ padding: 18 }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await changeOwnPassword(formData);
              if (result.ok) {
                setMessage("Password changed. Sign in again on your other devices.");
              } else setError(result.error ?? "That could not be changed");
            });
          }}
        >
          <div className="frow">
            <div className="f">
              <label>New password</label>
              <input className="fld" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="f">
              <label>Confirm</label>
              <input className="fld" name="confirm" type="password" autoComplete="new-password" required />
            </div>
          </div>
          <button className="btn" disabled={pending}>
            Change password
          </button>
        </form>
      </div>
    </>
  );
}
