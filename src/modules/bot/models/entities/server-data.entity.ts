export class ServerDataEntity {
    name: string;
    players: number;
    maxPlayers: number;
    status: string;
    modCount: number;
    map: string;

    constructor(partial: Partial<ServerDataEntity>) {
        Object.assign(this, partial);
    }
}
