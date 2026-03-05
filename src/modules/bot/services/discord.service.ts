import {Injectable, Logger} from "@nestjs/common";
import {ChannelType, Client, GuildTextBasedChannel} from "discord.js";
import {SimpleUserEntity} from "../models/entities/simple-user.entity";
import {Trainings, Units} from "../../../../prisma/generated/enums";
import {ConfigService} from "@nestjs/config";
import * as necord from "necord";

@Injectable()
export class DiscordService {
    public readonly siteSecurityRoleId: string;
    public readonly xi8RoleId: string;
    public readonly alpha1RoleId: string;
    private readonly logger = new Logger(DiscordService.name);

    constructor(
        private readonly client: Client,
        private readonly configService: ConfigService,
    ) {
        this.siteSecurityRoleId = this.configService.get<string>("DISCORD_SITE_SECURITY_ROLE_ID") || "";
        this.xi8RoleId = this.configService.get<string>("DISCORD_XI_8_ROLE_ID") || "";
        this.alpha1RoleId = this.configService.get<string>("DISCORD_ALPHA_1_ROLE_ID") || "";
    }

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
            return new SimpleUserEntity({
                id: BigInt(member.id),
                displayName: member.displayName,
                unit: this.getMemberUnit(member),
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
        // Only allow text-based guild channels (exclude announcements).
        const trainingChannel = guild.channels.cache.get(trainingChannelId);
        if (!trainingChannel || !trainingChannel.isTextBased()) return null;
        if (trainingChannel.type === ChannelType.GuildAnnouncement) return null;
        return trainingChannel;
    }

    async getRankChannel(): Promise<GuildTextBasedChannel | null> {
        const guild = await this.getGuild();
        if (!guild) return null;
        const rankChannelId = process.env.DISCORD_PROMO_DEMO_CHANNEL_ID;
        if (!rankChannelId) {
            this.logger.error("DISCORD_RANK_CHANNEL_ID is not defined.");
            return null;
        }
        // Only allow text-based guild channels (exclude announcements).
        const rankChannel = guild.channels.cache.get(rankChannelId);
        if (!rankChannel || !rankChannel.isTextBased()) return null;
        if (rankChannel.type === ChannelType.GuildAnnouncement) return null;
        return rankChannel;
    }

    async removeRoleFromMember(memberId: bigint, roleId: string) {
        const member = await this.getMemberFromId(memberId);
        if (!member) {
            this.logger.warn(`Member with ID ${memberId.toString()} not found, cannot remove role ${roleId}.`);
            return;
        }
        try {
            await member.roles.remove(roleId);
            this.logger.log(`Removed role ${roleId} from member ${member.displayName} (${member.id}).`);
        } catch (error) {
            this.logger.error(
                `Failed to remove role ${roleId} from member ${member.displayName} (${member.id}): ${error}`,
            );
        }
    }

    async addRoleToMember(memberId: bigint, roleId: string) {
        const member = await this.getMemberFromId(memberId);
        if (!member) {
            this.logger.warn(`Member with ID ${memberId.toString()} not found, cannot add role ${roleId}.`);
            return;
        }
        try {
            await member.roles.add(roleId);
            this.logger.log(`Added role ${roleId} to member ${member.displayName} (${member.id}).`);
        } catch (error) {
            this.logger.error(`Failed to add role ${roleId} to member ${member.displayName} (${member.id}): ${error}`);
        }
    }

    getMemberUnit(member: necord.ContextOf<"guildMemberNicknameUpdate">[0]) {
        const hasSiteSecurityRole = this.siteSecurityRoleId ? member.roles.cache.has(this.siteSecurityRoleId) : false;
        const hasXi8Role = this.xi8RoleId ? member.roles.cache.has(this.xi8RoleId) : false;
        const hasAlpha1Role = this.alpha1RoleId ? member.roles.cache.has(this.alpha1RoleId) : false;
        if (hasAlpha1Role) return Units.ALPHA_1;
        if (hasXi8Role) return Units.XI_8;
        if (hasSiteSecurityRole) return Units.SITE_SECURITY;
        return null;
    }

    getTrainingRoleId(training: Trainings) {
        switch (training) {
            case Trainings.FIM:
                return this.configService.get<string>("DISCORD_FIM_ROLE_ID");
            case Trainings.CQC:
                return this.configService.get<string>("DISCORD_CQC_ROLE_ID");
            case Trainings.FIRST_AID:
                return this.configService.get<string>("DISCORD_FIRST_AID_ROLE_ID");
            case Trainings.BREACHER:
                return this.configService.get<string>("DISCORD_BREACHER_ROLE_ID");
            case Trainings.GRENADE_LAUNCHER:
                return this.configService.get<string>("DISCORD_GRENADE_LAUNCHER_ROLE_ID");
            case Trainings.FLAMETHROWER:
                return this.configService.get<string>("DISCORD_FLAMETHROWER_ROLE_ID");
            case Trainings.ANTI_TANK:
                return this.configService.get<string>("DISCORD_ANTI_TANK_ROLE_ID");
            case Trainings.ARTIFICIER:
                return this.configService.get<string>("DISCORD_ARTIFICIER_ROLE_ID");
            case Trainings.SNIPER:
                return this.configService.get<string>("DISCORD_SNIPER_ROLE_ID");
            case Trainings.MACHINE_GUNNER:
                return this.configService.get<string>("DISCORD_MACHINE_GUNNER_ROLE_ID");
            case Trainings.MEDIC:
                return this.configService.get<string>("DISCORD_MEDIC_ROLE_ID");
            case Trainings.DRONE:
                return this.configService.get<string>("DISCORD_DRONE_ROLE_ID");
            default:
                return null;
        }
    }
}
