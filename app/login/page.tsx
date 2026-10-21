import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";
import { LoginStage } from "./login-stage";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Don't show the login form.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <LoginStage />
      <main className="flex flex-col justify-center px-6 py-16 sm:px-14 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="lg:hidden" />
          <h1 className="display display-md mt-10 lg:mt-0">
            Welcome <em>back.</em>
          </h1>
          <p className="mt-3 text-muted-foreground">Sign in to continue to your projects.</p>
          <div className="mt-10">
            {isSupabaseConfigured() ? (
              <Suspense>
                <LoginForm />
              </Suspense>
            ) : (
              <p className="text-[0.95rem] text-muted-foreground">
                Sign-in is unavailable: Supabase is not configured on this server, so there is no account system to
                check credentials against. Configure Supabase to enable sign-in.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
