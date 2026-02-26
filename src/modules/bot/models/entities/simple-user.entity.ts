import {Units} from "../../../../../prisma/generated/enums";

export class SimpleUserEntity {
    id: bigint;
    displayName: string;
    unit: Units | null;

    constructor(partial: Partial<SimpleUserEntity>) {
        Object.assign(this, partial);
    }
}
