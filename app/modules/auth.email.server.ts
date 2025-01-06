import { Authenticator } from "remix-auth";
import { sessionStorage } from "./session.server";
import { FormStrategy } from "remix-auth-form";
import type { ExposedUser } from "./auth.google.server";
import { prisma } from "./db.server";
import bcrypt from "bcrypt";

export const authenticator = new Authenticator<ExposedUser>(sessionStorage);

const formStrategy = new FormStrategy(async ({ form }) => {
    const email = form.get("email")?.toString();
    const password = form.get("password")?.toString();
    if (!email || !password) {
        throw new Error("メールアドレスもしくはパスワードが一致しません");
    }
    const isUserExists = await judgeIsUserExists(email);
    if (!isUserExists) {
        throw new Error("メールアドレスが存在しません");
    }
    const user = await getUser(email);
    if (!user) {
        throw new Error("メールアドレスが存在しません");
    }
    const isPasswordCorrect = await judgeIsPasswordCorrect(email, password);
    if (!isPasswordCorrect) {
        throw new Error("パスワードもしくはメールアドレスが一致しません");
    }
    return {
        userUuid: user.userUuid,
        email: user.email,
        userAuthType: user.userAuthType,
    } as ExposedUser;
});


authenticator.use(
    formStrategy, "email-login"
)

async function judgeIsUserExists(email: string) {
    const user = await prisma.dimUsers.findUnique({
        where: { email, userAuthType: "Email" }
    });
    return user !== null;
}

async function getUser(email: string) {
    const user = await prisma.dimUsers.findUnique({
        where: { email, userAuthType: "Email" }
    });
    return user;
}

async function judgeIsPasswordCorrect(email: string, password: string) {
    const encryptedPassword = await prisma.dimUsers.findUnique({
        select: { encryptedPassword: true },
        where: { email, userAuthType: "Email" }
    });
    if (!encryptedPassword?.encryptedPassword) {
        throw new Error("User not found");
    }
    const isPasswordCorrect = await bcrypt.compare(password, encryptedPassword.encryptedPassword);
    return isPasswordCorrect;
}
