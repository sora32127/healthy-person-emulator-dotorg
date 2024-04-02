import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { useEffect } from "react";
import { commitSession, getSession } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.client";

import type {
    Session,
} from '@supabase/supabase-js';

export default function AuthCallBack() {
    const fetcher = useFetcher();
    const searchParams = useSearchParams();
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            const formData = new FormData();
            formData.append("session", JSON.stringify(session));
            formData.append("event", event);
            fetcher.submit(formData, { method: "post" });
        }
        );
        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [fetcher, searchParams]);

    return null;
}

export async function action({ request } : ActionFunctionArgs) {
    const formData = await request.formData();
    const formDataSession = formData.get("session") as string | null;
    const event = formData.get("event") as string | null;
    const SupabaseSession: Session = JSON.parse(formDataSession!);
    if (!formDataSession || !event) {
        return redirect("/login");
    }
    console.log("event", event)
    console.log("SupabaseSession", SupabaseSession)

    const session = await getSession(request.headers.get("Cookie"));
    const {
        access_token : accessToken,
        refresh_token : refreshToken,
        user,
    } = SupabaseSession;
    session.set("accessToken", accessToken);
    session.set("refreshToken", refreshToken);
    session.set("userId", user.id);
    return redirect("/resetPassword", {
        headers: {
            "Set-Cookie": await commitSession(session),
        },
    });
}
