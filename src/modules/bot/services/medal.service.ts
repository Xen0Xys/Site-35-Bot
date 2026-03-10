import {Injectable, Logger, NotFoundException} from "@nestjs/common";
import {Medals} from "../../../../prisma/generated/enums";
import {DiscordService} from "./discord.service";
import {I18nService} from "../../helper/i18n.service";
import {GuildMember} from "discord.js";
import {PrismaService} from "../../helper/prisma.service";

@Injectable()
export class MedalService {
    private readonly logger: Logger = new Logger(MedalService.name);

    constructor(
        private readonly discordService: DiscordService,
        private readonly i18nService: I18nService,
        private readonly prismaService: PrismaService,
    ) {}

    async registerMedals() {
        const medalMessages = await this.discordService.getMedalMessages();
        const sanitizedMedals = await this.sanitizeMessages(medalMessages);
        await this.addMedals(sanitizedMedals);
    }

    async registerMedalsFromMessage(message: string) {
        const sanitizedMedals = await this.sanitizeMessages([message]);
        await this.addMedals(sanitizedMedals);
    }

    toMedalFromLabel(label: string): Medals | null {
        const normalizedLabel = label.toUpperCase().replace(/\s+/g, " ").trim();
        const medalMap = this.i18nService.getMedalMap();
        const medal = (Object.keys(medalMap) as Medals[]).find((m) => medalMap[m].toUpperCase() === normalizedLabel);
        if (!medal) {
            this.logger.warn(`Unknown medal label: "${label}" (normalized: "${normalizedLabel}").`);
            return null;
        }
        return medal;
    }

    getMedalRoleId(medal: Medals) {
        return this.discordService.getMedalRoleId(medal);
    }

    getMemberMedals(member: GuildMember) {
        const medalMap = this.i18nService.getMedalMap();
        const medals = (Object.values(Medals) as Medals[]).filter((medal) => {
            const roleId = this.discordService.getMedalRoleId(medal);
            return Boolean(roleId) && member.roles.cache.has(roleId as string);
        });
        return {
            medals,
            formattedMedals: medals.map((medal) => medalMap[medal] ?? medal),
        };
    }

    async sanitizeMessages(messages: string[]): Promise<{userId: bigint; medal: Medals}[]> {
        const normalize = (value: string) =>
            value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");

        const sanitizePreview = (value: string, maxLength = 120) => {
            const flattened = value.replace(/\s+/g, " ").trim();
            if (flattened.length <= maxLength) return flattened;
            return `${flattened.slice(0, maxLength)}...`;
        };

        const headerRegex = /site\s*35\s*[|\-–—]*\s*registre\s*d['’]?attribution\s*des\s*m[ée]dailles/i;
        const medalLineRegex = /m[eé]daille\s*attribu[eé]e?\s*[:-]?\s*(.+)/gi;

        const members = await this.discordService.getGuildMembers();
        const memberIdByName = new Map<string, bigint[]>();
        members.forEach((member) => {
            const normalizedName = normalize(member.displayName);
            const existing = memberIdByName.get(normalizedName);
            if (existing) existing.push(member.id);
            else memberIdByName.set(normalizedName, [member.id]);
        });

        const resolveUserIdByName = (name: string) => {
            const normalizedName = normalize(name);
            const candidates = memberIdByName.get(normalizedName);
            if (!candidates || candidates.length === 0) return null;
            if (candidates.length > 1) {
                this.logger.warn(`Multiple members match name "${name}", skipping.`);
                return null;
            }
            return candidates[0];
        };

        const extractUserId = (block: string) => {
            const mentionMatch = block.match(/<@!?([0-9]{17,})>/);
            const idMatch = mentionMatch ?? block.match(/\b([0-9]{17,})\b/);
            if (idMatch) return BigInt(idMatch[1]);
            const nameMatch = block.match(/nom\s*[:\-]\s*@?(.+)/i);
            if (!nameMatch) return null;
            const nameLine = nameMatch[1].split("\n")[0].trim();
            return nameLine ? resolveUserIdByName(nameLine) : null;
        };

        const extractRoleId = (value: string) => {
            const roleMentionMatch = value.match(/<@&([0-9]{17,})>/);
            const idMatch = roleMentionMatch ?? value.match(/\b([0-9]{17,})\b/);
            return idMatch ? idMatch[1] : null;
        };

        const medals = Object.values(Medals) as Medals[];

        const sanitized: {userId: bigint; medal: Medals}[] = [];

        messages.forEach((message) => {
            const cleanedMessage = message.replace(/\r/g, "");
            const blocks = cleanedMessage
                .split(headerRegex)
                .map((block) => block.trim())
                .filter((block) => block.length > 0);
            const targetBlocks = blocks.length > 0 ? blocks : [cleanedMessage];

            targetBlocks.forEach((block) => {
                const preview = sanitizePreview(block);
                const userId = extractUserId(block);
                if (!userId) {
                    this.logger.warn(`Missing user id in medal attribution message. Preview: "${preview}"`);
                    return;
                }

                const medalLineMatches = Array.from(block.matchAll(medalLineRegex)).map((match) => match[1].trim());
                if (medalLineMatches.length === 0) {
                    this.logger.warn(`Missing medal line in attribution message. Preview: "${preview}"`);
                    return;
                }

                medalLineMatches.forEach((medalLine) => {
                    const medalRoleId = extractRoleId(medalLine) ?? extractRoleId(block);
                    if (medalRoleId) {
                        const medal = medals.find((candidate) => {
                            const roleId = this.discordService.getMedalRoleId(candidate);
                            return Boolean(roleId) && roleId === medalRoleId;
                        });
                        if (!medal) {
                            this.logger.warn(
                                `Unknown medal role id ${medalRoleId} in attribution message. Medal: "${medalLine}". Preview: "${preview}"`,
                            );
                            return;
                        }
                        sanitized.push({userId, medal});
                        return;
                    }

                    const medalLabel = medalLine.replace(/^@+/, "").trim();
                    const medal = this.toMedalFromLabel(medalLabel);
                    if (!medal) {
                        this.logger.warn(
                            `Unknown medal label "${medalLabel}" in attribution message. Preview: "${preview}"`,
                        );
                        return;
                    }
                    sanitized.push({userId, medal});
                });
            });
        });

        return sanitized;
    }

    private async addMedals(sanitizedMedals: {userId: bigint; medal: Medals}[], requireExistingUser: boolean = false) {
        if (sanitizedMedals.length === 0) {
            this.logger.log("No medals to register.");
            return;
        }

        const uniqueEntries = new Map<string, {userId: bigint; medal: Medals}>();
        sanitizedMedals.forEach((entry) => {
            const key = `${entry.userId.toString()}-${entry.medal}`;
            if (!uniqueEntries.has(key)) uniqueEntries.set(key, entry);
        });

        const entries = Array.from(uniqueEntries.values());
        const userIds = Array.from(new Set(entries.map((entry) => entry.userId)));
        const existingUsers = await this.prismaService.users.findMany({
            where: {id: {in: userIds}},
            select: {id: true},
        });
        const existingUserIds = new Set(existingUsers.map((user) => user.id.toString()));
        const createData = entries
            .filter((entry) => existingUserIds.has(entry.userId.toString()))
            .map((entry) => ({user_id: entry.userId, medal: entry.medal}));

        const missingEntries = entries.filter((entry) => !existingUserIds.has(entry.userId.toString()));
        if (missingEntries.length > 0) {
            if (requireExistingUser) {
                const entry = missingEntries[0];
                throw new NotFoundException(
                    `User with id ${entry.userId.toString()} not found, cannot add medal ${entry.medal}.`,
                );
            }
            missingEntries.forEach((entry) => {
                this.logger.warn(`Skipping medal for missing user ${entry.userId.toString()}: ${entry.medal}.`);
            });
        }

        if (createData.length > 0) {
            await this.prismaService.userMedals.createMany({
                data: createData,
                skipDuplicates: true,
            });
            const rolePromises = createData.map((entry) => {
                const roleId = this.discordService.getMedalRoleId(entry.medal);
                if (!roleId) {
                    this.logger.warn(`No role ID configured for medal ${entry.medal}, skipping role assignment.`);
                    return Promise.resolve();
                }
                return this.discordService.addRoleToMember(entry.user_id, roleId);
            });
            await Promise.all(rolePromises);
            this.logger.log(`Registered ${createData.length} medals (batch).`);
        } else {
            this.logger.log("No medals to register after filtering.");
        }
    }

    async addMedal(userId: bigint, medal: Medals) {
        await this.addMedals([{userId, medal}], true);
    }

    async removeMedal(userId: bigint, medal: Medals) {
        const user = await this.prismaService.users.findUnique({where: {id: userId}});
        if (!user)
            throw new NotFoundException(`User with id ${userId.toString()} not found, cannot remove medal ${medal}.`);
        await this.prismaService.userMedals.delete({
            where: {
                user_id_medal: {
                    user_id: userId,
                    medal,
                },
            },
        });
        const roleId = this.discordService.getMedalRoleId(medal);
        if (!roleId) {
            this.logger.warn(`No role ID configured for medal ${medal}, skipping role removal.`);
            return;
        }
        await this.discordService.removeRoleFromMember(userId, roleId);
        this.logger.log(`Removed medal ${medal} for user ${userId.toString()}.`);
    }
}
