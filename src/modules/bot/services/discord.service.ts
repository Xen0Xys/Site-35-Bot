import {Injectable, Logger} from "@nestjs/common";
import {ChannelType, Client, GuildTextBasedChannel} from "discord.js";
import {SimpleUserEntity} from "../models/entities/simple-user.entity";
import {Units} from "../../../../prisma/generated/enums";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class DiscordService {
    private readonly logger = new Logger(DiscordService.name);

    constructor(
        private readonly client: Client,
        private readonly configService: ConfigService,
    ) {}

    async getGuild() {
        const guildId = process.env.DISCORD_GUILD_ID;
        if (!guildId) {
            this.logger.error("DISCORD_GUILD_ID is not defined.");
            return null;
        }
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) {
            this.logger.error("Guild not found. Please check your DISCORD_GUILD_ID.");
            return null;
        }
        return guild;
    }

    async getMemberFromId(id: bigint) {
        const guild = await this.getGuild();
        if (!guild) return null;
        try {
            return await guild.members.fetch(id.toString());
        } catch {
            return null;
        }
    }

    async getGuildMembers() {
        const guild = await this.getGuild();
        if (!guild) return [] as SimpleUserEntity[];
        const members = await guild.members.fetch();
        return members.map((member) => {
            const hasXi8Role = member.roles.cache.has(this.configService.get<string>("DISCORD_XI_8_ROLE_ID") || "");
            const hasAlpha1Role = member.roles.cache.has(
                this.configService.get<string>("DISCORD_ALPHA_1_ROLE_ID") || "",
            );
            return new SimpleUserEntity({
                id: BigInt(member.id),
                displayName: member.displayName,
                unit: hasAlpha1Role ? Units.ALPHA_1 : hasXi8Role ? Units.XI_8 : null,
            });
        });
    }

    async getTrainingMessages(): Promise<string[]> {
        const guild = await this.getGuild();
        if (!guild) return [];
        const trainingChannel = await this.getTrainingChannel();
        if (!trainingChannel) return [];
        const messages = await trainingChannel.messages.fetch({limit: 100});
        return messages.map((message) => message.content);
    }

    async getTrainingChannel(): Promise<GuildTextBasedChannel | null> {
        const guild = await this.getGuild();
        if (!guild) return null;
        const trainingChannelId = process.env.DISCORD_TRAINING_CHANNEL_ID;
        if (!trainingChannelId) {
            this.logger.error("DISCORD_TRAINING_CHANNEL_ID is not defined.");
            return null;
        }
        const trainingChannel = guild.channels.cache.get(trainingChannelId);
        if (!trainingChannel || !trainingChannel.isTextBased()) return null;
        if (trainingChannel.type === ChannelType.GuildAnnouncement) return null;
        return trainingChannel;
    }

    async getRankChannel(): Promise<GuildTextBasedChannel | null> {
        const guild = await this.getGuild();
        if (!guild) return null;
        const rankChannelId = process.env.DISCORD_RANK_CHANNEL_ID;
        if (!rankChannelId) {
            this.logger.error("DISCORD_RANK_CHANNEL_ID is not defined.");
            return null;
        }
        const rankChannel = guild.channels.cache.get(rankChannelId);
        if (!rankChannel || !rankChannel.isTextBased()) return null;
        if (rankChannel.type === ChannelType.GuildAnnouncement) return null;
        return rankChannel;
    }
}
