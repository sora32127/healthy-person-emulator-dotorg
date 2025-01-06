import type { ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import bcrypt from "bcrypt";
export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    if (!email || !password) {
        throw new Error("メールアドレスもしくはパスワードが一致しません");
    }
    return await createUser(email, password);
}

async function createUser(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.dimUsers.create({
        data: {
            email,
            encryptedPassword: hashedPassword,
            userAuthType: "Email",
        },
    });
    return { success: true, message: "ユーザーを作成しました" };
}