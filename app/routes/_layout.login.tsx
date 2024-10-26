import type { MetaFunction } from "@remix-run/node";
import { SignIn } from "@clerk/remix";
import { commonMetaFunction } from "~/utils/commonMetafunction";

export default function login() {
    return (
      <div 
        className="flex justify-center align-center md:mt-32 mt-16"
      >
        <SignIn/>
      </div>
    );
  }
  
export const meta : MetaFunction = () => {
    const commonMeta = commonMetaFunction({
        title: "ログイン",
        description: "ログインして編集しよう",
        url: "https://healthy-person-emulator.org/login",
        image: null
    });
    return commonMeta;
}