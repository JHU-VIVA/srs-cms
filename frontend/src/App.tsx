import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import DeathsPage from "./pages/DeathsPage";
import DeathEditPage from "./pages/DeathEditPage";
import PregnancyOutcomesPage from "./pages/PregnancyOutcomesPage";
import PregnancyOutcomeDetailPage from "./pages/PregnancyOutcomeDetailPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/deaths" element={<DeathsPage />} />
            <Route path="/deaths/:id" element={<DeathEditPage />} />
            <Route path="/pregnancy-outcomes" element={<PregnancyOutcomesPage />} />
            <Route path="/pregnancy-outcomes/:id" element={<PregnancyOutcomeDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
