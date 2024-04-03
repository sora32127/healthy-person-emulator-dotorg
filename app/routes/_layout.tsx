import { Outlet, useNavigation } from "@remix-run/react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import feedIcon from "~/src/assets/feed_icon.svg";
import randomIcon from "~/src/assets/random_icon.svg";
import postIcon from "~/src/assets/post_icon.svg";
import searchIcon from "~/src/assets/search_icon.svg";
import menuIcon from "~/src/assets/menu_icon.svg";
import donationIcon from "~/src/assets/donation_icon.svg";
import guidelineIcon from "~/src/assets/guideline_icon.svg";
import loginIcon from "~/src/assets/login_icon.svg";
import logoutIcon from "~/src/assets/logout_icon.svg";
import signupIcon from "~/src/assets/signup_icon.svg";
import mypageIcon from "~/src/assets/mypage_icon.svg";

export default function Component() {
  const transitionStatus = useNavigation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isLoggedIn = true;

  const navItems = [
    { to: "/", icon: feedIcon, text: "フィード" },
    { to: "/random", icon: randomIcon, text: "ランダム" },
    { to: "/post", icon: postIcon, text: "投稿" },
    { to: "/search", icon: searchIcon, text: "検索" },
  ];

  const menuItems = [
    { to: "/beSponsor", text: "寄付する", icon: donationIcon },
    { to: "/readme", text: "ガイドライン", icon: guidelineIcon },
    ...(isLoggedIn
      ? [
          { to: "/mypage", text: "マイページ", icon: mypageIcon },
          { to: "/signout", text: "サインアウト", icon: logoutIcon },
        ]
      : [
          { to: "/signup", text: "サインアップ", icon: signupIcon },
          { to: "/login", text: "ログイン", icon: loginIcon },
        ]),
  ];

  const renderNavItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        `block text-center text-gray-700 hover:text-blue-500 ${
          isActive ? "text-blue-500 font-bold" : ""
        }`
      }
    >
      <img src={item.icon} alt={item.text} className="mx-auto" />
      {item.text}
    </NavLink>
  );

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
          {navItems.map((item) => (
            <li key={item.to}>{renderNavItem(item)}</li>
          ))}
          <li className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="block text-center text-gray-700 hover:text-blue-500"
            >
              <img src={menuIcon} alt="Menu" className="mx-auto" />
              メニュー
            </button>
          </li>
          {menuItems.map((item) => (
            <li key={item.to} className="hidden md:block">
              {renderNavItem(item)}
            </li>
          ))}
        </ul>
      </nav>
      {isMenuOpen && (
        <div className="fixed inset-0 bg-white z-40 md:hidden">
          <button
            onClick={() => setIsMenuOpen(false)}
            className="absolute top-4 right-4 text-gray-700 hover:text-blue-500"
          >
            閉じる
          </button>
          <ul className="mt-16">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-4 py-2 text-gray-700 hover:text-blue-500 ${
                      isActive ? "text-blue-500 font-bold" : ""
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  <img src={item.icon} alt={item.text} className="inline-block mr-2" />
                  {item.text}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
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