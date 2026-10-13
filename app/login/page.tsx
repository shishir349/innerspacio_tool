import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Don't show the login form.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/80">
        <CardHeader className="items-center text-center">
          <Logo className="mb-2" />
          <p className="text-sm text-muted-foreground">Sign in to the studio workspace</p>
        </CardHeader>
        <CardContent>
          {isSupabaseConfigured() ? (
            <Suspense>
              <LoginForm />
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sign-in is unavailable: Supabase is not configured on this server, so there is no
              account system to check credentials against. Configure Supabase to enable sign-in.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
