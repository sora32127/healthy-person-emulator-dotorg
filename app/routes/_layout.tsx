import { Outlet, useNavigation } from "@remix-run/react";
import { NavLink } from "react-router-dom";

export default function Component() {
  const transitionStatus = useNavigation();

  return (
    <div className="flex flex-col min-h-screen px-4">
      {transitionStatus.state === "loading" && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-solid rounded-full animate-spin">
        </div>
        </div>
      )}
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