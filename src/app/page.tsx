import { redirect } from "next/navigation";
import { getCookieSession } from "@/lib/auth";
import { ROLE_HOME_ROUTES } from "@/lib/roles";

export default async function RootPage() {
  const session = await getCookieSession();
  if (!session) {
    redirect("/login");
  }
  redirect(ROLE_HOME_ROUTES[session.role] ?? "/login");
}
