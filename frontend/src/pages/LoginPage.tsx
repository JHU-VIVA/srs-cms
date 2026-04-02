import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-viva-navy">
      {/* Globe background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "url('/viva-globe.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "url('/viva-pattern.png')",
          backgroundSize: "400px",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header bar */}
        <div className="flex items-center px-6 py-4">
          <img src="/viva-logo-white.png" alt="VIVA" className="h-8" />
        </div>

        {/* Login form */}
        <main className="flex-grow flex items-center justify-center px-4">
          <div className="w-full max-w-md p-8 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl animate-slide-up">
            <h2 className="text-2xl font-bold mb-2 text-white">Welcome</h2>
            <p className="text-viva-light/60 text-sm mb-6">Sign in to SRS-CMS</p>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-error mb-4 text-sm bg-red-500/20 border-red-500/30 text-red-200">
                  <p>{error}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-viva-light/80 text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-viva-accent focus:ring-2 focus:ring-viva-accent/30 transition-all duration-200"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="mb-6">
                <label className="block text-viva-light/80 text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-viva-accent focus:ring-2 focus:ring-viva-accent/30 transition-all duration-200"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn w-full bg-viva-accent hover:bg-viva-accent/80 text-white border-none">
                Sign In
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <div className="flex items-center justify-center px-6 py-4">
          <p className="text-viva-light/30 text-xs">VIVA SRS-CMS</p>
        </div>
      </div>
    </div>
  );
}
