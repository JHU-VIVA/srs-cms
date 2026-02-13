import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto mt-10 max-w-lg p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-5 text-center">{user?.username}</h2>
    </div>
  );
}
