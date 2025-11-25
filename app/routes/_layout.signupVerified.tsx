import { NavLink } from '@remix-run/react';
import { H1 } from '~/components/Headings';

export default function SignupVerified() {
  return (
    <div>
      <H1>ユーザー登録が完了しました</H1>
      <ul>
        <li>
          <NavLink
            to="/login"
            className="text-info underline underline-offset-4"
          >
            ログイン
          </NavLink>
          してください
        </li>
      </ul>
    </div>
  );
}
