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
import { MdOutlinePostAdd, MdSearch } from "react-icons/md";
import { H3 } from "~/components/Headings";
import { useEffect } from "react";

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
          <button className="flex items-center md:items-start md:flex-row flex-col text-base-content md:hover:bg-base-200 md:py-2 md:pr-4 md:pl-3 rounded md:ml-4 w-fit" type="button">
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

  const searchModal = document.getElementById('search-modal') as HTMLDialogElement;

  useEffect(()=> {
    const handleKeyDownForSearch = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "f") {
        event.preventDefault();
        searchModal?.showModal();
      }
    }
    window.addEventListener('keydown', handleKeyDownForSearch);
    return () => window.removeEventListener('keydown', handleKeyDownForSearch);
  }, [searchModal]);

  return (
    <div className="grid grid-cols-1 min-h-screen">
      <header className="navbar fixed z-10 border-b p-4 border-base-200  bg-base-100 grid grid-cols-[1fr,2fr,1fr]">
        <div>
          <h1 className="text-xl font-bold hidden md:block">
            <NavLink to="/">健常者エミュレータ事例集</NavLink>
          </h1>
          <h1 className="text-xl font-bold block md:hidden">
            <NavLink to="/">健エミュ</NavLink>
          </h1>
        </div>
        <div className="hidden md:flex md:justify-center">
          <ThemeSwitcher />
        </div>
        <div className="flex justify-end" >
          <div className="tooltip tooltip-bottom" data-tip="検索する">
            <button className="btn btn-ghost" onClick={()=>searchModal?.showModal()} type="button">
              <MdSearch />
            </button>
            <dialog id="search-modal" className="modal">
              <div className="modal-box">
                <div className="mt-6">
                  <Form method="post" action="/search" className="flex flex-row" onSubmit={()=>{
                    searchModal?.close();
                  }}>
                    <input type="text" name="query" placeholder="検索する..." className="input input-bordered w-full placeholder-slate-500"/>
                      <button type="submit" className="btn btn-primary ml-4">
                        <MdSearch />
                      </button>
                    <input type="hidden" name="action" value="firstSearch" />
                    <form method="dialog">
                      <button type="submit" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                  </Form>
                </div>
              </div>
              <form method="dialog" className="modal-backdrop">
                <button type="submit">閉じる</button>
              </form>
            </dialog>
          </div>
        </div>
      </header>
      <main className="p-4 xl:mx-10 2xl:mx-96 overflow-x-hidden">
        <div className="pt-16">
          <Outlet />
        </div>
      </main>
      <div className="tooltip tooltip-top fixed bottom-10 right-10" data-tip="投稿する">
        <NavLink to="/post">
          <button className="btn btn-primary btn-circle" type="button">
            <MdOutlinePostAdd className="text-4xl" />
          </button>
        </NavLink>
      </div>
      <footer className="bg-base-100 py-8 md:py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center">
            <TopIcon />
            <div className="flex flex-col space-y-2 ml-2">
              <NavLink to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088" className="text-base-content">管理人に連絡</NavLink>
              <NavLink to="/readme" className="text-base-content">サイト説明</NavLink>
              <NavLink to="/privacyPolicy" className="text-base-content">プライバシー・ポリシー/免責事項</NavLink>
              <NavLink to="/support" className="text-base-content">寄付する</NavLink>
            </div>
          </div>
          <p className="text-base-content text-center mt-4 pb-16 md:pb-0">&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}