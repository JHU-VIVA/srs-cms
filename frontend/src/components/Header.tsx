import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <div className="navbar glass-nav">
      <div className="navbar-start">
        {/* Mobile hamburger */}
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h8m-8 6h16"
              />
            </svg>
          </div>
          {user && (
            <ul className="menu menu-sm dropdown-content bg-viva-dark border border-viva-slate/30 z-[1] mt-3 w-52 p-2 rounded-xl shadow-xl">
              <MenuItems />
            </ul>
          )}
        </div>
        <Link to="/" className="flex items-center gap-2 btn btn-ghost hover:bg-white/10">
          <img src="/viva-logo-white.png" alt="VIVA" className="h-6" />
          <span className="text-white/60 text-sm font-light hidden sm:inline">SRS-CMS</span>
        </Link>
      </div>

      {/* Desktop nav */}
      <div className="navbar-center hidden lg:flex">
        {user && (
          <ul className="menu lg:menu-horizontal rounded-box">
            <MenuItems />
          </ul>
        )}
      </div>

      {/* Avatar / user dropdown */}
      <div className="navbar-end">
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle avatar"
          >
            <div className="w-10 rounded-full bg-white/10 ring ring-viva-accent/40 ring-offset-2 ring-offset-viva-navy flex items-center justify-center">
              <span className="text-lg font-semibold text-white">
                {user ? user.username[0].toUpperCase() : "?"}
              </span>
            </div>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content bg-viva-dark border border-viva-slate/30 z-[1] mt-3 w-52 p-2 rounded-xl shadow-xl"
          >
            {user ? (
              <>
                <li className="menu-title">
                  <span className="text-viva-light">{user.username}</span>
                </li>
                <li>
                  <button onClick={logout} className="text-viva-light hover:bg-white/10">Logout</button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/login" className="text-viva-light hover:bg-white/10">Login</Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MenuItems() {
  return (
    <>
      <li>
        <Link to="/dashboard" className="btn btn-ghost text-white/90 hover:text-white hover:bg-white/10 justify-between">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
          Dashboard
        </Link>
      </li>
      <li>
        <Link to="/deaths" className="btn btn-ghost text-white/90 hover:text-white hover:bg-white/10 justify-between">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
          Death Management
        </Link>
      </li>
      <li>
        <Link to="/pregnancy-outcomes" className="btn btn-ghost text-white/90 hover:text-white hover:bg-white/10 justify-between">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
          Pregnancy Outcomes
        </Link>
      </li>
      <li>
        <Link to="/households" className="btn btn-ghost text-white/90 hover:text-white hover:bg-white/10 justify-between">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          Households
        </Link>
      </li>
    </>
  );
}
