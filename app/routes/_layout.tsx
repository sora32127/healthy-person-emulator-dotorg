import { Outlet, useNavigation } from "@remix-run/react";
import { NavLink } from "react-router-dom";
import feedIcon from "~/src/assets/feed_icon.svg";
import guidelineIcon from "~/src/assets/guideline_icon.svg";
import postIcon from "~/src/assets/post_icon.svg";
import searchIcon from "~/src/assets/search_icon.svg";
import menuIcon from "~/src/assets/menu_icon.svg";

export default function Component() {
  const transitionStatus = useNavigation();

  return (
    <div className="flex flex-col min-h-screen">
      {transitionStatus.state === "loading" && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      )}
      <div className="mx-4 mb-32 md:mt-32 md:mx-10 lg:mx-20 xl:mx-40 2xl:mx-60">
        <Outlet />
      </div>
      
      <nav className="fixed py-4 bottom-0 bg-white shadow-inner md:fixed md:top-0 md:w-full w-full md:bottom-auto">
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
              <img src={feedIcon} alt="Feed" className="mx-auto" />
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
              <img src={guidelineIcon} alt="Readme" className="mx-auto" />
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
              <img src={postIcon} alt="Post" className="mx-auto" />
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
              <img src={searchIcon} alt="Search" className="mx-auto" />
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
              <img src={menuIcon} alt="Etc" className="mx-auto" />
              メニュー
            </NavLink>
          </li>
        </ul>
      </nav>
      <footer className="bg-gray-100 py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4">健常者エミュレータ事例集</h2>
            <nav className="mb-4">
              <NavLink
                to="/dummy-contact-url"
                className="text-gray-700 hover:text-blue-500"
              >
                管理人に連絡する
              </NavLink>
            </nav>
            <p className="text-gray-600 text-center">&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}