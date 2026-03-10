import {MemberOption, StringOption} from "necord";
import {GuildMember} from "discord.js";
import {Type} from "class-transformer";

export class RemoveMedalDto {
    @MemberOption({
        name: "joueur",
        description: "Nom du joueur",
        required: true,
    })
    @Type(() => Object)
    member: GuildMember;

    @StringOption({
        name: "médaille",
        description: "Nom de la médaille à retirer",
        autocomplete: true,
        required: true,
    })
    medalName: string;
}
