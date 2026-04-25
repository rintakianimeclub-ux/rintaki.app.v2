import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
// The Google Identity Services button uses the parent <GoogleOAuthProvider clientId={...}>.
// On success Google returns a credential (an ID-token JWT). We POST it to
// /api/auth/google where the backend verifies it against Google and issues our JWT cookies.
export default function GoogleSignInButton({ onError }) {
  const { googleSignIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="w-full flex justify-center" data-testid="google-signin">
      <GoogleLogin
        onSuccess={async (res) => {
          const r = await googleSignIn(res.credential);
          if (r.ok) navigate("/");
          else onError?.(r.error || "Google sign-in failed");
        }}
        onError={() => onError?.("Google sign-in failed")}
        theme="outline"
        size="large"
        shape="pill"
        width="320"
      />
    </div>
  );
}
