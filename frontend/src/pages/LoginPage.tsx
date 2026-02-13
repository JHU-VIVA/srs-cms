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
    <div className="flex flex-col min-h-screen">
      <header>
        <Header />
      </header>
      <main className="flex-grow">
        <div className="md:container md:mx-auto">
          <div className="container mx-auto mt-10 max-w-md p-6 bg-white rounded shadow">
            <h2 className="text-2xl font-bold mb-5">Login</h2>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="form-error mb-4">
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
                <button type="submit" className="btn btn-primary">
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
