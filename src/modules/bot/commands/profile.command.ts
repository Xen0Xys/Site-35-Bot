import {BotEmbedsService} from "../services/bot-embeds.service";
import {CommandService} from "../services/command.service";
import {MessageFlagsBitField} from "discord.js";
import {Injectable} from "@nestjs/common";
import * as necord from "necord";
import {ProfileDto} from "../models/dto/profile.dto";
import {MedalService} from "../services/medal.service";

@Injectable()
export class ProfileCommand {
    constructor(
        private readonly botEmbedsService: BotEmbedsService,
        private readonly commandService: CommandService,
        private readonly medalService: MedalService,
    ) {}

    @necord.SlashCommand({
        name: "profile",
        description: "Get user profile",
    })
    async getProfile(@necord.Context() [interaction]: necord.SlashCommandContext, @necord.Options() args: ProfileDto) {
        let userId: bigint;
        if (args.member) userId = BigInt(args.member.id);
        else userId = BigInt(interaction.user.id);
        const user = await this.commandService.getUserOrReply(interaction, userId);
        if (!user) return;
        const member = await this.commandService.getMemberOrReply(interaction, userId);
        if (!member) return;
        const guild = await this.commandService.getGuildOrReply(interaction);
        if (!guild) return;

        const {medals, formattedMedals} = this.medalService.getMemberMedals(member);
        const {embed, attachments} = this.botEmbedsService.getProfileEmbed(user, member, guild, {
            medals,
            formattedMedals,
        });

        return interaction.reply({
            embeds: [embed],
            files: attachments,
            flags: MessageFlagsBitField.Flags.Ephemeral,
        });
    }
}
