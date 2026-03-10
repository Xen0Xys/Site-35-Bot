import {MemberOption, StringOption} from "necord";
import {GuildMember} from "discord.js";
import {Type} from "class-transformer";

export class AddMedalDto {
    @MemberOption({
        name: "joueur",
        description: "Nom du joueur",
        required: true,
    })
    @Type(() => Object)
    member: GuildMember;

    @StringOption({
        name: "médaille",
        description: "Nom de la médaille à ajouter",
        autocomplete: true,
        required: true,
    })
    medalName: string;

    @StringOption({
        name: "contexte",
        description: "Contexte de l'attribution de la médaille",
        required: true,
    })
    contexte: string;
}
