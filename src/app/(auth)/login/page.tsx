import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage() {
  if (await currentSession()) redirect("/");
  return (
    <main className="loginwrap">
      <div className="loginbox">
        <h1>Family Dashboard</h1>
        <p className="sub">Our weekly operating system.</p>
        <LoginForm />
      </div>
    </main>
  );
}
