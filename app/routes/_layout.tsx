import { useCallback, useEffect, useRef, useState } from "react";
import { Form, Outlet, NavLink, useLocation } from "@remix-run/react";
import { useUser, SignOutButton } from "@clerk/remix";
import PostIcon from "~/components/icons/PostIcon";
import SearchIcon from "~/components/icons/SearchIcon";
import LogoutIcon from "~/components/icons/LogoutIcon";
import MenuIcon from "~/components/icons/MenuIcon";
import ThemeSwitcher from "~/components/ThemeSwitcher";
import { Footer } from "~/components/Footer";
import { useAtom } from "jotai";
import { isSignedInAtom, setAuthStateAtom } from "~/stores/auth";
import { getNavItems } from "~/utils/itemMenu";


function renderDesktopHeader(handleSearchModalOpen: (status: boolean) => void){
  const [ isSignedIn ] = useAtom(isSignedInAtom);
  const navItems = getNavItems(isSignedIn);

  return (
    <header className="navbar z-10 border-b p-4 border-base-200 bg-base-100 flex justify-between items-center">
      <div className="flex-none">
        <h1 className="text-lg font-bold">
          <NavLink to="/?referrer=fromHeader">健常者エミュレータ事例集</NavLink>
        </h1>
      </div>
      <div className="flex-1 flex justify-center items-center">
        <ThemeSwitcher />
        <ul className="flex flex-wrap justify-center gap-x-2 gap-y-1 mx-2">
          {navItems.map((item) => (
            <li key={item.to} className="hover:font-bold rounded-lg hover:bg-base-200 py-2">
              {item.to === "/logout" ? (
                <SignOutButton redirectUrl="/">ログアウト</SignOutButton>
              ) : (
                <NavLink to={item.to} className="px-2 py-1 text-sm">{item.text}</NavLink>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-none">
        <div className="tooltip tooltip-bottom" data-tip="検索する">
          <button className="btn btn-ghost" onClick={() => {
            handleSearchModalOpen(true);
          }} type="button">
            {"Ctrl+kで検索"}
            <SearchIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

function renderMobileHeader(handleSearchModalOpen: (status: boolean) => void){
  const [ isSignedIn ] = useAtom(isSignedInAtom);
  const navItems = getNavItems(isSignedIn);

  return (
    <header className="navbar fixed z-40 border-b border-base-200 bg-base-100 flex justify-between p-4">
      <div>
        <h1 className="text-xl font-bold">
          <NavLink to="/?referrer=fromHeader">健常者エミュレータ事例集</NavLink>
        </h1>
      </div>
      <div className="flex flex-row">
        <div className="tooltip tooltip-left" data-tip="検索する">
          <button className="btn btn-ghost" onClick={() => {handleSearchModalOpen(true)}} type="button">
            <SearchIcon />
          </button>
        </div>
        <div>
          <div className="drawer drawer-end">
            <input id="drawer-toggle" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex justify-end">
            <label htmlFor="drawer-toggle" className="btn btn-ghost">
              <MenuIcon />
            </label>
          </div>
          <div className="drawer-side">
            <label htmlFor="drawer-toggle" className="drawer-overlay"/>
            <div className="bg-base-200">
              <button
                className="btn btn-ghost absolute right-4 top-2"
                type="button"
                onClick={() => {
                  document.getElementById('drawer-toggle')?.click();
                }}
              >
                ✕
              </button>
              <div className="mt-3 ml-2">
                <ThemeSwitcher />
              </div>
              <ul className="p-4 w-50 text-base-content min-h-screen py-1 flex flex-col">
                {navItems.map((item) => (
                  <li key={item.to} className="justify-center">
                    {item.to === "/logout" ? (
                      <div
                        onClick={() => {
                          document.getElementById('drawer-toggle')?.click();
                          }}
                          className="flex gap-x-3 my-3 hover:bg-base-200 rounded-lg p-2 cursor-pointer"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              document.getElementById('drawer-toggle')?.click();
                            }
                          }}
                        > 
                          <LogoutIcon/>
                          <SignOutButton redirectUrl="/">
                            ログアウト
                          </SignOutButton>
                        </div>
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
    </div>
  </header>
  )
}


export default function Component() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const user = useUser();
  const [ _, setAuthState ] = useAtom(setAuthStateAtom);
  
  useEffect(() => {
    if (user.isSignedIn) {
      const newAuthState = {
        isSignedIn: user.isSignedIn ?? false,
        userId: user.user?.id ?? null,
        email: user.user?.emailAddresses[0]?.emailAddress ?? null,
        userName: user.user?.username ?? null,
      };
      setAuthState(newAuthState);
    }
  }, [user.isSignedIn, setAuthState, user.user?.id, user.user?.emailAddresses, user.user?.username]);


  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const handleSearchModalOpen = useCallback((status: boolean) => {
    setIsSearchModalOpen(status);
  }, []);

  useEffect(()=> {
    if (isSearchModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    return () => {
      if (searchInputRef.current) {
        // フォーカスを解除する
        searchInputRef.current.blur();
      }
    }
  }, [isSearchModalOpen]);

  useEffect(()=> {
    const handleKeyDownForSearch = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "k") {
        event.preventDefault();
        handleSearchModalOpen(true);
      }
      if (event.key === "Escape") {
        handleSearchModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDownForSearch);
    return () => window.removeEventListener('keydown', handleKeyDownForSearch);
  }, [handleSearchModalOpen]);

  const location = useLocation();
  const isInPostPage = location.pathname === "/post";


  return (
    <div className="grid grid-cols-1 min-h-screen">
      <div className="hidden md:block">
        {renderDesktopHeader(handleSearchModalOpen)}
      </div>
      <div className="block md:hidden">
        {renderMobileHeader(handleSearchModalOpen)}
      </div>
      <dialog id="search-modal" className={`modal ${isSearchModalOpen ? "modal-open" : ""}`}>
      <div className="modal-box absolute top-[25%] transform -translate-y-1/2">
        <div className="mt-6">
          <Form method="post" action="/search" className="flex flex-row" onSubmit={() => {
            handleSearchModalOpen(false);
          }}>
            <input
              type="text"
              name="query"
              placeholder="検索する..."
              className="input input-bordered w-full placeholder-slate-500"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary ml-4" onSubmit={() => {
              handleSearchModalOpen(false);
              setSearchQuery("");
            }}>
              <SearchIcon />
            </button>
            <input type="hidden" name="action" value="firstSearch" />
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => {
              handleSearchModalOpen(false);
            }}>✕</button>
          </Form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={() => {
          handleSearchModalOpen(false);
        }}>閉じる</button>
      </form>
    </dialog>
      <main className="p-4 xl:mx-10 2xl:mx-96">
        <div>
          <Outlet />
        </div>
      </main>
      <div className="tooltip tooltip-top fixed bottom-10 right-10" data-tip="投稿する">
        <NavLink to="/post">
          <button className={`btn btn-primary btn-circle btn-lg ${isInPostPage ? "hidden inert" : ""}`} type="button">
            <PostIcon />
          </button>
        </NavLink>
      </div>
      <Footer />
    </div>
  );
}