import { LocalFile } from './database';
import { Collection, Snowflake } from 'discord.js';

interface Ban {
	id: Snowflake;
	expires: number;
	guild: Snowflake;
}

interface Mute {
	id: Snowflake;
	expires: number;
	channel: Snowflake;
	role: Snowflake;
	guild: Snowflake;
}

interface ChannelLogs {
	id: Snowflake;
	logs: string[]
}

interface ModDb extends LocalFile {
	bans: Collection<Snowflake, Ban>;
	mutes: Collection<Snowflake, Mute>;
	logs: Collection<Snowflake, ChannelLogs>;
}

export class Main {

	public static main(args: string[]): void {
		const db: ModDb = <any> new LocalFile({
			name: 'modDb',
			constructors: [Collection]
		});

		db.logs.first()?.logs.push('test')

		console.log(db.logs.first())
	}

}
