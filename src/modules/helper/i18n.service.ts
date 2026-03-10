import {Injectable} from "@nestjs/common";
import {Medals, Ranks, Trainings, Units} from "../../../prisma/generated/enums";

@Injectable()
export class I18nService {
    formatRank(rank: Ranks): string {
        switch (rank) {
            case Ranks.CMD:
                return "Commandant";
            case Ranks.MJR:
                return "Major";
            case Ranks.CPT:
                return "Capitaine";
            case Ranks.LTN:
                return "Lieutenant";
            case Ranks.S_LTN:
                return "Sous-Lieutenant";
            case Ranks.ADJ_C:
                return "Adjudant-Chef";
            case Ranks.ADJ:
                return "Adjudant";
            case Ranks.SGT_C:
                return "Sergent-Chef";
            case Ranks.SGT:
                return "Sergent";
            case Ranks.CPL_C:
                return "Caporal-Chef";
            case Ranks.CPL:
                return "Caporal";
            case Ranks.SDT_1C:
                return "Soldat de 1ère Classe";
            case Ranks.SDT_2C:
                return "Soldat de 2ème Classe";
            case Ranks.SDT_3C:
                return "Soldat de 3ème Classe";
            case Ranks.SDT:
                return "Soldat";
            case Ranks.CDT:
                return "Cadet";
            default:
                return rank;
        }
    }

    getRankMap(): Record<Ranks, string> {
        const map: Record<Ranks, string> = {} as Record<Ranks, string>;
        for (const rank in Ranks) {
            const rankKey = rank as keyof typeof Ranks;
            const rankValue = Ranks[rankKey];
            map[rankValue] = this.formatRank(rankValue);
        }
        return map;
    }

    formatTraining(training: Trainings): string {
        switch (training) {
            case Trainings.FIM:
                return "FIM";
            case Trainings.FIM_INSTRUCTOR:
                return "Instructeur FIM";
            case Trainings.CQC:
                return "CQC";
            case Trainings.CQC_INSTRUCTOR:
                return "Instructeur CQC";
            case Trainings.FIRST_AID:
                return "Premiers Secours";
            case Trainings.FIRST_AID_INSTRUCTOR:
                return "Instructeur Premiers Secours";
            case Trainings.BREACHER:
                return "Breacher";
            case Trainings.GRENADE_LAUNCHER:
                return "Lance-Grenades";
            case Trainings.FLAMETHROWER:
                return "Lance-Flammes";
            case Trainings.ANTI_TANK:
                return "Anti-Tank";
            case Trainings.ARTIFICIER:
                return "Artificier";
            case Trainings.SNIPER:
                return "Sniper";
            case Trainings.MACHINE_GUNNER:
                return "Fusilier Mitrailleur";
            case Trainings.MEDIC:
                return "Médecin";
            case Trainings.DRONE:
                return "Drone";
            default:
                return training;
        }
    }

    getTrainingMap(): Record<Trainings, string> {
        const map: Record<Trainings, string> = {} as Record<Trainings, string>;
        for (const training in Trainings) {
            const trainingKey = training as keyof typeof Trainings;
            const trainingValue = Trainings[trainingKey];
            map[trainingValue] = this.formatTraining(trainingValue);
        }
        return map;
    }

    formatMedal(medal: Medals): string {
        switch (medal) {
            case Medals.CROSS_OF_TACTICAL_SUPREMACY:
                return "Croix de Suprematie Tactique";
            default:
                return medal;
        }
    }

    getMedalMap(): Record<Medals, string> {
        const map: Record<Medals, string> = {} as Record<Medals, string>;
        for (const medal in Medals) {
            const medalKey = medal as keyof typeof Medals;
            const medalValue = Medals[medalKey];
            map[medalValue] = this.formatMedal(medalValue);
        }
        return map;
    }

    formatUnit(unit: Units): string {
        switch (unit) {
            case Units.SITE_SECURITY:
                return "Sécurité du Site";
            case Units.XI_8:
                return "Ξ-8";
            case Units.ALPHA_1:
                return "α-1";
            default:
                return unit;
        }
    }

    getUnitMap(): Record<Units, string> {
        const map: Record<Units, string> = {} as Record<Units, string>;
        for (const unit in Units) {
            const unitKey = unit as keyof typeof Units;
            const unitValue = Units[unitKey];
            map[unitValue] = this.formatUnit(unitValue);
        }
        return map;
    }
}
