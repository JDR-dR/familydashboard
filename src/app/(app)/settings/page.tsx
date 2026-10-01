import { loadScreen } from "@/lib/page-data";
import { householdUsers } from "@/lib/db/queries";
import { PEOPLE } from "@/lib/domain/kinds";
import { SettingsForms } from "./forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const screen = await loadScreen();
  const people = await householdUsers(screen.householdId);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Settings</h1>
          <p>Family names, who can sign in, and your own password.</p>
        </div>
      </div>

      <SettingsForms
        names={screen.extras.names}
        isOwner={screen.session.user.role === "owner"}
        people={people.map((person) => ({
          id: person.id,
          name: person.name,
          email: person.email,
          role: person.role,
          personKey: person.personKey,
          hasPassword: Boolean(person.passwordHash),
        }))}
        personOptions={Object.entries(PEOPLE).map(([key, label]) => ({ key, label }))}
      />
    </>
  );
}
