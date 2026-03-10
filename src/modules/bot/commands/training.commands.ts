import {Injectable, UseInterceptors} from "@nestjs/common";
import * as necord from "necord";
import {AddTrainingDto} from "../models/dto/add-training.dto";
import {RemoveTrainingDto} from "../models/dto/remove-training.dto";
import {TrainingAutocompleteInterceptor} from "../interceptors/training-autocomplete.interceptor";
import {TrainingService} from "../services/training.service";
import {CommandService} from "../services/command.service";

@Injectable()
export class TrainingCommands {
    constructor(
        private readonly trainingService: TrainingService,
        private readonly commandService: CommandService,
    ) {}

    @UseInterceptors(TrainingAutocompleteInterceptor)
    @necord.SlashCommand({
        name: "add-training",
        description: "Ajoute une formation au profil de l'utilisateur",
    })
    async addFormation(
        @necord.Context() [interaction]: necord.SlashCommandContext,
        @necord.Options() args: AddTrainingDto,
    ) {
        // Check if sender has permission to write in the training channel
        if (!(await this.commandService.getGuildOrReply(interaction))) return;
        const trainingChannel = await this.commandService.getTrainingChannelOrReply(interaction);
        if (!trainingChannel) return;
        const member = await this.commandService.getMemberOrReply(interaction, BigInt(interaction.user.id));
        if (!member) return;
        if (!(await this.commandService.ensureCanSend(interaction, member, trainingChannel, "add trainings"))) return;
        const training = this.trainingService.toTrainingFromLabel(args.trainingName);
        if (!training) {
            return this.commandService.replyEphemeral(
                interaction,
                "Invalid training name. Please choose a valid training from the autocomplete options.",
            );
        }
        try {
            await this.trainingService.addTraining(BigInt(args.member.id), training);
            await trainingChannel.send({
                content: `**Site 35 | Registre d'attribution des formations**\n\n- Nom : <@${args.member.id}>\n- Grade : ${args.member.displayName.match(/^\[([^\]]+)]/)?.[1] ?? "Unknown"}\n- Formation complétée : ${args.trainingName}`,
                allowedMentions: {
                    parse: [],
                    users: [args.member.id],
                },
            });
            return this.commandService.replyEphemeral(
                interaction,
                `Formation "${args.trainingName}" ajoutée avec succès au profil de <@${args.member.id}>.`,
            );
        } catch (e) {
            return this.commandService.replyEphemeral(interaction, `Failed to add training: ${e.message}`);
        }
    }

    @UseInterceptors(TrainingAutocompleteInterceptor)
    @necord.SlashCommand({
        name: "remove-training",
        description: "Retire une formation du profil de l'utilisateur",
    })
    async removeFormation(
        @necord.Context() [interaction]: necord.SlashCommandContext,
        @necord.Options() args: RemoveTrainingDto,
    ) {
        if (!(await this.commandService.getGuildOrReply(interaction))) return;
        const trainingChannel = await this.commandService.getTrainingChannelOrReply(interaction);
        if (!trainingChannel) return;
        const member = await this.commandService.getMemberOrReply(interaction, BigInt(interaction.user.id));
        if (!member) return;
        if (!(await this.commandService.ensureCanSend(interaction, member, trainingChannel, "remove trainings")))
            return;
        const training = this.trainingService.toTrainingFromLabel(args.trainingName);
        if (!training) {
            return this.commandService.replyEphemeral(
                interaction,
                "Invalid training name. Please choose a valid training from the autocomplete options.",
            );
        }
        try {
            await this.trainingService.removeTraining(BigInt(args.member.id), training);
            return this.commandService.replyEphemeral(
                interaction,
                `Formation "${args.trainingName}" retirée avec succès du profil de <@${args.member.id}>.`,
            );
        } catch (e) {
            return this.commandService.replyEphemeral(interaction, `Failed to remove training: ${e.message}`);
        }
    }
}
