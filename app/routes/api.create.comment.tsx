import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db.server";

export async function action({ request } : ActionFunctionArgs) {
    const formData = await request.formData();
    const postId = formData.get("postId")?.toString();
    const commentAuthor = formData.get("commentAuthor")?.toString();
    const commentContent = formData.get("commentContent")?.toString() || "";
    const commentParent = Number(formData.get("commentParent")) || 0;

    try {
        await prisma.dimComments.create({
            data: {
                postId: Number(postId),
                commentAuthor,
                commentContent,
                commentParent
            },
        });
        return redirect(`/archives/${postId}`);
    }
    catch (e) {
        console.error(e);
        return new Response("Internal Server Error", { status: 500 });
    }
}