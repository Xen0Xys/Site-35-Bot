import {Injectable} from "@nestjs/common";
import {AttachmentBuilder, Colors, EmbedBuilder, Guild, GuildMember} from "discord.js";
import {UserEntity} from "../models/entities/user.entity";
import path from "node:path";
import {ServerDataEntity} from "../models/entities/server-data.entity";
import {Medals} from "../../../../prisma/generated/enums";

@Injectable()
export class BotEmbedsService {
    getProfileEmbed(
        user: UserEntity,
        member: GuildMember,
        guild: Guild,
        medals?: {medals: Medals[]; formattedMedals: string[]},
    ) {
        const logoAttachment = new AttachmentBuilder(
            path.resolve(process.cwd(), "assets", "scp_foundation_logo.webp"),
            {
                name: "scp_foundation_logo.webp",
            },
        );
        const trainingLabelsByType = new Map(
            user.trainings.map((training, index) => [training, user.formattedTrainings[index]]),
        );
        const qualificationTypes = new Set(["FIM", "CQC", "FIRST_AID", "HELICOPTER_LICENSE", "HEAVY_VEHICLE_LICENSE"]);
        const instructorTrainings = user.trainings.filter((training) => training.endsWith("_INSTRUCTOR"));
        const qualificationTrainings = user.trainings.filter(
            (training) => !training.endsWith("_INSTRUCTOR") && qualificationTypes.has(training),
        );
        const specialtyTrainings = user.trainings.filter(
            (training) => !training.endsWith("_INSTRUCTOR") && !qualificationTypes.has(training),
        );
        const formatTrainings = (trainings: typeof user.trainings, emptyMessage: string) =>
            trainings.length
                ? trainings
                      .map((training) => trainingLabelsByType.get(training))
                      .filter((label): label is string => Boolean(label))
                      .sort((a, b) => a.localeCompare(b, "fr"))
                      .map((label) => `• ${label}`)
                      .join("\n")
                : emptyMessage;
        const specialties = formatTrainings(specialtyTrainings, "Aucune");
        const qualifications = formatTrainings(qualificationTrainings, "Aucune");
        const instructors = formatTrainings(instructorTrainings, "Non");
        const medalLabelsByType = medals
            ? new Map(medals.medals.map((medal, index) => [medal, medals.formattedMedals[index]]))
            : new Map();
        const formattedMedals = medals?.medals?.length
            ? medals.medals
                  .map((medal) => medalLabelsByType.get(medal))
                  .filter((label): label is string => Boolean(label))
                  .sort((a, b) => a.localeCompare(b, "fr"))
                  .map((label) => `• ${label}`)
                  .join("\n")
            : "Aucune";

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
                    name: "Spécialités",
                    value: specialties,
                    inline: true,
                },
                {
                    name: "Qualifications",
                    value: qualifications,
                    inline: true,
                },
                {
                    name: "Instructeur",
                    value: instructors,
                    inline: true,
                },
                {
                    name: "Médailles",
                    value: formattedMedals,
                    inline: true,
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

    getStatusEmbed(serverData: ServerDataEntity) {
        const logoAttachment = new AttachmentBuilder(
            path.resolve(process.cwd(), "assets", "scp_foundation_logo.webp"),
            {
                name: "scp_foundation_logo.webp",
            },
        );

        const isOnline = serverData.status === "online";
        const statusLabel = isOnline ? "En ligne" : "Hors ligne";
        const statusEmoji = isOnline ? "🟢" : "🔴";

        const embed = new EmbedBuilder()
            .setColor(isOnline ? Colors.Green : Colors.Red)
            .setAuthor({
                name: "Fondation SCP",
                iconURL: "attachment://scp_foundation_logo.webp",
            })
            .setTitle("Statut du serveur")
            .setDescription("Canal de surveillance ████ Site-35. Flux de télémétrie en temps réel. Accès restreint.")
            .addFields(
                {
                    name: "Serveur",
                    value: serverData.name,
                },
                {
                    name: "Statut",
                    value: `${statusEmoji} ${statusLabel}`,
                    inline: true,
                },
                {
                    name: "Joueurs",
                    value: `${serverData.players}/${serverData.maxPlayers}`,
                    inline: true,
                },
                {
                    name: "Carte",
                    value: serverData.map,
                    inline: true,
                },
                {
                    name: "Secure. Contain. Protect.",
                    value: "",
                },
            )
            .setTimestamp();

        return {
            embed,
            attachments: [logoAttachment],
        };
    }
}
