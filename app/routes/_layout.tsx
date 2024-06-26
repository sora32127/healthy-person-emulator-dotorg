import { Form, Outlet } from "@remix-run/react";
import { NavLink } from "react-router-dom";
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
import { useUser, SignOutButton } from "@clerk/remix";

export default function Component() {
  const { isSignedIn } = useUser();

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
    ...(isSignedIn
      ? [{
          to: "#",
          text: "ログアウト",
          icon: LogoutIcon,
        }]
      : [
          { to: "/signup", text: "サインアップ", icon: SignupIcon },
          { to: "/login", text: "ログイン", icon: LoginIcon },
        ]),
  ];

  const renderNavItem = (item: { to: string; icon: React.ComponentType; text: string; onClick?: () => void }): JSX.Element => {
    const content = (
      <>
        <item.icon />
        <p className="text-xs md:text-sm md:ml-4">{item.text}</p>
      </>
    );

    if (item.text === "ログアウト") {
      return (
        <SignOutButton redirectUrl="/">
          <button className="flex items-center md:items-start md:flex-row flex-col text-base-content md:hover:bg-base-200 md:py-2 md:pr-4 md:pl-3 rounded md:ml-4 w-fit">
            {content}
          </button>
        </SignOutButton>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          `flex items-center md:items-start md:flex-row flex-col text-base-content md:hover:bg-base-200 md:py-2 md:pr-4 md:pl-3 rounded md:ml-4 w-fit ${
            isActive ? "font-bold md:bg-base-300" : ""
          }`
        }
      >
        {content}
      </NavLink>
    );
  };

  return (
    <>
    <header className="fixed top-0 w-full bg-base-100 shadow z-10 flex justify-between items-center p-4">
      <div className="flex flex-row items-center space-x-4">
        <h1 className="text-xl font-bold">
          <div className="hidden md:block"><NavLink to="/">健常者エミュレータ事例集</NavLink></div>
        </h1>
        <Form method="post" action="/search">
        <div className="flex flex-row items-center">
          <input type="text" placeholder="検索" className="input input-bordered w-40 md:w-64 p-2 rounded-lg" name="query"/>
          <button className="btn btn-square btn-ghost ml-2" title="search">
          <SearchIcon/> 
          </button>
        </div>
        <input type="hidden" name="action" value="firstSearch"/>
        </Form>
      </div>
      <ThemeSwitcher />
    </header>
    <div className="flex min-h-screen pt-16">
      <nav className="hidden md:flex flex-col fixed top-0 bottom-0 w-64 p-4 bg-base-100 mt-32 border-r border-neutral">
        <ul className="space-y-4">
        {navItems.map((item) => item.to !== "/post" ? (
          <li key={item.to}>{renderNavItem(item)}</li>
          ) : null)}
        {menuItems.map((item) => (
          <li key={item.to}>{renderNavItem(item)}</li>
        ))}
          <li>
            <NavLink
              to="/post"
              className="flex flex-col md:flex-row items-center bg-[#99D9EA] hover:bg-teal-100 text-slate-950 px-4 mx-4 py-4 mt-20 rounded-full"
            >
              <PostIcon />
              <p className="text-xs px-4 font-bold">投稿する</p>
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="flex-1 p-4 ml-0 md:ml-64 md:mr-16 lg:ml-64 lg:mr-32 xl:ml-96 xl:mr-96">
        <div className="mb-32 md:mb-0">
          <Outlet />
        </div>
      </div>
    </div>
    <nav className="fixed py-4 bottom-0 bg-base-100 shadow-inner w-full md:hidden">
      <ul className="flex justify-between items-center mx-4">
        {navItems.map(item => (
          <li key={item.to}>
            {item.to === "/post" ? (
              <NavLink
                to="/post"
                className="flex flex-col items-center btn-primary px-2 py-2 rounded-3xl"
              >
                <PostIcon />
                <p className="text-xs font-bold">投稿する</p>
              </NavLink>
            ) : (
              renderNavItem(item)
            )}
          </li>
        ))}
        <li>
          <div className="drawer">
            <input id="menu-drawer" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content flex flex-col items-center">
              <MenuIcon />
              <label htmlFor="menu-drawer" className="drawer-overlay">
                メニュー
              </label>
            </div>
            <div className="drawer-side">
              <label
                htmlFor="menu-drawer"
                aria-label="close sidebar"
                className="drawer-overlay"
              ></label>
              <ul className="menu pt-32 w-80 min-h-full bg-base-100 text-base-content">
                {menuItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className="flex items-center p-2 rounded"
                      onClick={() => document.getElementById("menu-drawer")?.click()}
                    >
                      <item.icon />
                      <p className="ml-2">{item.text}</p>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </li>
      </ul>
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
