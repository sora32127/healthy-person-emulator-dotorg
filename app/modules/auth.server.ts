import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { prisma } from "./db.server";
import bcrypt from "bcrypt";

export type LoginFormData = {
    email: string;
    password: string;
};

export const authenticator = new Authenticator<LoginFormData>();

authenticator.use(
    new FormStrategy(async ({ form }) => {
        const email = form.get("email") as string;
        const password = form.get("password") as string;
        try {
            const loginResult = await loginByEmail(email, password);
            return { email, password };
        } catch (error) {
            throw new Error(error as string);
        }
    }), "email-login"
);

export async function createUserByEmail(email: string, password: string): Promise<{ message: string, success: boolean, data: { email: string, password: string } }> {
    const isUserExists = await judgeUserExistsByEmail(email);
    if (isUserExists) {
        throw new Error("指定したメールアドレスを持つユーザーは既に存在します。");
    }
    const bcrptedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.dimUsers.create({
        data: { email, encryptedPassword: bcrptedPassword, userAuthType: "Email" },
    });
    return { message: "ユーザー作成に成功しました。", success: true, data: { email, password } };
}


async function loginByEmail(email: string, password: string): Promise<{ message: string, success: boolean, data: { email: string, password: string } }> {
    const isUserExists = await judgeUserExistsByEmail(email);
    if (!isUserExists) {
        throw new Error("指定したメールアドレスを持つユーザーは存在しません。");
    }
    const userEncryptedPassword = await getUserEncryptedPasswordByEmail(email);
    if (!userEncryptedPassword) {
        throw new Error("パスワードが設定されていません。");
    }
    const isPasswordCorrect = await verifyPassword(password, userEncryptedPassword);
    if (!isPasswordCorrect) {
        throw new Error("パスワードが正しくありません。");
    }
    return {
        message: "ログイン成功",
        success: true,
        data: {
            email: email,
            password: password,
        }
    }
}

async function judgeUserExistsByEmail(email: string): Promise<boolean> {
    try {
        const user = await prisma.dimUsers.findUniqueOrThrow({
            where: { email: email },
        });
        return true;
    } catch (error) {
        return false;
    }
}

async function getUserEncryptedPasswordByEmail(email: string): Promise<string | null> {
    try {
        const user = await prisma.dimUsers.findUniqueOrThrow({
            where: { email: email },
        });
        return user.encryptedPassword;
    } catch (error) {
        throw new Error("User not found");
    }
}

async function verifyPassword(passwordEnteredByUser: string, passwordInDatabase: string): Promise<boolean> {
    const bcrptedPassword = await bcrypt.hash(passwordEnteredByUser, 10);
    return bcrptedPassword === passwordInDatabase;
}

