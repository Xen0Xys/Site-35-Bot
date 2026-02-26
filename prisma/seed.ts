import {PrismaClient} from "./generated/client";
import {PrismaPg} from "@prisma/adapter-pg";

// initialize Prisma Client
const adapter: PrismaPg = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});
const prisma: PrismaClient = new PrismaClient({adapter});

async function main() {
    const gStart = Date.now();

    console.log(`\n✅  Seeding completed ! (${Date.now() - gStart}ms)`);
}

// oxlint-disable-next-line no-unused-vars
async function idSeed(table: any, data: any[], update: boolean = true): Promise<void> {
    for (let i = 0; i < data.length; i++) {
        await table.upsert({
            where: {id: data[i].id},
            update: update
                ? {
                      ...data[i],
                  }
                : {},
            create: {
                ...data[i],
            },
        });
    }
}

// oxlint-disable-next-line no-unused-vars
async function seed(table: any, data: any[], id_field: any, update: boolean = true): Promise<void> {
    for (let i = 0; i < data.length; i++) {
        const whereClause: any = {};
        whereClause[id_field] = data[i][id_field];
        await table.upsert({
            where: whereClause,
            update: update
                ? {
                      ...data[i],
                  }
                : {},
            create: {
                ...data[i],
            },
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
