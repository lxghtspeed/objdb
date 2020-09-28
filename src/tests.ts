import { LocalFile } from './database';

export class Main {

	public static database: LocalFile;

	public static main(args: string[]): void {
		this.database = new LocalFile({ defaults: { test: { success: false } } });
		
		if (args[0] == 'test') {
			this.database.test.success = true;
		}

		console.log(this);
	}

}
