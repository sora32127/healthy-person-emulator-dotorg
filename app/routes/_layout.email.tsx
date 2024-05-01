import { MetaFunction } from "@remix-run/react";
import { H1 } from "~/components/Headings"

export default function Mail() {
    return (
      <div>
        <H1>ユーザー仮登録完了</H1>
        <p>ユーザーの仮登録を完了しました。メールボックスを確認し、本登録を完了させてください。</p>
      </div>
    );
  }

export const meta: MetaFunction = () => {
    const title = "仮登録完了";
    return [{title}]
};