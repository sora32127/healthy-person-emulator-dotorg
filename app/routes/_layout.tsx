import { Outlet, useLoaderData } from "@remix-run/react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { LoaderFunctionArgs, json } from "@remix-run/node";
import { getSession } from "~/modules/session.server";
import ThemeSwitcher from "~/components/ThemeSwitcher";
import HomeIcon from "~/components/icons/HomeIcon";
import RandomIcon from "~/components/icons/RandomIcon";
import PostIcon from "~/components/icons/PostIcon";
import SearchIcon from "~/components/icons/SearchIcon";
import DonationIcon from "~/components/icons/DonationIcon";
import GuidelineIcon from "~/components/icons/GuidelineIcon";
import LogoutIcon from "~/components/icons/LogoutIcon";
import SignupIcon from "~/components/icons/SignupIcon";
import LoginIcon from "~/components/icons/LoginIcon";
import MenuIcon from "~/components/icons/MenuIcon";
import TopIcon from "~/components/icons/TopIcon";

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
    { to: "/", icon: HomeIcon, text: "トップ" },
    { to: "/random", icon: RandomIcon, text: "ランダム" },
    { to: "/post", icon: PostIcon, text: "投稿する" },
    { to: "/search", icon: SearchIcon, text: "検索する" },
  ];

  const menuItems = [
    { to: "/support", text: "サポートする", icon: DonationIcon },
    { to: "/readme", text: "サイト説明", icon: GuidelineIcon },
    ...(isLoggedIn
      ? [
          { to: "/logout", text: "ログアウト", icon: LogoutIcon },
        ]
      : [
          { to: "/signup", text: "サインアップ", icon: SignupIcon },
          { to: "/login", text: "ログイン", icon: LoginIcon },
        ]),
  ];

  const renderNavItem = (item: { to: string; icon: React.ComponentType; text: string }): JSX.Element => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center text-base-content ${
          isActive ? "text-blue-500 font-bold" : ""
        }`
      }
    >
      <item.icon />
      <p className="text-xs md:text-sm">{item.text}</p>
    </NavLink>
  );

  return (
    <>
    <div className="flex flex-col min-h-screen">
      <div className="mx-4 mb-32 md:mt-32 md:mx-20 lg:mx-40 xl:mx-80 2xl:mx-96">
        <Outlet />
      </div>
      <nav className="fixed py-4 bottom-0 bg-base-100 shadow-inner md:fixed md:top-0 md:w-full w-full md:bottom-auto md:px-10">
        <ul className="flex justify-between items-center mx-4">
          {navItems.map((item) => (
            <li key={item.to}>{renderNavItem(item)}</li>
          ))}
          <li className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex flex-col items-center justify-center hover:text-blue-500"
            >
              <MenuIcon />
              <p className="text-xs">メニュー</p>
            </button>
          </li>
          {menuItems.map((item) => (
            <li key={item.to} className="hidden md:block">
              {renderNavItem(item)}
            </li>
          ))}
          <li className="hidden md:block md:mr-3">
            <ThemeSwitcher />
          </li>
        </ul>
      </nav>
      {isMenuOpen && (
        <div className="fixed inset-0 bg-base-100 z-40 md:hidden">
          <div className="flex justify-between p-4">
            <ThemeSwitcher />
            <button
              onClick={() => setIsMenuOpen(false)}
              className="ml-4"
            >
              閉じる
            </button>
          </div>
          <ul className="mt-8">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-4 py-2 ${
                      isActive ? "text-blue-500 font-bold" : ""
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex">
                  {item.icon()}
                  {item.text}
                  </div>
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
        <TopIcon />
        <div className="flex flex-col space-y-2 ml-2">
          <NavLink
            to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088"
            className="text-base-content"
          >
            管理人に連絡
          </NavLink>
          <NavLink
            to="/readme"
            className="text-base-content"
          >
            サイト説明
          </NavLink>
          <NavLink
            to="/privacyPolicy"
            className="text-base-content"
          >
            プライバシー・ポリシー/免責事項
          </NavLink>
          <NavLink
            to="/support"
            className="text-base-content"
          >
            寄付する
          </NavLink>
        </div>
      </div>
      <p className="text-base-content text-center mt-4 pb-16 mb:pb-0">&copy; {new Date().getFullYear()} All rights reserved.</p>
    </div>
  </footer>
  </>
    
  );
}
