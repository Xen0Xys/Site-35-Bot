import {Injectable} from "@nestjs/common";
import * as necord from "necord";
import {
    ActionRowBuilder,
    ComponentType,
    GuildTextBasedChannel,
    LabelBuilder,
    MessageFlagsBitField,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import {DiscordService} from "../services/discord.service";

const APPLY_MODAL_ID = "apply-modal";
const FIELD_RP_NAME = "rp-name";
const FIELD_COUNTRY = "country";
const FIELD_SOURCE = "source";
const FIELD_VALIDATION = "validation";
const RP_NAME_MAX_LENGTH = 64;
const COUNTRY_MAX_LENGTH = 56;
const SOURCE_MAX_LENGTH = 800;
const VALIDATION_MAX_LENGTH = 16;

@Injectable()
export class ApplyCommand {
    constructor(private readonly discordService: DiscordService) {}

    @necord.SlashCommand({
        name: "apply",
        description: "Ouvre le formulaire de candidature.",
    })
    async apply(@necord.Context() [interaction]: necord.SlashCommandContext) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: "Cette commande doit être utilisée dans un serveur.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const blockedRoles = [
            this.discordService.siteSecurityRoleId,
            this.discordService.xi8RoleId,
            this.discordService.alpha1RoleId,
        ];
        if (blockedRoles.some((roleId) => roleId && interaction.member.roles.cache.has(roleId))) {
            return interaction.reply({
                content: "Vous ne pouvez pas utiliser cette commande.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const rpNameInput = new TextInputBuilder({
            customId: FIELD_RP_NAME,
            label: "Prénom et Nom RP",
            placeholder: "Prénom et nom RP complet (Ex: Ethan Cole)",
            style: TextInputStyle.Short,
            maxLength: RP_NAME_MAX_LENGTH,
            required: true,
        });

        const countryInput = new TextInputBuilder({
            customId: FIELD_COUNTRY,
            label: "Pays",
            style: TextInputStyle.Short,
            maxLength: COUNTRY_MAX_LENGTH,
            required: true,
        });

        const sourceInput = new TextInputBuilder({
            customId: FIELD_SOURCE,
            label: "Comment avez-vous connu le serveur ?",
            style: TextInputStyle.Short,
            maxLength: SOURCE_MAX_LENGTH,
            required: true,
        });

        const validationInput = new TextInputBuilder({
            customId: FIELD_VALIDATION,
            placeholder: "Merci d'écrire \"J'accepte\" pour confirmer les instructions ci-dessus",
            style: TextInputStyle.Short,
            maxLength: VALIDATION_MAX_LENGTH,
            required: true,
        });

        const infoRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rpNameInput);
        const countryRow = new ActionRowBuilder<TextInputBuilder>().addComponents(countryInput);
        const sourceRow = new ActionRowBuilder<TextInputBuilder>().addComponents(sourceInput);
        const validationInfo = {
            type: ComponentType.TextDisplay,
            content: `### Une fois votre candidature envoyée, il vous suffira d'attendre qu'elle soit traitée. Pour les questions, directions <#${process.env.DISCORD_QUESTIONS_CHANNEL_ID ?? "1000000000000000000"}>`,
        };

        const validationLabel = new LabelBuilder({
            label: "Validation",
        }).setTextInputComponent(validationInput);

        await interaction.showModal(
            new ModalBuilder({
                customId: APPLY_MODAL_ID,
                title: "Formulaire de candidature",
                components: [infoRow, countryRow, sourceRow, validationInfo, validationLabel],
            }),
        );
    }

    @necord.Modal(APPLY_MODAL_ID)
    async onApplyModal(@necord.Context() [interaction]: necord.ModalContext) {
        const validation = interaction.fields.getTextInputValue(FIELD_VALIDATION).trim();
        if (validation !== "J'accepte") {
            return interaction.reply({
                content: "Validation invalide. Merci d'écrire `J'accepte`.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const applyChannelId = process.env.DISCORD_APPLY_CHANNEL_ID;
        if (!applyChannelId || !interaction.guild) {
            return interaction.reply({
                content:
                    "Le channel de candidature est introuvable ou n'est pas textuel. Vérifiez la configuration du bot.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const channel = await interaction.guild.channels.fetch(applyChannelId).catch(() => null);

        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
            return interaction.reply({
                content:
                    "Le channel de candidature est introuvable ou n'est pas textuel. Vérifiez la configuration du bot.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const rpName = this.normalizeAlphaWords(interaction.fields.getTextInputValue(FIELD_RP_NAME), 2);
        if (!rpName) {
            return interaction.reply({
                content:
                    "Le champ Prénom / Nom RP doit contenir au moins deux parties composées uniquement de lettres et d'espaces.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const country = this.normalizeAlphaWords(interaction.fields.getTextInputValue(FIELD_COUNTRY), 1);
        if (!country) {
            return interaction.reply({
                content: "Le champ Pays doit contenir uniquement des lettres et des espaces.",
                flags: MessageFlagsBitField.Flags.Ephemeral,
            });
        }

        const source = interaction.fields.getTextInputValue(FIELD_SOURCE).trim();

        await (channel as GuildTextBasedChannel).send({
            content:
                `- Pseudo : <@${interaction.user.id}>\n` +
                `- Prénom / Nom RP : ${rpName}\n` +
                `- Pays : ${country}\n` +
                `- Comment avez-vous connu le serveur : ${source}`,
            allowedMentions: {
                parse: [],
            },
        });

        return interaction.reply({
            content: "Votre candidature a bien été envoyée.",
            flags: MessageFlagsBitField.Flags.Ephemeral,
        });
    }

    private normalizeAlphaWords(input: string, minParts: number): string | null {
        const trimmed = input.trim();
        if (!trimmed) return null;
        if (!/^[\p{L}\s]+$/u.test(trimmed)) return null;

        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length < minParts) return null;

        return parts
            .map((part) => {
                const normalized = part.toLowerCase();
                return normalized.charAt(0).toUpperCase() + normalized.slice(1);
            })
            .join(" ");
    }
}
