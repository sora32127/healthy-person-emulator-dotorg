import { MetaFunction } from "@remix-run/node";
import { SignUp } from "@clerk/remix";

export default function Component() {
  return (
    <div 
      className="flex justify-center align-center md:mt-32 mt-16"
    >
      <SignUp/>
    </div>
  );
}

export const meta : MetaFunction = () => {
  return [
      { title: 'サインアップ'}
  ]
}