import { NavLink } from '@remix-run/react';
import { H1 } from '~/components/Headings';

export default function UserVerified() {
  return (
    <div>
      <H1>ユーザー本登録完了</H1>
      <div className="text-center">
        <p>ユーザーの本登録が完了しました。</p>
        <NavLink to="/login" className="text-info underline underline-offset-4">
          ログインページへ移動
        </NavLink>
      </div>
    </div>
  );
}
