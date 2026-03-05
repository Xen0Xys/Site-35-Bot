import {I18nService} from "../../helper/i18n.service";
import {AutocompleteInteraction} from "discord.js";
import {AutocompleteInterceptor} from "necord";
import {Injectable} from "@nestjs/common";

@Injectable()
export class TrainingAutocompleteInterceptor extends AutocompleteInterceptor {
    constructor(private readonly i18nService: I18nService) {
        super();
    }

    public transformOptions(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused(true);
        let choices: string[] = [];

        if (focused.name === "formation") choices = Object.values(this.i18nService.getTrainingMap());

        return interaction.respond(
            choices
                .filter((choice) => choice.toLowerCase().startsWith(focused.value.toString().toLowerCase()))
                .map((choice) => ({name: choice, value: choice})),
        );
    }
}
