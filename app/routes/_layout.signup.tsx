import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { supabase } from "~/modules/supabase.server";

export async function action({request}:ActionFunctionArgs) {
    const form = await request.formData()
    const email = form.get('email')?.toString()
    const password = form.get('password')?.toString()
    const username = form.get('username')?.toString()
    console.log(email, password, username)

    if (!email || !password || !username) {
        return {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Email, password, and username are required'
            })
        }
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.log(error)
    }

    const { user } = data;
    console.log(user)
    console.log(username, password, email)

    if ( user && !error ) {
        const { error } = await supabase.from('profiles').insert([
            { id: user.id, username, email }, { returning: 'minimal'}
        ]);
        if (error) {
            console.log(error)
        }
        return redirect('/email')
    }
    return {}
}

export default function Component() {
    return (
        <div className="flex flex-col items-center justify-center">
            <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
            <form action="/signup" method="post" className="w-64">
                <label className="mb-2">
                    Username:
                    <input type="text" name="username" className="border border-gray-300 rounded-md p-2" />
                </label>
                <label className="mb-2">
                    Email:
                    <input type="email" name="email" className="border border-gray-300 rounded-md p-2" />
                </label>
                <label className="mb-2">
                    Password:
                    <input type="password" name="password" className="border border-gray-300 rounded-md p-2" />
                </label>
                <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded-md">Sign Up</button>
            </form>
        </div>
    )
}
