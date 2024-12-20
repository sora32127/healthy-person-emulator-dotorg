import { getClientIPAddress } from "remix-utils/get-client-ip-address";

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
    // 一次的な措置
    return true;
  }
}


export async function getTurnStileSiteKey() {
  const key = process.env.CF_TURNSTILE_SITEKEY;
  if (!key) {
    throw new Error("CF_TURNSTILE_SITEKEY is not set");
  }
  return key;
}


export async function getHashedUserIPAddress(request: Request){
  const ipAddress = getClientIPAddress(request) || "";
  return ipAddress;
}