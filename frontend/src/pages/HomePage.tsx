import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="mt-10 max-w-lg mx-auto animate-slide-up">
      <div className="glass-card-solid p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">
            {user?.username[0].toUpperCase()}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">{user?.username}</h2>
        <p className="text-slate-500 mt-1">Welcome to SRS-CMS</p>
      </div>
    </div>
  );
}
