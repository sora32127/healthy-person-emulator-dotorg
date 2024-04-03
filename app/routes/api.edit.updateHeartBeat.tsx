import { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";
import { prisma } from "~/modules/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const postId = formData.get("postId")?.toString();
  const userName = formData.get("userName")?.toString();

  if (!postId || !userName) {
    return json({ status: 400, message: "postIdとuserNameは必須です" });
  }

  const heartBeatDateUTC = new Date();
  await prisma.nowEditingPages.update({
    where: { postId: Number(postId) },
    data: {
      userName,
      lastHeartBeatAtUTC: heartBeatDateUTC,
    },
  });

  console.log(`ハートビート: ${userName} updated at ${heartBeatDateUTC}`)

  return json({ status: 200, message: "ハートビートを更新しました" });
}
