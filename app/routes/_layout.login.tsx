import { MetaFunction } from "@remix-run/node";
import { SignIn } from "@clerk/remix";

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
    return [
        { title: 'ログイン'}
    ]
}