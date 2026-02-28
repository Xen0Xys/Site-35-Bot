import {Injectable, Logger} from "@nestjs/common";
import * as necord from "necord";
import {Client, CommandInteractionOption} from "discord.js";
import {DiscordService} from "../services/discord.service";
import {UserService} from "../services/user.service";
import {SimpleUserEntity} from "../models/entities/simple-user.entity";
import {TrainingService} from "../services/training.service";
import {ConfigService} from "@nestjs/config";
import {RankService} from "../services/rank.service";
import {Units} from "../../../../prisma/generated/enums";
import {StatusService} from "../services/status.service";

@Injectable()
export class BotListener {
    private readonly logger = new Logger(BotListener.name);
    private readonly xi8RoleId: string;
    private readonly alpha1RoleId: string;

    constructor(
        private readonly client: Client,
        private readonly discordService: DiscordService,
        private readonly userService: UserService,
        private readonly trainingService: TrainingService,
        private readonly configService: ConfigService,
        private readonly rankService: RankService,
        private readonly statusService: StatusService,
    ) {
        this.xi8RoleId = this.configService.get<string>("DISCORD_XI_8_ROLE_ID") || "";
        this.alpha1RoleId = this.configService.get<string>("DISCORD_ALPHA_1_ROLE_ID") || "";
    }

    @necord.Once("clientReady")
    async onReady() {
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
                await this.trainingService.registerTrainingsFromMessage(message.content);
                break;
            case this.configService.get<string>("DISCORD_PROMO_DEMO_CHANNEL_ID"):
                await this.rankService.registerPromoDemoFromMessage(message.content);
                break;
        }
    }

    @necord.On("guildMemberNicknameUpdate")
    async onGuildMemberNicknameUpdate(@necord.Context() [member]: necord.ContextOf<"guildMemberNicknameUpdate">) {
        await this.syncMember(member, "Guild member nickname updated");
    }

    @necord.On("guildMemberRoleAdd")
    async onGuildMemberRoleAdd(@necord.Context() [member, role]: necord.ContextOf<"guildMemberRoleAdd">) {
        if (![this.xi8RoleId, this.alpha1RoleId].includes(role.id)) return;
        await this.syncMember(member, "Guild member role added");
    }

    @necord.On("guildMemberRoleRemove")
    async onGuildMemberRoleRemove(@necord.Context() [member, role]: necord.ContextOf<"guildMemberRoleRemove">) {
        if (![this.xi8RoleId, this.alpha1RoleId].includes(role.id)) return;
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

    private getMemberUnit(member: necord.ContextOf<"guildMemberNicknameUpdate">[0]) {
        const hasXi8Role = this.xi8RoleId ? member.roles.cache.has(this.xi8RoleId) : false;
        const hasAlpha1Role = this.alpha1RoleId ? member.roles.cache.has(this.alpha1RoleId) : false;
        if (hasAlpha1Role) return Units.ALPHA_1;
        if (hasXi8Role) return Units.XI_8;
        return null;
    }

    private async syncMember(member: necord.ContextOf<"guildMemberNicknameUpdate">[0], reason: string) {
        const user = new SimpleUserEntity({
            id: BigInt(member.id),
            displayName: member.displayName,
            unit: this.getMemberUnit(member),
        });
        this.logger.log(`${reason} for ${member.id}, syncing user data...`);
        await this.userService.registerOrUpdateUser(user);
    }
}
