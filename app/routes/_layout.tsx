import { Outlet, useLoaderData } from "@remix-run/react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import homeIcon from "~/src/assets/home_icon.svg";
import randomIcon from "~/src/assets/random_icon.svg";
import postIcon from "~/src/assets/post_icon.svg";
import searchIcon from "~/src/assets/search_icon.svg";
import menuIcon from "~/src/assets/menu_icon.svg";
import donationIcon from "~/src/assets/donation_icon.svg";
import guidelineIcon from "~/src/assets/guideline_icon.svg";
import loginIcon from "~/src/assets/login_icon.svg";
import logoutIcon from "~/src/assets/logout_icon.svg";
import signupIcon from "~/src/assets/signup_icon.svg";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { getSession } from "~/modules/session.server";
import topLogo from "~/src/assets/top_logo.svg";

export async function loader({ request }: LoaderFunctionArgs){
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (userId) {
    return json({ isLoggedIn: true });
  } else {
    return json({ isLoggedIn: false });
  }
}

export default function Component() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isLoggedIn } = useLoaderData<typeof loader>();

  const navItems = [
    { to: "/", icon: homeIcon, text: "トップ" },
    { to: "/random", icon: randomIcon, text: "ランダム" },
    { to: "/post", icon: postIcon, text: "投稿する" },
    { to: "/search", icon: searchIcon, text: "検索する" },
  ];

  const menuItems = [
    { to: "/support", text: "サポートする", icon: donationIcon },
    { to: "/readme", text: "サイト説明", icon: guidelineIcon },
    ...(isLoggedIn
      ? [
          { to: "/logout", text: "ログアウト", icon: logoutIcon },
        ]
      : [
          { to: "/signup", text: "サインアップ", icon: signupIcon },
          { to: "/login", text: "ログイン", icon: loginIcon },
        ]),
  ];

  const renderNavItem = (item: { to: string; icon: string; text: string }): JSX.Element => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center text-gray-700 hover:text-blue-500 ${
          isActive ? "text-blue-500 font-bold" : ""
        }`
      }
    >
      <img src={item.icon} alt={item.text} className="w-6 h-6 md:w-8 md:h-8 mx-8" />
      <p className="text-xs md:text-sm">{item.text}</p>
    </NavLink>
  );

  return (
    <>
    <div className="flex flex-col min-h-screen">
      <div className="mx-4 mb-32 md:mt-32 md:mx-20 lg:mx-40 xl:mx-80 2xl:mx-96">
        <Outlet />
      </div>
      <nav className="fixed py-4 bottom-0 bg-base-100 shadow-inner md:fixed md:top-0 md:w-full w-full md:bottom-auto">
        <ul className="flex justify-between">
          {navItems.map((item) => (
            <li key={item.to}>{renderNavItem(item)}</li>
          ))}
          <li className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex flex-col items-center justify-center text-gray-700 hover:text-blue-500"
            >
              <img src={menuIcon} alt="Menu" className="w-6 h-6 mx-8" />
              <p className="text-xs">メニュー</p>
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
                  <img src={item.icon} alt={item.text} className="inline-block mr-2 w-6 h-6" />
                  {item.text}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    <footer className="bg-base-100 py-8 md:pb-0">
    <div className="container mx-auto px-4">
      <div className="flex justify-center items-center">
        <img src={topLogo} alt="Top Logo" className="h-auto w-48 mr-2" />
        <div className="flex flex-col space-y-2 ml-2">
          <NavLink
            to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088"
            className="text-gray-700 hover:text-blue-500"
          >
            管理人に連絡
          </NavLink>
          <NavLink
            to="/readme"
            className="text-gray-700 hover:text-blue-500"
          >
            サイト説明
          </NavLink>
          <NavLink
            to="/privacyPolicy"
            className="text-gray-700 hover:text-blue-500"
          >
            プライバシー・ポリシー/免責事項
          </NavLink>
          <NavLink
            to="/support"
            className="text-gray-700 hover:text-blue-500"
          >
            寄付する
          </NavLink>
        </div>
      </div>
      <p className="text-gray-600 text-center mt-4 pb-16 mb:pb-0">&copy; {new Date().getFullYear()} All rights reserved.</p>
    </div>
  </footer>
  </>
    
  );
}
