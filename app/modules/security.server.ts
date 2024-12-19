export async function validateRequest(token: string, origin: string) {

  const formData = new FormData();
  formData.append('cf-turnstile-response', token);
    
    const res = await fetch(`${origin}/api/verify`, {
      method: 'POST',
      body: formData,
    });
  
    try {
      const data = await res.json();
      return data.success;
    } catch (error) {
      console.error('Error verifying Turnstile response:', error)
      return false;
    }
  }


export async function getTurnStileSiteKey() {
  const key = process.env.CF_TURNSTILE_SITE_KEY;
  if (!key) {
    throw new Error("CF_TURNSTILE_SITE_KEY is not set");
  }
  return key;
}
