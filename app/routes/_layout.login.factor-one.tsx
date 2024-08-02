import { NavLink } from "@remix-run/react";
import { H1 } from "~/components/Headings";

export default function LoginFall(){
    return (
        <div>
            <H1>ログインに失敗しました</H1>
            <ul>
                <li>まだユーザー登録を行っていないかもしれません。<NavLink to="/signup">ユーザー登録</NavLink>を試してください</li>
                <li>問題が解決しない場合、<NavLink to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088">管理人のTwitter</NavLink>か<NavLink to="https://discord.com/invite/sQehNGTnSg">Discord</NavLink>までご連絡ください</li>
            </ul>
        </div>
    )
}