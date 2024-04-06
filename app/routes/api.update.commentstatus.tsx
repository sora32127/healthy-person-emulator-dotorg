import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { isAdminLogin } from "~/modules/session.server";

export async function action({ request }: ActionFunctionArgs) {
    const isAdmin = await isAdminLogin(request);
    if (!isAdmin) {
        return new Response("Unauthorized", { status: 401 });
    }
  
    const formData = await request.formData();
    const postId = Number(formData.get("postId"));

    try {
        const nowCommentStatus = await prisma.dimPosts.findFirst({
            where: { postId },
            select: { commentStatus: true },
        });
        if (!nowCommentStatus) {
            return new Response("Not Found", { status: 404 });
        }
        const newCommentStatus = nowCommentStatus.commentStatus === "open" ? "closed" : "open";
        await prisma.dimPosts.update({
            where: { postId },
            data: { commentStatus: newCommentStatus },
        });
        return redirect(`/archives/${postId}`);
    } catch (e) {
        console.error(e);
        return new Response("Internal Server Error", { status: 500 });
    }
}
