const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
    try {
        const user = await prisma.user.findUnique({ where: { email: '1032230420@tcetmumbai.in' }});
        if (user) {
            await prisma.chatSession.update({
                where: { userId: user.id },
                data: { queryCount: 0 }
            });
            console.log("Reset successful!");
        } else {
            console.log("User not found");
        }
    } catch(e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
reset();
