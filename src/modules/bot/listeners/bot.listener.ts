import {Injectable, Logger} from "@nestjs/common";
import * as necord from "necord";
import {Client, CommandInteractionOption} from "discord.js";
import {DiscordService} from "../services/discord.service";
import {UserService} from "../services/user.service";
import {SimpleUserEntity} from "../models/entities/simple-user.entity";
import {TrainingService} from "../services/training.service";
import {ConfigService} from "@nestjs/config";
import {RankService} from "../services/rank.service";
import {StatusService} from "../services/status.service";

@Injectable()
export class BotListener {
    private readonly logger = new Logger(BotListener.name);

    constructor(
        private readonly client: Client,
        private readonly discordService: DiscordService,
        private readonly userService: UserService,
        private readonly trainingService: TrainingService,
        private readonly configService: ConfigService,
        private readonly rankService: RankService,
        private readonly statusService: StatusService,
    ) {}

    @necord.Once("clientReady")
    async onReady() {
        // Initial sync: users, trainings, and status messages.
        const users: SimpleUserEntity[] = await this.discordService.getGuildMembers();
        await this.userService.registerUsers(users);
        await this.trainingService.registerTrainings();
        await Promise.all([this.statusService.updateBotActivity(), this.statusService.updateStatusMessages()]);
        this.logger.log(`Bot logged in as ${this.client.user?.username}`);
    }

    @necord.On("warn")
    onWarn(@necord.Context() [message]: necord.ContextOf<"warn">) {
        this.logger.warn(message);
    }

    @necord.On("error")
    onError(@necord.Context() [error]: necord.ContextOf<"error">) {
        this.logger.error(error);
    }

    @necord.On("messageCreate")
    async onMessageCreate(@necord.Context() [message]: necord.ContextOf<"messageCreate">) {
        if (message.author.bot) return;
        switch (message.channelId) {
            case this.configService.get<string>("DISCORD_TRAINING_CHANNEL_ID"):
                // Parse new training messages to update user trainings.
                await this.trainingService.registerTrainingsFromMessage(message.content);
                break;
            case this.configService.get<string>("DISCORD_PROMO_DEMO_CHANNEL_ID"):
                // Parse promotion/demotion messages to update user ranks.
                await this.rankService.registerPromoDemoFromMessage(message.content);
                break;
        }
    }

    @necord.On("messageDelete")
    async onMessageDelete(@necord.Context() [message]: necord.ContextOf<"messageDelete">) {
        switch (message.channelId) {
            case this.configService.get<string>("DISCORD_TRAINING_CHANNEL_ID"):
                // Remove trainings associated with the deleted message.
                const sanitizedMessage = this.trainingService.sanitizeMessages([message.content || ""]);
                if (!sanitizedMessage || !sanitizedMessage[0]) {
                    this.logger.warn(`Failed to sanitize deleted training message: ${message.content}`);
                    return;
                }
                await this.trainingService.removeTraining(sanitizedMessage[0].userId, sanitizedMessage[0].training);
                break;
        }
    }

    @necord.On("guildMemberNicknameUpdate")
    async onGuildMemberNicknameUpdate(@necord.Context() [member]: necord.ContextOf<"guildMemberNicknameUpdate">) {
        await this.syncMember(member, "Guild member nickname updated");
    }

    @necord.On("guildMemberRoleAdd")
    async onGuildMemberRoleAdd(@necord.Context() [member, role]: necord.ContextOf<"guildMemberRoleAdd">) {
        if (
            ![
                this.discordService.siteSecurityRoleId,
                this.discordService.xi8RoleId,
                this.discordService.alpha1RoleId,
            ].includes(role.id)
        )
            return;
        await this.syncMember(member, "Guild member role added");
    }

    @necord.On("guildMemberRoleRemove")
    async onGuildMemberRoleRemove(@necord.Context() [member, role]: necord.ContextOf<"guildMemberRoleRemove">) {
        if (
            ![
                this.discordService.siteSecurityRoleId,
                this.discordService.xi8RoleId,
                this.discordService.alpha1RoleId,
            ].includes(role.id)
        )
            return;
        await this.syncMember(member, "Guild member role removed");
    }

    @necord.On("interactionCreate")
    onInteraction(@necord.Context() [interaction]: necord.ContextOf<"interactionCreate">) {
        if (!interaction.isChatInputCommand()) return;
        const username = interaction.user ? interaction.user.username : "Unknown user";
        const guildName = interaction.guild ? interaction.guild.name : "DM";
        const channelName = interaction.channel && "name" in interaction.channel ? interaction.channel.name : "DM";
        this.logger.log(
            `SLASH_COMMAND ${interaction.commandName} ` +
                `[${guildName}] [${username}] [${channelName}] ` +
                `${JSON.stringify(interaction.options.data.map((o: CommandInteractionOption): any => ({name: o.name, value: o.value})))}`,
        );
    }

    private async syncMember(member: necord.ContextOf<"guildMemberNicknameUpdate">[0], reason: string) {
        const user = new SimpleUserEntity({
            id: BigInt(member.id),
            displayName: member.displayName,
            unit: this.discordService.getMemberUnit(member),
        });
        this.logger.log(`${reason} for ${member.id}, syncing user data...`);
        await this.userService.registerOrUpdateUser(user);
    }
}
