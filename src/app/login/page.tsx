import { isDemoModeEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoMode = isDemoModeEnabled();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#047857] text-lg font-bold text-white">
            N
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#0F172A]">Nittin ERP</h1>
            <p className="text-xs text-[#64748B]">
              Order-to-Audit Manufacturing System
            </p>
          </div>
        </div>

        <LoginForm demoMode={demoMode} />
      </div>
    </main>
  );
}
