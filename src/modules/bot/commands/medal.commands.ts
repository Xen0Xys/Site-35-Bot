import {Injectable, UseInterceptors} from "@nestjs/common";
import * as necord from "necord";
import {AddMedalDto} from "../models/dto/add-medal.dto";
import {RemoveMedalDto} from "../models/dto/remove-medal.dto";
import {MedalAutocompleteInterceptor} from "../interceptors/medal-autocomplete.interceptor";
import {MedalService} from "../services/medal.service";
import {CommandService} from "../services/command.service";

@Injectable()
export class MedalCommands {
    constructor(
        private readonly medalService: MedalService,
        private readonly commandService: CommandService,
    ) {}

    @UseInterceptors(MedalAutocompleteInterceptor)
    @necord.SlashCommand({
        name: "add-medal",
        description: "Ajoute une médaille au profil de l'utilisateur",
    })
    async addMedal(@necord.Context() [interaction]: necord.SlashCommandContext, @necord.Options() args: AddMedalDto) {
        if (!(await this.commandService.getGuildOrReply(interaction))) return;
        const medalChannel = await this.commandService.getMedalChannelOrReply(interaction);
        if (!medalChannel) return;
        const member = await this.commandService.getMemberOrReply(interaction, BigInt(interaction.user.id));
        if (!member) return;
        if (!(await this.commandService.ensureCanSend(interaction, member, medalChannel, "add medals"))) return;
        const medal = this.medalService.toMedalFromLabel(args.medalName);
        if (!medal) {
            return this.commandService.replyEphemeral(
                interaction,
                "Invalid medal name. Please choose a valid medal from the autocomplete options.",
            );
        }
        const roleId = this.medalService.getMedalRoleId(medal);
        if (!roleId) {
            return this.commandService.replyEphemeral(
                interaction,
                "Invalid medal role configuration. Please check the bot configuration.",
            );
        }
        try {
            await this.medalService.addMedal(BigInt(args.member.id), medal);
            await medalChannel.send({
                content: `**Site 35 | Registre d'attribution des médailles**\n\n- Nom : <@${args.member.id}>\n- Médaille attribuée : <@&${roleId}>\n- Contexte : ${args.contexte}`,
            });
            return this.commandService.replyEphemeral(
                interaction,
                `Médaille "${args.medalName}" ajoutée avec succès au profil de <@${args.member.id}>.`,
            );
        } catch (e) {
            return this.commandService.replyEphemeral(interaction, `Failed to add medal: ${e.message}`);
        }
    }

    @UseInterceptors(MedalAutocompleteInterceptor)
    @necord.SlashCommand({
        name: "remove-medal",
        description: "Retire une médaille du profil de l'utilisateur",
    })
    async removeMedal(
        @necord.Context() [interaction]: necord.SlashCommandContext,
        @necord.Options() args: RemoveMedalDto,
    ) {
        if (!(await this.commandService.getGuildOrReply(interaction))) return;
        const medalChannel = await this.commandService.getMedalChannelOrReply(interaction);
        if (!medalChannel) return;
        const member = await this.commandService.getMemberOrReply(interaction, BigInt(interaction.user.id));
        if (!member) return;
        if (!(await this.commandService.ensureCanSend(interaction, member, medalChannel, "remove medals"))) return;
        const medal = this.medalService.toMedalFromLabel(args.medalName);
        if (!medal) {
            return this.commandService.replyEphemeral(
                interaction,
                "Invalid medal name. Please choose a valid medal from the autocomplete options.",
            );
        }
        try {
            await this.medalService.removeMedal(BigInt(args.member.id), medal);
            return this.commandService.replyEphemeral(
                interaction,
                `Médaille "${args.medalName}" retirée avec succès du profil de <@${args.member.id}>.`,
            );
        } catch (e) {
            return this.commandService.replyEphemeral(interaction, `Failed to remove medal: ${e.message}`);
        }
    }
}
