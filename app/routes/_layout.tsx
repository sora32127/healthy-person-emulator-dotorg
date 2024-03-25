import { Outlet } from "@remix-run/react";
import { NavLink } from "react-router-dom";

export default function Component() {
  return (
    <div className="flex flex-col min-h-screen px-4">
      <Outlet/>
      <footer className="bg-white shadow-inner mt-auto fixed bottom-0 w-full">
        <nav className="mx-auto px-4 py-4">
          <ul className="flex justify-around">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `block text-center text-gray-700 hover:text-blue-500 ${
                    isActive ? "text-blue-500 font-bold" : ""
                  }`
                }
              >
                フィード
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/readme"
                className={({ isActive }) =>
                  `block text-center text-gray-700 hover:text-blue-500 ${
                    isActive ? "text-blue-500 font-bold" : ""
                  }`
                }
              >
                ガイドライン
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/post"
                className={({ isActive }) =>
                  `block text-center text-gray-700 hover:text-blue-500 ${
                    isActive ? "text-blue-500 font-bold" : ""
                  }`
                }
              >
                投稿
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `block text-center text-gray-700 hover:text-blue-500 ${
                    isActive ? "text-blue-500 font-bold" : ""
                  }`
                }
              >
                検索
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/etc"
                className={({ isActive }) =>
                  `block text-center text-gray-700 hover:text-blue-500 ${
                    isActive ? "text-blue-500 font-bold" : ""
                  }`
                }
              >
                そのほか
              </NavLink>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
  );
}