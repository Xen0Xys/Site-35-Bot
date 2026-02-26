import {MemberOption, StringOption} from "necord";
import {GuildMember} from "discord.js";
import {Type} from "class-transformer";

export class AddTrainingDto {
    @MemberOption({
        name: "joueur",
        description: "Nom du joueur",
        required: true,
    })
    @Type(() => Object)
    member: GuildMember;

    @StringOption({
        name: "formation",
        description: "Nom de la formation à ajouter",
        autocomplete: true,
        required: true,
    })
    trainingName: string;
}
