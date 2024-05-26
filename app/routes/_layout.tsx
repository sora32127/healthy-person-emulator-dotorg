import { Form, Outlet, useLoaderData } from "@remix-run/react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
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
import ThumbsUpIcon from "~/components/icons/ThumbsUpIcon";

export async function loader({ request }: LoaderFunctionArgs) {
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
  const [menuAnimation, setMenuAnimation] = useState("");
  const { isLoggedIn } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (isMenuOpen) {
      setMenuAnimation("animate-slideIn");
    } else if (menuAnimation === "animate-slideIn") {
      setMenuAnimation("animate-slideOut");
    }
  }, [isMenuOpen, menuAnimation]);

  const navItems = [
    { to: "/", icon: HomeIcon, text: "トップ" },
    { to: "/random", icon: RandomIcon, text: "ランダム" },
    { to: "/post", icon: PostIcon, text: "投稿する" },
    { to: "/search", icon: SearchIcon, text: "検索する" },
  ];

  const menuItems = [
    { to: "/support", text: "サポートする", icon: DonationIcon },
    { to: "/readme", text: "サイト説明", icon: GuidelineIcon },
    { to: "/feed?p=1&type=unboundedLikes", text: "無期限いいね順", icon: ThumbsUpIcon },
    ...(isLoggedIn
      ? [{ to: "/logout", text: "ログアウト", icon: LogoutIcon }]
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
        `flex items-center md:items-start md:flex-row flex-col text-base-content hover:text-blue-600 md:ml-4 ${
          isActive ? "text-info font-bold" : ""
        }`
      }
    >
      <item.icon />
      <p className="text-xs md:text-sm md:ml-4">{item.text}</p>
    </NavLink>
  );

  return (
    <>
    <header className="fixed top-0 w-full bg-base-100 shadow z-10 flex justify-between items-center p-4">
      <div className="flex flex-row items-center space-x-4">
        <h1 className="text-xl font-bold">
          <div className="hidden md:block"><NavLink to="/">健常者エミュレータ事例集</NavLink></div>
          <div className="block md:hidden"><NavLink to="/">健エミュ</NavLink></div>
        </h1>
        <Form method="post" action="/search">
        <div className="flex flex-row items-center">
          <input type="text" placeholder="検索" className="input input-bordered w-40 md:w-64 p-2 rounded-lg" name="query"/>
          <button className="btn btn-square btn-ghost ml-2">
          <SearchIcon/> 
          </button>
        </div>
        <input type="hidden" name="action" value="firstSearch"/>
        </Form>
      </div>
      <ThemeSwitcher />
    </header>
    <div className="flex min-h-screen pt-16">
      <nav className="hidden md:flex flex-col fixed top-0 bottom-0 w-64 p-4 bg-base-100 mt-16">
        <ul className="space-y-4">
          {navItems.map((item) => (
            <li key={item.to}>{renderNavItem(item)}</li>
          ))}
          {menuItems.map((item) => (
            <li key={item.to}>{renderNavItem(item)}</li>
          ))}
        </ul>
      </nav>
      <div className="flex-1 p-4 ml-0 md:mx-64">
        <div className="mb-32 md:mb-0">
          <Outlet />
        </div>
      </div>
    </div>
    <nav className="fixed py-4 bottom-0 bg-base-100 shadow-inner w-full md:hidden">
      <ul className="flex justify-between items-center mx-4">
        {navItems.map((item) => (
          <li key={item.to}>{renderNavItem(item)}</li>
        ))}
        <li>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col items-center justify-center hover:text-blue-600"
          >
            <MenuIcon />
            <p className="text-xs">メニュー</p>
          </button>
        </li>
      </ul>
      {(isMenuOpen || menuAnimation === "animate-slideOut") && (
        <div
          className={`fixed bottom-20 left-0 right-0 top-64 bg-base-100 border-t-2 border-neutral transition-transform duration-300 ease-out ${
            menuAnimation
          }`}
          onAnimationEnd={() => {
            if (menuAnimation === "animate-slideOut") {
              setMenuAnimation("");
            }
          }}
        >
          <div className="flex justify-between p-4">
            <button onClick={() => setIsMenuOpen(false)} className="ml-2 btn btn-neutral">
              閉じる
            </button>
          </div>
          <ul className="mt-8 mx-4">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-4 py-4 border-b-2 border-neutral ${isActive ? "text-info font-bold" : ""}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon />
                    <span>{item.text}</span>
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
    <footer className="bg-base-100 py-8 md:pb-0">
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center">
          <TopIcon />
          <div className="flex flex-col space-y-2 ml-2">
            <NavLink to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088" className="text-base-content">
              管理人に連絡
            </NavLink>
            <NavLink to="/readme" className="text-base-content">
              サイト説明
            </NavLink>
            <NavLink to="/privacyPolicy" className="text-base-content">
              プライバシー・ポリシー/免責事項
            </NavLink>
            <NavLink to="/support" className="text-base-content">
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
