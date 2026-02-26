import {Ranks, Trainings, Units} from "../../../../../prisma/generated/enums";

export class UserEntity {
    id: bigint;
    displayName: string;
    rank: Ranks;
    formattedShortRank: string;
    formattedRank: string;
    unit: Units | null;
    formattedUnit: string | null;
    trainings: Trainings[];
    formattedTrainings: string[];

    constructor(partial: Partial<UserEntity>) {
        Object.assign(this, partial);
    }
}
