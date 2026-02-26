import {Injectable} from "@nestjs/common";
import {AttachmentBuilder, Colors, EmbedBuilder, Guild, GuildMember} from "discord.js";
import {UserEntity} from "../models/entities/user.entity";
import path from "node:path";

@Injectable()
export class BotEmbedsService {
    getProfileEmbed(user: UserEntity, member: GuildMember, guild: Guild) {
        const logoAttachment = new AttachmentBuilder(
            path.resolve(process.cwd(), "assets", "scp_foundation_logo.webp"),
            {
                name: "scp_foundation_logo.webp",
            },
        );
        const trainings = user.formattedTrainings.length
            ? user.formattedTrainings.map((t) => `• ${t}`).join("\n")
            : "Aucune formation enregistrée";
        const embed = new EmbedBuilder()
            .setColor(Colors.DarkGrey)
            .setAuthor({
                name: "Fondation SCP",
                iconURL: "attachment://scp_foundation_logo.webp",
            })
            .setTitle(`Dossier du personnel`)
            .setDescription(
                "Dossier administratif ████████. Centre de contrôle de l'information ████████. Accès restreint.",
            )
            .setThumbnail(
                member.displayAvatarURL({
                    size: 512,
                    extension: "webp",
                }),
            )
            .addFields(
                {
                    name: "Nom complet",
                    value: user.displayName,
                    inline: true,
                },
                {
                    name: "Grade",
                    value: user.formattedRank,
                    inline: true,
                },
                {
                    name: "Unité",
                    value: user.formattedUnit || "Aucune unité assignée",
                    inline: true,
                },
                {
                    name: "Formations suivies",
                    value: trainings,
                },
                {
                    name: "Secure. Contain. Protect.",
                    value: "",
                },
            )
            .setFooter({
                text: `ID membre : ${member.id} • Registre confidentiel`,
                iconURL: guild.iconURL({size: 128}) ?? undefined,
            })
            .setTimestamp();
        return {
            embed,
            attachments: [logoAttachment],
        };
    }
}
