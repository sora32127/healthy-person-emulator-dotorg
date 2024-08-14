import { PrismaClient } from "@prisma/client"

declare global {
    var __prisma: PrismaClient | undefined;
}

let prismaInstance: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
    if (prismaInstance) {
        return prismaInstance;
    }

    const isProduction = import.meta.env.MODE === "production";
    prismaInstance = new PrismaClient();

    // 開発環境でのホットリロード対策
    if (!isProduction) {
        global.__prisma = prismaInstance;
    }

    return prismaInstance;
}

const prisma = getPrismaClient();

export async function getPostDataForSitemap() {
    const posts = await prisma.dimPosts.findMany({
        select: {
            postId: true,
        }
    })

    return posts.map((post) => {
        return {
            loc: `https://healthy-person-emulator.org/archives/${post.postId}`
        }
    })
}


export { prisma }