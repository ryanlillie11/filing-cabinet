import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="index-card w-full max-w-md p-8 text-center">
        <div className="index-card-rule pb-3 mb-6">
          <h1 className="typewriter text-3xl tracking-wide">THE FILING CABINET</h1>
          <p className="mono text-xs text-faded mt-1">
            house document ingestion &amp; index
          </p>
        </div>
        <p className="mono text-sm mb-6">
          Sign in with Google to open the cabinet. The same login grants Drive
          access for filing.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-stamp text-sm px-6 py-2">
            ⌘ Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
