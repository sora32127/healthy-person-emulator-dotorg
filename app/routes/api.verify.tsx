import { ActionFunctionArgs } from "@remix-run/node"

const CF_TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const CF_TURNSTILE_SECRET_KEY = process.env.CF_TURNSTILE_SECRET_KEY

export async function action({ request }: ActionFunctionArgs){
    const formData = await request.formData();
    const token = formData.get('cf-turnstile-response') as string;
    if (!token || !CF_TURNSTILE_SECRET_KEY) {
        return new Response(JSON.stringify({ success: false, message: 'Invalid request' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
        })
    }

    const res = await fetch(CF_TURNSTILE_VERIFY_ENDPOINT, {
      method: 'POST',
      body: `secret=${encodeURIComponent(CF_TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
  
    const data = await res.json()
  
    return new Response(JSON.stringify(data), {
      status: data.success ? 200 : 400,
      headers: {
        'content-type': 'application/json'
      }
    })

}