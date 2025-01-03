import { House, Search, HandCoins, BookText, ThumbsUp, Notebook, Shuffle, LogOut, LogIn, UserPlus, FilePlus } from 'lucide-react';

export function getNavItems(isSignedIn: boolean){
    return [
        { to: "/?referrer=fromMenu", icon: House, text: "トップ" },
        { to: "/?tab=fixed", text: "固定ページ", icon: Notebook },
        { to: "/?tab=random", text: "ランダム", icon: Shuffle },
        { to: "/support", text: "サポートする", icon: HandCoins },
        { to: "/readme", text: "サイト説明", icon: BookText },
        { to: "/feed?p=1&type=unboundedLikes", text: "無期限いいね順", icon: ThumbsUp },
        { to: "/search", icon: Search, text: "検索する" },
        { to: "/post", text: "投稿する", icon: FilePlus },

        ...(isSignedIn
          ? [{ to: "/logout", text: "ログアウト", icon: LogOut }]
          : [
              { to: "/signup", text: "サインアップ", icon: UserPlus },
              { to: "/login", text: "ログイン", icon: LogIn },
            ]),
    ]
}