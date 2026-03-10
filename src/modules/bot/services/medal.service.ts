import {Injectable, Logger} from "@nestjs/common";
import {Medals} from "../../../../prisma/generated/enums";
import {DiscordService} from "./discord.service";
import {I18nService} from "../../helper/i18n.service";
import {GuildMember} from "discord.js";

@Injectable()
export class MedalService {
    private readonly logger: Logger = new Logger(MedalService.name);

    constructor(
        private readonly discordService: DiscordService,
        private readonly i18nService: I18nService,
    ) {}

    async registerMedals() {
        const medalMessages = await this.discordService.getMedalMessages();
        const sanitizedMedals = this.sanitizeMessages(medalMessages);
        await this.addMedals(sanitizedMedals);
    }

    async registerMedalsFromMessage(message: string) {
        const sanitizedMedals = this.sanitizeMessages([message]);
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

    sanitizeMessages(messages: string[]): {userId: bigint; medal: Medals}[] {
        const sanitizePreview = (value: string, maxLength = 120) => {
            const flattened = value.replace(/\s+/g, " ").trim();
            if (flattened.length <= maxLength) return flattened;
            return `${flattened.slice(0, maxLength)}...`;
        };

        const headerRegex = /site\s*35\s*[|\-–—]*\s*registre\s*d['’]?attribution\s*des\s*m[ée]dailles/i;
        const medalLineRegex = /m[eé]daille\s*attribu[eé]e?\s*[:-]?\s*(.+)/gi;

        const extractUserId = (block: string) => {
            const mentionMatch = block.match(/<@!?([0-9]{17,})>/);
            const idMatch = mentionMatch ?? block.match(/\b([0-9]{17,})\b/);
            return idMatch ? BigInt(idMatch[1]) : null;
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
                    if (!medalRoleId) {
                        this.logger.warn(
                            `Missing medal role id in attribution message. Medal: "${medalLine}". Preview: "${preview}"`,
                        );
                        return;
                    }
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
                });
            });
        });

        return sanitized;
    }

    private async addMedals(sanitizedMedals: {userId: bigint; medal: Medals}[]) {
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
        const rolePromises = entries.map((entry) => {
            const roleId = this.discordService.getMedalRoleId(entry.medal);
            if (!roleId) {
                this.logger.warn(`No role ID configured for medal ${entry.medal}, skipping role assignment.`);
                return Promise.resolve();
            }
            return this.discordService.addRoleToMember(entry.userId, roleId);
        });

        await Promise.all(rolePromises);
        this.logger.log(`Registered ${entries.length} medals (batch).`);
    }

    async addMedal(userId: bigint, medal: Medals) {
        await this.addMedals([{userId, medal}]);
    }

    async removeMedal(userId: bigint, medal: Medals) {
        const roleId = this.discordService.getMedalRoleId(medal);
        if (!roleId) {
            this.logger.warn(`No role ID configured for medal ${medal}, skipping role removal.`);
            return;
        }
        await this.discordService.removeRoleFromMember(userId, roleId);
        this.logger.log(`Removed medal ${medal} for user ${userId.toString()}.`);
    }
}
