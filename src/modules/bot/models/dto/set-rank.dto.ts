import {MemberOption, StringOption} from "necord";
import {GuildMember} from "discord.js";
import {Type} from "class-transformer";

export class SetRankDto {
    @MemberOption({
        name: "joueur",
        description: "Nom du joueur",
        required: true,
    })
    @Type(() => Object)
    member: GuildMember;

    @StringOption({
        name: "grade",
        description: "Nouveau grade du joueur",
        autocomplete: true,
        required: true,
    })
    rank: string;

    @StringOption({
        name: "raison",
        description: "Raison du changement de grade",
        required: true,
    })
    reason: string;
}
