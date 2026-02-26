import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <div className="navbar glass-nav">
      <div className="navbar-start">
        {/* Mobile hamburger */}
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
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
            <ul className="menu menu-sm dropdown-content glass-card z-[1] mt-3 w-52 p-2">
              <MenuItems />
            </ul>
          )}
        </div>
        <Link to="/" className="btn btn-ghost text-xl font-bold text-slate-800">
          SRS-CMS
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
            <div className="w-10 rounded-full bg-primary/10 ring ring-primary/30 ring-offset-2 ring-offset-white/50 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {user ? user.username[0].toUpperCase() : "?"}
              </span>
            </div>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content glass-card z-[1] mt-3 w-52 p-2"
          >
            {user ? (
              <>
                <li className="menu-title">
                  <span>{user.username}</span>
                </li>
                <li>
                  <button onClick={logout}>Logout</button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/login">Login</Link>
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
        <Link to="/deaths" className="btn btn-ghost justify-between">
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
        <Link to="/pregnancy-outcomes" className="btn btn-ghost justify-between">
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
    </>
  );
}
