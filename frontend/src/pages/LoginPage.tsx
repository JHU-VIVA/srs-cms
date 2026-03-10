import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Header from "../components/Header";
import Footer from "../components/Footer";

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
    <div className="flex flex-col min-h-screen bg-gradient-mesh">
      <header className="sticky top-0 z-50 animate-slide-down">
        <Header />
      </header>
      <main className="flex-grow flex items-center justify-center px-4">
        <div className="w-full max-w-md p-8 glass-card-solid animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 text-slate-800">Login</h2>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="alert alert-error mb-4 text-sm">
                <p>{error}</p>
              </div>
            )}

            <div className="form-row">
              <label className="form-label w-24">Username:</label>
              <div className="form-input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label w-24">Password:</label>
              <div className="form-input-wrapper">
                <input
                  type="password"
                  className="form-input"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="my-4">
              <button type="submit" className="btn btn-primary w-full">
                Login
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
