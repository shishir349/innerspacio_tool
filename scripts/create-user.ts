/**
 * Creates the first (or an additional) Supabase Auth user for InnerSpacio
 * AI Studio. There is no public sign-up screen by design — only someone who
 * already holds the service-role key can create a studio account.
 *
 * This is one of the few places in the codebase that uses the service-role
 * client directly (see README's "Service-role key usage" table) — Supabase
 * Auth's admin user-creation API has no session-bound equivalent, and this
 * script runs on your own machine, never inside a request handler reachable
 * from the browser.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts <email> <password>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set
 * (e.g. via `.env.local` — this script does not read a default from
 * anywhere, and does not accept a blank password).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import path from "path";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}

async function main() {
  loadEnvLocal();

  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const COMMON_WEAK_PASSWORDS = [
    "password",
    "password123",
    "changeme",
    "admin",
    "admin123",
    "innerspacio",
    "12345678",
    "letmein",
  ];
  if (COMMON_WEAK_PASSWORDS.includes(password.toLowerCase())) {
    console.error("That password is too common/predictable. Choose a different one.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set (check .env.local)."
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error(`Could not create user: ${error.message}`);
    process.exit(1);
  }

  console.log(`Created user ${data.user?.email} (id: ${data.user?.id}).`);
  console.log("They can now sign in at /login with the password you provided.");
}

main();
