import { PrismaClient } from '@prisma/client'
import prismaRandom from 'prisma-extension-random';

const prisma = new PrismaClient().$extends(prismaRandom())

export { prisma }