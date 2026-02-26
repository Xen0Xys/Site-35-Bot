import {Injectable, Logger, NotFoundException} from "@nestjs/common";
import {PrismaService} from "../../helper/prisma.service";
import {SimpleUserEntity} from "../models/entities/simple-user.entity";
import {Ranks, Users} from "../../../../prisma/generated/client";
import {UserEntity} from "../models/entities/user.entity";
import {I18nService} from "../../helper/i18n.service";

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly i18nService: I18nService,
    ) {}

    async getUserById(id: bigint): Promise<UserEntity | null> {
        const user = await this.prismaService.users.findUnique({
            where: {id},
            include: {user_trainings: true},
        });
        if (!user) {
            return null;
        }
        return new UserEntity({
            id: user.id,
            displayName: user.name,
            rank: user.rank,
            formattedShortRank: this.formatShortRank(user.rank),
            formattedRank: this.i18nService.getRankMap()[user.rank],
            unit: user.unit,
            formattedUnit: user.unit ? this.i18nService.getUnitMap()[user.unit] : null,
            trainings: user.user_trainings.map((t) => t.training),
            formattedTrainings: user.user_trainings.map((t) => this.i18nService.getTrainingMap()[t.training]),
        });
    }

    extractUserInfo(displayName: string) {
        const usernameRegex = /^\[([^\]]+)]\s([a-zA-Z])\.\s(.+)$/;
        const matches = displayName.match(usernameRegex);
        if (!matches) return null;
        const rank = matches[1];
        const firstName = matches[2];
        const lastName = matches[3]?.trim();
        if (!rank || !firstName || !lastName) return null;
        return {rank: this.toRank(rank), name: `${firstName}. ${lastName}`};
    }

    toRank(rank: string): Ranks {
        const formattedRank = rank.toUpperCase().replace(".", "").replace(" ", "_");
        return Ranks[formattedRank as keyof typeof Ranks] || null;
    }

    toRankFromLabel(label: string): Ranks | null {
        const normalizedLabel = label.toUpperCase().replace(/\s+/g, " ").trim();
        const rankMap = this.i18nService.getRankMap();
        const rank = (Object.keys(rankMap) as Ranks[]).find((r) => rankMap[r].toUpperCase() === normalizedLabel);
        if (!rank) {
            this.logger.warn(`Unknown rank label: "${label}" (normalized: "${normalizedLabel}").`);
            return null;
        }
        return rank;
    }

    formatShortRank(rank: Ranks): string {
        const formattedShortRank = rank.toUpperCase().replace("_", " ");
        return formattedShortRank.includes(" ") ? `${formattedShortRank}.` : formattedShortRank;
    }

    async registerUsers(users: SimpleUserEntity[]) {
        const dbUsers = await this.prismaService.users.findMany();
        const newUsers = users.filter((user) => !dbUsers.some((dbUser) => dbUser.id === user.id));
        if (newUsers.length === 0) {
            this.logger.log("No new users to register.");
            return;
        }
        // Update data for existing users
        for (const user of users) {
            const dbUser = dbUsers.find((dbUser) => dbUser.id === user.id);
            if (!dbUser) continue;
            await this.checkData(user, dbUser);
        }

        // Register new users
        newUsers.forEach((user) => this.registerUser(user));
    }

    async registerOrUpdateUser(user: SimpleUserEntity) {
        const dbUser = await this.prismaService.users.findUnique({where: {id: user.id}});
        if (!dbUser) {
            await this.registerUser(user);
            return;
        }
        await this.checkData(user, dbUser);
    }

    async registerUser(user: SimpleUserEntity) {
        const userInfo = this.extractUserInfo(user.displayName);
        if (!userInfo) {
            this.logger.warn(`Skipping registration for user ${user.displayName} due to invalid format.`);
            return;
        }
        await this.prismaService.users.create({
            data: {
                id: user.id,
                rank: userInfo.rank,
                name: userInfo.name,
                unit: user.unit,
            },
        });
        this.logger.log(
            `Registered new user ${user.displayName} with rank ${userInfo.rank}, name ${userInfo.name} and unit ${user.unit}.`,
        );
    }

    async checkData(user: SimpleUserEntity, dbUser: Users) {
        const userInfo = this.extractUserInfo(user.displayName);
        if (!userInfo) {
            this.logger.warn(`Skipping data check for user ${user.displayName} due to invalid format.`);
            return;
        }
        if (dbUser.rank === userInfo.rank && dbUser.name === userInfo.name && dbUser.unit === user.unit) return;
        await this.prismaService.users.update({
            where: {id: user.id},
            data: {
                rank: userInfo.rank,
                name: userInfo.name,
                unit: user.unit,
            },
        });
        this.logger.log(
            `Updated user ${user.displayName} with new rank ${userInfo.rank}, name ${userInfo.name} and unit ${user.unit}.`,
        );
    }

    async updateUserRank(userId: bigint, rank: Ranks, name: string) {
        const user = await this.prismaService.users.findUnique({where: {id: userId}});
        if (!user) throw new NotFoundException(`User with id ${userId.toString()} not found, cannot update rank.`);
        await this.prismaService.users.update({
            where: {id: userId},
            data: {
                rank,
                name,
            },
        });
        this.logger.log(`Updated user ${userId.toString()} with new rank ${rank} and name ${name}.`);
    }
}
