export class ServerDataEntity {
    name: string;
    players: number;
    maxPlayers: number;
    status: string;
    map: string;

    constructor(partial: Partial<ServerDataEntity>) {
        Object.assign(this, partial);
    }
}
