import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabase } from "@/lib/supabase";

// Single-user app: Google login doubles as the Drive OAuth grant.
// drive.file scope = only files/folders this app creates.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent", // always issue a refresh token
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, account }) {
      const allowed = (process.env.ALLOWED_LOGIN_EMAIL ?? "").toLowerCase();
      const email = profile?.email?.toLowerCase();
      if (!email || email !== allowed) return false;
      if (account?.refresh_token) {
        // Persist server-side so the email webhook can file to Drive
        // without a browser session.
        await supabase()
          .from("google_auth")
          .upsert({
            id: 1,
            email,
            refresh_token: account.refresh_token,
            updated_at: new Date().toISOString(),
          });
      }
      return true;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  pages: { signIn: "/login" },
});
