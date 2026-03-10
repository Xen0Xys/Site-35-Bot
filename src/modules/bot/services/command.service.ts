import {Injectable} from "@nestjs/common";
import * as necord from "necord";
import {Guild, GuildMember, MessageFlagsBitField} from "discord.js";
import {DiscordService} from "./discord.service";
import {UserService} from "./user.service";

@Injectable()
export class CommandService {
    constructor(
        private readonly discordService: DiscordService,
        private readonly userService: UserService,
    ) {}

    replyEphemeral(interaction: necord.SlashCommandContext[0], content: string) {
        return interaction.reply({
            content,
            flags: MessageFlagsBitField.Flags.Ephemeral,
        });
    }

    async getUserOrReply(interaction: necord.SlashCommandContext[0], userId: bigint) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            await this.replyEphemeral(
                interaction,
                "Failed to retrieve user information. Please check the bot configuration.",
            );
            return null;
        }
        return user;
    }

    async getGuildOrReply(interaction: necord.SlashCommandContext[0]): Promise<Guild | null> {
        const guild = await this.discordService.getGuild();
        if (!guild) {
            await this.replyEphemeral(
                interaction,
                "Failed to retrieve guild information. Please check the bot configuration.",
            );
            return null;
        }
        return guild;
    }

    async getTrainingChannelOrReply(interaction: necord.SlashCommandContext[0]) {
        const trainingChannel = await this.discordService.getTrainingChannel();
        if (!trainingChannel) {
            await this.replyEphemeral(
                interaction,
                "Training channel not found or is not text-based. Please check the bot configuration.",
            );
            return null;
        }
        return trainingChannel;
    }

    async getRankChannelOrReply(interaction: necord.SlashCommandContext[0]) {
        const rankChannel = await this.discordService.getRankChannel();
        if (!rankChannel) {
            await this.replyEphemeral(
                interaction,
                "Rank channel not found or is not text-based. Please check the bot configuration.",
            );
            return null;
        }
        return rankChannel;
    }

    async getMedalChannelOrReply(interaction: necord.SlashCommandContext[0]) {
        const medalChannel = await this.discordService.getMedalChannel();
        if (!medalChannel) {
            await this.replyEphemeral(
                interaction,
                "Medal channel not found or is not text-based. Please check the bot configuration.",
            );
            return null;
        }
        return medalChannel;
    }

    async getMemberOrReply(interaction: necord.SlashCommandContext[0], memberId: bigint): Promise<GuildMember | null> {
        const member = await this.discordService.getMemberFromId(memberId);
        if (!member) {
            await this.replyEphemeral(
                interaction,
                "Failed to retrieve your member information. Please make sure you are a member of the guild.",
            );
            return null;
        }
        return member;
    }

    async ensureCanSend(
        interaction: necord.SlashCommandContext[0],
        member: GuildMember,
        channel: Exclude<Awaited<ReturnType<DiscordService["getTrainingChannel"]>>, null>,
        actionLabel: string,
    ) {
        if (!member.permissionsIn(channel).has("SendMessages")) {
            await this.replyEphemeral(
                interaction,
                `You don't have permission to ${actionLabel}. Please contact an administrator.`,
            );
            return false;
        }
        return true;
    }
}
