import { ActionFunctionArgs } from "@remix-run/node";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { prisma } from "~/modules/db.server";

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const suggestionResult = formData.getAll("suggestionResult") as string[];
    const commitText = formData.get("commitText") as string | "";

    await insertAiCompletionCommitHistory(request, suggestionResult, commitText);
    return new Response("OK", {
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function getUserIpHashString(ip: string) {
    const userIpHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip)
    );
    const hashArray = Array.from(new Uint8Array(userIpHash));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function insertAiCompletionCommitHistory(request: Request, suggestionResult: string[], commitText: string) {
    const ip = getClientIPAddress(request) || "";
    const userIpHash = await getUserIpHashString(ip);
    await prisma.fctAICompletionCommitHistory.create({
        data: {
            commitUserIPHash: userIpHash,
            suggestionResult,
            commitText,
        },
    });
}
