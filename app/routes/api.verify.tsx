import { type ActionFunctionArgs, json } from "@remix-run/node"

const CF_TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const CF_TURNSTILE_SECRET_KEY = process.env.CF_TURNSTILE_SECRET_KEY;

export async function action({ request }: ActionFunctionArgs){
    const formData = await request.formData();
    const token = formData.get('cf-turnstile-response')?.toString() || "";
    
    console.log("token", token);
    console.log("CF_TURNSTILE_SECRET_KEY", CF_TURNSTILE_SECRET_KEY);


    if (!token || !CF_TURNSTILE_SECRET_KEY) {
      console.log('Invalid request. Missing token or secret key.')
      return json({
        success: false,
        message: 'Invalid request. Missing token or secret key.',
        status: 400,
    })
    }

    const res = await fetch(CF_TURNSTILE_VERIFY_ENDPOINT, {
      method: 'POST',
      body: `secret=${encodeURIComponent(CF_TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
    
    try {
      const data = await res.json()
      if (data.success){
        return json({
          success: true,
          message: 'Turnstile verification successful.',
          status: 200,
        })
      }
      console.log('Turnstile verification failed.', data)
      return json({
        success: false,
          message: 'Turnstile verification failed.',
        status: 401,
      })
    } catch (error) {
      console.error('Error verifying Turnstile response:', error)
      return json({
        success: false,
        message: 'Internal Server Error : Error verifying Turnstile response.',
        status: 500,
      })
    }
}