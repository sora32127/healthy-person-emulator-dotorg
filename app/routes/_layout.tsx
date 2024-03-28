import { Outlet, useNavigation } from "@remix-run/react";
import { NavLink } from "react-router-dom";

export default function Component() {
  const transitionStatus = useNavigation();

  return (
    <div className="flex flex-col min-h-screen px-4">
      {transitionStatus.state === "loading" && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      )}
      <div className="md:mt-32 md:mx-auto">
        <Outlet />
      </div>
        <nav className="mx-auto px-4 py-4 bg-white shadow-inner mt-auto md:fixed md:top-0 md:w-full w-full">
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
                <img src="/src/assets/feed_icon.svg" alt="Feed" className="mx-auto" />
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
                <img src="/src/assets/guideline_icon.svg" alt="Readme" className="mx-auto" />
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
                <img src="/src/assets/post_icon.svg" alt="Post" className="mx-auto" />
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
                <img src="/src/assets/search_icon.svg" alt="Search" className="mx-auto" />
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
                <img src="/src/assets/menu_icon.svg" alt="Etc" className="mx-auto" />
                メニュー
              </NavLink>
            </li>
          </ul>
        </nav>
    </div>
  );
}