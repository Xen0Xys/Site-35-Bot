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
        // Normalize text for resilient matching across accents, punctuation, and casing.
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

        const medals = Object.values(Medals) as Medals[];

        const normalizedLabelToMedal = new Map<string, Medals>();
        const medalMap = this.i18nService.getMedalMap();
        medals.forEach((medal) => {
            const label = medalMap[medal];
            if (label) {
                normalizedLabelToMedal.set(normalize(label), medal);
                normalizedLabelToMedal.set(normalizeNoSpace(label), medal);
            }
            normalizedLabelToMedal.set(normalize(medal), medal);
            normalizedLabelToMedal.set(normalizeNoSpace(medal), medal);
        });

        const extractRoleId = (value: string) => {
            const roleMentionMatch = value.match(/<@&([0-9]{17,})>/);
            const idMatch = roleMentionMatch ?? value.match(/\b([0-9]{17,})\b/);
            return idMatch ? idMatch[1] : null;
        };

        const sanitized: {userId: bigint; medal: Medals}[] = [];

        messages.forEach((message) => {
            const cleanedMessage = message.replace(/\r/g, "");
            // Support optional header lines and parse each logical block separately.
            const headerRegex = /site\s*35\s*[|\-–—]*\s*registre\s*d['’]?attribution\s*des\s*m[ée]dailles/i;
            const blocks = cleanedMessage
                .split(headerRegex)
                .map((block) => block.trim())
                .filter((block) => block.length > 0);
            const targetBlocks = blocks.length > 0 ? blocks : [cleanedMessage];

            targetBlocks.forEach((block) => {
                const preview = sanitizePreview(block);
                const medalLineMatches = Array.from(block.matchAll(/m[eé]daille\s*attribu[eé]e?\s*[:-]?\s*(.+)/gi)).map(
                    (match) => match[1].trim(),
                );

                const normalizedBlock = normalize(block);
                const fallbackMatches = Array.from(normalizedBlock.matchAll(/medaille attribuee\s+(.+)/gi)).map(
                    (match) => match[1].trim(),
                );

                const medalCandidates = medalLineMatches.length > 0 ? medalLineMatches : fallbackMatches;

                if (medalCandidates.length === 0) return;

                // Extract member id from mention or raw numeric id.
                const mentionMatch = block.match(/<@!?([0-9]{17,})>/);
                const idMatch = mentionMatch ?? block.match(/\b([0-9]{17,})\b/);
                if (!idMatch) return;

                const userId = BigInt(idMatch[1]);

                medalCandidates.forEach((medalCandidate) => {
                    const medalRaw = medalCandidate.split("site 35")[0].trim();
                    if (!medalRaw) return;

                    const medalRoleId = extractRoleId(medalRaw) ?? extractRoleId(block);
                    if (medalRoleId) {
                        const medal = medals.find((candidate) => {
                            const roleId = this.discordService.getMedalRoleId(candidate);
                            return Boolean(roleId) && roleId === medalRoleId;
                        });
                        if (!medal) {
                            this.logger.warn(
                                `Unknown medal role id ${medalRoleId} in attribution message. Medal: "${medalRaw}". Preview: "${preview}"`,
                            );
                            return;
                        }
                        sanitized.push({userId, medal});
                        return;
                    }

                    const normalizedMedal = normalize(medalRaw.replace(/^@+/, "").trim());
                    const normalizedNoSpaceMedal = normalizeNoSpace(medalRaw.replace(/^@+/, "").trim());
                    const medal =
                        normalizedLabelToMedal.get(normalizedMedal) ??
                        normalizedLabelToMedal.get(normalizedNoSpaceMedal);
                    if (!medal) {
                        this.logger.warn(
                            `Unknown medal label "${medalRaw}" (normalized: "${normalizedMedal}"), skipping. Preview: "${preview}"`,
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
