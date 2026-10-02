import Link from "next/link";
import ForgotForm from "@/components/ForgotForm";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-extrabold">Forgot your password?</h1>
      <p className="mb-8 text-slate-600">
        Enter your email and we&apos;ll let the person who invited you know. They&apos;ll send you a
        link to set a new one.
      </p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-brand-600">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
