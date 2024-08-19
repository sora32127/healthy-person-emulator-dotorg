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
import TopIcon from "~/components/icons/TopIcon";
import ThumbsUpIcon from "~/components/icons/ThumbsUpIcon";
import { useUser, SignOutButton } from "@clerk/remix";
import { MdOutlinePostAdd, MdSearch, MdMenu } from "react-icons/md";
import { useEffect } from "react";

function getNavItems(isSignedIn: boolean){
  const items = [
    { to: "/", icon: HomeIcon, text: "トップ" },
    { to: "/random", icon: RandomIcon, text: "ランダム" },
    { to: "/post", icon: PostIcon, text: "投稿する" },
    { to: "/search", icon: SearchIcon, text: "検索する" },
    { to: "/support", text: "サポートする", icon: DonationIcon },
    { to: "/readme", text: "サイト説明", icon: GuidelineIcon },
    { to: "/feed?p=1&type=unboundedLikes", text: "無期限いいね順", icon: ThumbsUpIcon },
    ...(isSignedIn
      ? [{ to: "/logout", text: "ログアウト", icon: LogoutIcon }]
      : [
          { to: "/signup", text: "サインアップ", icon: SignupIcon },
          { to: "/login", text: "ログイン", icon: LoginIcon },
        ]),
  ];
  return items;
}

function renderSearchModal(){
  return (
    <dialog id="search-modal" className="modal">
    <div className="modal-box">
      <div className="mt-6">
        <Form method="post" action="/search" className="flex flex-row" onSubmit={() => {
          const searchModal = document?.getElementById('search-modal') as HTMLDialogElement;
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
  )
}

function renderDesktopHeader(navItems: ReturnType<typeof getNavItems>){
  return (
    <header className="navbar z-10 border-b p-4 border-base-200 bg-base-100 grid grid-cols-[2fr,10fr,1fr]">
    <div>
      <h1 className="text-lg font-bold">
        <NavLink to="/">健常者エミュレータ事例集</NavLink>
      </h1>
    </div>
    <div className="flex justify-center">
      <ThemeSwitcher />
      <ul className="flex gap-x-4">
        {navItems.map((item) => (
          <li key={item.to} className="hover:font-bold rounded-lg">
            {item.to === "/logout" ? (
              <SignOutButton redirectUrl="/">ログアウト</SignOutButton>
            ) : (
              <NavLink to={item.to}>{item.text}</NavLink>
            )}
          </li>
        ))}
      </ul>
    </div>
    <div className="flex justify-end">
      <div className="tooltip tooltip-bottom" data-tip="検索する">
        <button className="btn btn-ghost" onClick={() => {
          const searchModal = document?.getElementById('search-modal') as HTMLDialogElement;
          searchModal?.showModal();
        }} type="button">
          <MdSearch />
        </button>
        {renderSearchModal()}
      </div>
    </div>
  </header>
);
}

function renderMobileHeader(navItems: ReturnType<typeof getNavItems>){
  return (
    <header className="navbar fixed z-10 border-b p-4 border-base-200 bg-base-100 grid grid-cols-2">
    <div>
      <h1 className="text-xl font-bold">
        <NavLink to="/">健エミュ</NavLink>
      </h1>
    </div>
    <div>
      <div className="drawer drawer-end">
        <input id="drawer-toggle" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex justify-end">
          <label htmlFor="drawer-toggle" className="btn btn-ghost">
            <MdMenu />
          </label>
        </div>
        <div className="drawer-side">
          <label htmlFor="drawer-toggle" className="drawer-overlay"/>
          <div className="bg-base-100">
            <button
              className="btn btn-ghost absolute right-4 top-2"
              type="button"
              onClick={() => {
                document.getElementById('drawer-toggle')?.click();
              }}
            >
              ✕
            </button>
            <div className="mt-2">
              <ThemeSwitcher />
            </div>
            <ul className="p-4 w-50 text-base-content min-h-screen py-24 flex flex-col">
              {navItems.map((item) => (
                <li key={item.to} className="justify-center">
                  {item.to === "/logout" ? (
                    <button onClick={() => {
                      document.getElementById('drawer-toggle')?.click();
                    }}
                    className="flex gap-x-3 my-3 hover:bg-base-200 rounded-lg p-2"
                    type="button"
                    >
                      <LogoutIcon/>
                      <SignOutButton redirectUrl="/">
                        {"ログアウト"}
                      </SignOutButton>
                    </button>
                  ) : (
                    <NavLink to={item.to} onClick={() => {
                      document.getElementById('drawer-toggle')?.click();
                    }}
                    className="flex gap-x-3 my-3 hover:bg-base-200 rounded-lg p-2"
                    >
                      <item.icon />
                      {item.text}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </header>
  )
}


export default function Component() {
  const { isSignedIn } = useUser();
  const navItems = getNavItems(isSignedIn ?? false);

  useEffect(()=> {
    const searchModal = document?.getElementById('search-modal') as HTMLDialogElement;
    const handleKeyDownForSearch = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "f") {
        event.preventDefault();
        searchModal?.showModal();
      }
    }
    window.addEventListener('keydown', handleKeyDownForSearch);
    return () => window.removeEventListener('keydown', handleKeyDownForSearch);
  }, []);

  return (
    <div className="grid grid-cols-1 min-h-screen">
      <div className="hidden md:block">
        {renderDesktopHeader(navItems)}
      </div>
      <div className="block md:hidden">
        {renderMobileHeader(navItems)}
      </div>
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