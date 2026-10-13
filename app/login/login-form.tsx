"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/lib/actions/auth";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signInAction({
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full gap-2">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
