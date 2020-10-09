import FileSystem from 'fs';
import Timers from 'timers';
import Path from 'path';
import { promises as FileSystemAsync } from 'fs';
import { Internal, VersionError } from './utility';
import { Serializer, SerializerLegacy } from './serialization';

class DBInternal {

	public readonly filePath: string;

	public readonly path: string;

	public readonly serializer: Serializer = new Serializer([Database, LocalFile]);

	public data!: string;

	public static readonly opened: Map<string, Database> = new Map();

	constructor(path: string, filePath: string) {
		this.path = path;
		this.filePath = filePath;
	}

}

interface DatabaseOptions {
	/** The name of the database */
	name?: string;

	/** The path where the database will be stored  */
	path?: string;

	/** The default values of the database */
	defaults?: {[key: string]: any; [index: number]: any};

	/** The constructors to use when restoring the prototypes */
	constructors?: Function[];
}

export class Database extends Internal<DBInternal> {
	[key: string]: any;
	[index: number]: any;

	public static defaultPath: string = Path.resolve('./data');

	constructor(options: DatabaseOptions = {}) {
		const name: string = typeof options.name === 'string' ? options.name : 'default';
		const path: string = Path.resolve(typeof options.path === 'string' ? options.path : Database.defaultPath);
		const filePath: string = Path.join(path, name + '.json');
		const opened: Database | undefined = DBInternal.opened.get(filePath);

		if (opened) {
			return opened;
		}

		const internal: DBInternal = new DBInternal(path, filePath);
		const serializerLegacy: SerializerLegacy = new SerializerLegacy([Database, LocalFile]);

		if (options.constructors instanceof Array) {
			for (const ctr of options.constructors) {
				internal.serializer.constructors.push(ctr);
				serializerLegacy.prototypes.add(ctr);
			}
		}

		super(internal);

		if (FileSystem.existsSync(internal.filePath)) {
			const rawData: string = FileSystem.readFileSync(internal.filePath).toString();
			let data: any;

			try {
				data = internal.serializer.deserialize(rawData);
			} catch (e) {
				if (!(e instanceof VersionError)) {
					throw e;
				}
				
				data = serializerLegacy.deserialize(rawData);
			}

			for (const key in data) {
				this[key] = data[key];
			}
		}

		if (options.defaults instanceof Object) {
			const defaults: any = options.defaults;

			for (const key in defaults) {
				if (!(key in this)) {
					this[key] = defaults[key];
				}
			}
		}

		internal.data = internal.serializer.serialize(this);

		DBInternal.opened.set(filePath, this);
		Timers.setInterval(() => this.watch(), 16000).unref();
		process.on('exit', () => this.watchSync());
	}

	private async watch(): Promise<void> {
		const a: string = this.internal.data;
		const b: string = this.internal.serializer.serialize(this);

		if (a !== b) {
			await this.save(b);
		}
	}

	private watchSync(): void {
		const a: string = this.internal.data;
		const b: string = this.internal.serializer.serialize(this);

		if (a !== b) {
			this.saveSync(b);
		}
	}

	private async save(serialized: string): Promise<void> {
		if (!FileSystem.existsSync(this.internal.path)) {
			await FileSystemAsync.mkdir(this.internal.path, {recursive: true});
		}

		await FileSystemAsync.writeFile(this.internal.filePath, serialized);

		this.internal.data = serialized;
	}

	private saveSync(serialized: string): void {
		if (!FileSystem.existsSync(this.internal.path)) {
			FileSystem.mkdirSync(this.internal.path, {recursive: true});
		}

		FileSystem.writeFileSync(this.internal.filePath, serialized);

		this.internal.data = serialized;
	}

}

class LocalFile extends Database {} // Fix for legacy databases
