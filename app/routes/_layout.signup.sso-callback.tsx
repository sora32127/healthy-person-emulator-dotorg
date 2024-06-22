import { NavLink } from "@remix-run/react";
import { H1 } from "~/components/Headings";

export default function SignUpFall(){
    return (
        <div>
            <H1>ユーザー登録に失敗しました</H1>
            <ul>
                <li>すでにユーザー登録を行っているかもしれません。<NavLink to="/login">ログイン</NavLink>を試してください</li>
                <li>問題が解決しない場合、<NavLink to="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088">管理人のTwitter</NavLink>か<NavLink to="https://discord.com/invite/sQehNGTnSg">Discord</NavLink>までご連絡ください</li>
            </ul>
        </div>
    )
}