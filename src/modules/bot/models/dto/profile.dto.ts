import {MemberOption} from "necord";
import {GuildMember} from "discord.js";
import {Type} from "class-transformer";

export class ProfileDto {
    @MemberOption({
        name: "joueur",
        description: "Nom du joueur",
        required: false,
    })
    @Type(() => Object)
    member: GuildMember;
}
