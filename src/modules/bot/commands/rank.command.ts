import {RankAutocompleteInterceptor} from "../interceptors/rank-autocomplete.interceptor";
import {Injectable, UseInterceptors} from "@nestjs/common";
import {CommandService} from "../services/command.service";
import {SetRankDto} from "../models/dto/set-rank.dto";
import {RankService} from "../services/rank.service";
import * as necord from "necord";

@Injectable()
export class RankCommand {
    constructor(
        private readonly rankService: RankService,
        private readonly commandService: CommandService,
    ) {}

    @UseInterceptors(RankAutocompleteInterceptor)
    @necord.SlashCommand({
        name: "set-rank",
        description: "Poste une promotion/demotion dans le registre",
    })
    async setRank(@necord.Context() [interaction]: necord.SlashCommandContext, @necord.Options() args: SetRankDto) {
        if (!(await this.commandService.getGuildOrReply(interaction))) return;
        const rankChannel = await this.commandService.getRankChannelOrReply(interaction);
        if (!rankChannel) return;
        const member = await this.commandService.getMemberOrReply(interaction, BigInt(interaction.user.id));
        if (!member) return;
        if (!(await this.commandService.ensureCanSend(interaction, member, rankChannel, "set ranks"))) return;

        const previousRank = args.member.displayName.match(/^\[([^\]]+)]/)?.[1] ?? "Unknown";
        const newRank = this.rankService.toRankFromLabel(args.rank);
        if (!newRank) {
            return this.commandService.replyEphemeral(interaction, "Invalid rank. Please provide a valid rank.");
        }
        const formattedShortNewRank = this.rankService.formatShortRank(newRank);
        const nameMatch = args.member.displayName.match(/^\[[^\]]+\]\s([a-zA-Z])\.\s(.+)$/);
        if (!nameMatch) {
            return this.commandService.replyEphemeral(
                interaction,
                "Failed to parse player name from nickname. Expected format: [Rank] F. Lastname",
            );
        }
        const updatedName = `${nameMatch[1]}. ${nameMatch[2].trim()}`;
        const updatedNickname = `[${formattedShortNewRank}] ${updatedName}`;

        try {
            await this.rankService.updateUserRank(BigInt(args.member.id), newRank);
            await rankChannel.send({
                content:
                    `**Site 35 | Registre des promotions/demotions**\n\n` +
                    `Nom : <@${args.member.id}>\n` +
                    `Grade precedent : ${previousRank}\n` +
                    `Grade actuel : ${formattedShortNewRank}\n` +
                    `Raison de la promotion/demotion : ${args.reason}`,
            });
            try {
                await args.member.setNickname(updatedNickname);
                return this.commandService.replyEphemeral(
                    interaction,
                    `Changement de grade publie avec succes pour <@${args.member.id}>.`,
                );
            } catch {
                return this.commandService.replyEphemeral(
                    interaction,
                    `Failed to update nickname for <@${args.member.id}>. However, the rank change has been recorded and posted in the register.`,
                );
            }
        } catch (e) {
            return this.commandService.replyEphemeral(interaction, `Failed to set rank: ${e.message}`);
        }
    }
}
