import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/chat");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-extrabold">Create your account</h1>
      <p className="mb-8 text-slate-600">Your coach is waiting to meet you.</p>
      <AuthForm mode="signup" />
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600">
          Log in
        </Link>
      </p>
    </main>
  );
}
