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
        await prisma.dimPosts.delete({ where: { postId } });
        return redirect("/");
    } catch (e) {
        console.error(e);
        return new Response("Internal Server Error", { status: 500 });
    }
}
