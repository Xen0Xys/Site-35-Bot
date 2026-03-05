import {Injectable, Logger, NotFoundException} from "@nestjs/common";
import {Ranks} from "../../../../prisma/generated/enums";
import {I18nService} from "../../helper/i18n.service";
import {PrismaService} from "../../helper/prisma.service";
import {DiscordService} from "./discord.service";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class RankService {
    private readonly logger = new Logger(RankService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly i18nService: I18nService,
        private readonly discordService: DiscordService,
        private readonly configService: ConfigService,
    ) {}

    async registerPromoDemoFromMessage(content: string) {
        const sanitizedRanks = this.sanitizeMessages([content]);
        await this.updateUserRanks(sanitizedRanks);
    }

    formatShortRank(rank: Ranks): string {
        const formattedShortRank = rank.toUpperCase().replace("_", " ");
        return formattedShortRank.includes(" ") ? `${formattedShortRank}.` : formattedShortRank;
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

    async updateUserRank(userId: bigint, rank: Ranks) {
        await this.updateUserRanks([{userId, rank}], true);
    }

    private sanitizeMessages(messages: string[]) {
        const normalize = (value: string) =>
            value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");

        const normalizeNoSpace = (value: string) => normalize(value).replace(/\s+/g, "");

        const sanitizePreview = (value: string, maxLength = 120) => {
            const flattened = value.replace(/\s+/g, " ").trim();
            if (flattened.length <= maxLength) return flattened;
            return `${flattened.slice(0, maxLength)}...`;
        };

        const ranks = Object.values(Ranks) as Ranks[];
        const normalizedLabelToRank = new Map<string, Ranks>();
        const rankMap = this.i18nService.getRankMap();
        ranks.forEach((rank) => {
            const label = rankMap[rank];
            normalizedLabelToRank.set(normalize(label), rank);
            normalizedLabelToRank.set(normalizeNoSpace(label), rank);
            normalizedLabelToRank.set(normalize(rank), rank);
            normalizedLabelToRank.set(normalizeNoSpace(rank), rank);
            const shortRank = this.formatShortRank(rank);
            normalizedLabelToRank.set(normalize(shortRank), rank);
            normalizedLabelToRank.set(normalizeNoSpace(shortRank), rank);
        });

        const sanitized: {userId: bigint; rank: Ranks}[] = [];

        messages.forEach((message) => {
            const cleanedMessage = message.replace(/\r/g, "");
            const headerRegex = /site\s*35\s*[|\-–—]*\s*registre\s*des\s*promotions\s*\/?\s*demotions?/i;
            const blocks = cleanedMessage
                .split(headerRegex)
                .map((block) => block.trim())
                .filter((block) => block.length > 0);
            const targetBlocks = blocks.length > 0 ? blocks : [cleanedMessage];

            targetBlocks.forEach((block) => {
                const preview = sanitizePreview(block);
                const rankMatches = Array.from(block.matchAll(/Grade actuel\s*:\s*(.+)$/gim));
                const rankMatch = rankMatches.length > 0 ? rankMatches[rankMatches.length - 1] : null;
                if (!rankMatch) return;

                const rankRaw = rankMatch[1].trim();
                if (!rankRaw) return;

                const normalizedRank = normalize(rankRaw);
                const rank =
                    normalizedLabelToRank.get(normalizedRank) ?? normalizedLabelToRank.get(normalizeNoSpace(rankRaw));
                if (!rank) {
                    this.logger.warn(
                        `Unknown rank "${rankRaw}" (normalized: "${normalizedRank}"), skipping. Preview: "${preview}"`,
                    );
                    return;
                }

                const mentionMatch = block.match(/<@!?(\d{17,})>/);
                const idMatch = mentionMatch ?? block.match(/\b(\d{17,})\b/);
                if (!idMatch) return;

                const userId = BigInt(idMatch[1]);
                sanitized.push({userId, rank});
            });
        });

        return sanitized;
    }

    private async updateUserRanks(
        sanitizedRanks: {userId: bigint; rank: Ranks}[],
        requireExistingUser: boolean = false,
    ) {
        if (sanitizedRanks.length === 0) {
            this.logger.log("No rank updates to register.");
            return;
        }

        const uniqueEntries = new Map<string, {userId: bigint; rank: Ranks}>();
        sanitizedRanks.forEach((entry) => {
            const key = `${entry.userId.toString()}-${entry.rank}`;
            if (!uniqueEntries.has(key)) uniqueEntries.set(key, entry);
        });

        const entries = Array.from(uniqueEntries.values());
        const userIds = Array.from(new Set(entries.map((entry) => entry.userId)));
        const existingUsers = await this.prismaService.users.findMany({
            where: {id: {in: userIds}},
            select: {id: true, name: true, rank: true},
        });
        const existingUserIds = new Set(existingUsers.map((user) => user.id.toString()));
        const existingUserNames = new Map(existingUsers.map((user) => [user.id.toString(), user.name]));

        const updates = entries.filter((entry) => existingUserIds.has(entry.userId.toString()));
        const skipped = entries.filter((entry) => !existingUserIds.has(entry.userId.toString()));

        if (skipped.length > 0) {
            if (requireExistingUser) {
                const entry = skipped[0];
                throw new NotFoundException(
                    `User with id ${entry.userId.toString()} not found, cannot update rank ${entry.rank}.`,
                );
            }

            skipped.forEach((entry) => {
                this.logger.warn(`Skipping rank update for missing user ${entry.userId.toString()}: ${entry.rank}.`);
            });
        }

        if (updates.length === 0) {
            this.logger.log("No rank updates to register after filtering.");
            return;
        }

        for (const entry of updates) {
            const userId = entry.userId.toString();
            const member = await this.discordService.getMemberFromId(entry.userId);
            const nameMatch = member?.displayName.match(/^\[[^\]]+]\s([a-zA-Z])\.\s(.+)$/);
            const parsedName = nameMatch ? `${nameMatch[1]}. ${nameMatch[2].trim()}` : null;
            const fallbackName = existingUserNames.get(userId) ?? null;
            const updatedName = parsedName ?? fallbackName;

            if (!parsedName && member) {
                this.logger.warn(`Failed to parse nickname for ${userId}, keeping stored name.`);
            }

            if (existingUsers.find((u) => u.id.toString() === userId)?.rank === Ranks.CDT) {
                try {
                    await Promise.all([
                        this.discordService.removeRoleFromMember(entry.userId, this.discordService.siteSecurityRoleId),
                        this.discordService.addRoleToMember(entry.userId, this.discordService.xi8RoleId),
                    ]);
                    this.logger.log(`Updated roles for CDT user ${userId} promoted to ${entry.rank}.`);
                } catch {
                    this.logger.warn(`Failed to update roles for CDT user ${userId} promoted to ${entry.rank}.`);
                }
            } else if (entry.rank === Ranks.CDT) {
                try {
                    await Promise.all([
                        this.discordService.removeRoleFromMember(entry.userId, this.discordService.xi8RoleId),
                        this.discordService.removeRoleFromMember(entry.userId, this.discordService.alpha1RoleId),
                        this.discordService.addRoleToMember(entry.userId, this.discordService.siteSecurityRoleId),
                    ]);
                    this.logger.log(`Updated roles for new CDT user ${userId}.`);
                } catch {
                    this.logger.warn(`Failed to update roles for new CDT user ${userId}.`);
                }
            }

            await this.prismaService.users.update({
                where: {id: entry.userId},
                data: updatedName ? {rank: entry.rank, name: updatedName} : {rank: entry.rank},
            });
            this.logger.log(`Updated rank to ${entry.rank} for user ${userId}.`);

            if (member && updatedName) {
                const formattedShortNewRank = this.formatShortRank(entry.rank);
                const updatedNickname = `[${formattedShortNewRank}] ${updatedName}`;
                try {
                    await member.setNickname(updatedNickname);
                } catch {
                    this.logger.warn(`Failed to update nickname for ${userId} to ${updatedNickname}.`);
                }
            }
        }
    }
}
