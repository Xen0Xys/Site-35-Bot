import {BotEmbedsService} from "../services/bot-embeds.service";
import {CommandService} from "../services/command.service";
import {StatusService} from "../services/status.service";
import {Injectable} from "@nestjs/common";
import * as necord from "necord";
import {GuildTextBasedChannel, Message, MessageFlagsBitField} from "discord.js";

@Injectable()
export class StatusCommands {
    constructor(
        private readonly statusService: StatusService,
        private readonly botEmbedsService: BotEmbedsService,
        private readonly commandService: CommandService,
    ) {}

    @necord.SlashCommand({
        name: "status",
        description: "Renvoie le status actuel du serveur.",
    })
    async status(@necord.Context() [interaction]: necord.SlashCommandContext) {
        const serverData = await this.statusService.fetchServerData();
        if (!serverData) {
            await this.commandService.replyEphemeral(
                interaction,
                "Impossible de récupérer les données du serveur pour le moment. Veuillez réessayer plus tard.",
            );
            return;
        }
        const embed = this.botEmbedsService.getStatusEmbed(serverData);
        await interaction.reply({
            embeds: [embed.embed],
            files: embed.attachments,
            flags: MessageFlagsBitField.Flags.Ephemeral,
        });
    }

    @necord.SlashCommand({
        name: "display-status",
        description: "Affiche le status du serveur dans le channel actuel.",
    })
    async displayStatus(@necord.Context() [interaction]: necord.SlashCommandContext) {
        const serverData = await this.statusService.fetchServerData();
        if (!serverData) {
            await this.commandService.replyEphemeral(
                interaction,
                "Impossible de récupérer les données du serveur pour le moment. Veuillez réessayer plus tard.",
            );
            return;
        }
        const embed = this.botEmbedsService.getStatusEmbed(serverData);
        if (!interaction.inCachedGuild()) {
            await this.commandService.replyEphemeral(interaction, "Cette commande doit être utilisée dans un serveur.");
            return;
        }
        const channel = await interaction.guild.channels.fetch(interaction.channelId);
        if (!channel || !channel.isTextBased()) {
            await this.commandService.replyEphemeral(
                interaction,
                "Ce channel n'est pas textuel. Veuillez utiliser cette commande dans un channel textuel.",
            );
            return;
        }
        const message: Message = await (channel as GuildTextBasedChannel).send({
            embeds: [embed.embed],
            files: embed.attachments,
        });
        await this.statusService.trackStatusMessage(BigInt(channel.id), BigInt(message.id));
        await this.commandService.replyEphemeral(interaction, "Status du serveur affiché dans le channel actuel.");
    }
}
