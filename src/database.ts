import FileSystem from 'fs';
import Timers from 'timers';
import Path from 'path';
import { promises as FileSystemAsync } from 'fs';
import { EventEmitter } from 'events';
import { Internal, VersionError } from './utility';
import { Serializer as SerializerLegacy } from './serialization/legacy';
import { Serializer } from './serialization';

class DatabaseInternal {

	public readonly filePath: string;

	public readonly path: string;

	public readonly serializer: Serializer = new Serializer();

	public readonly watcher: EventEmitter = new EventEmitter();

	public data!: string;

	public time: Date = new Date();

	constructor(path: string, name: string) {
		this.path = Path.resolve(path);
		this.filePath = Path.join(this.path, name + '.json');
	}

	/**
	 * Obtains the datas stored in the database's file
	 */
	public async read(): Promise<any> {
		const rawData: string = (await FileSystemAsync.readFile(this.filePath)).toString();
		const data: any = this.serializer.deserialize(rawData);

		return data instanceof Object ? data : {};
	}

	/**
	 * Checks if the database file exists
	 */
	public exists(): boolean {
		return FileSystem.existsSync(this.filePath);
	}

	/**
	 * Obtains the stats of the database file
	 */
	public stats(): Promise<FileSystem.Stats> {
		return FileSystemAsync.stat(this.filePath);
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

export class LocalFile extends Internal<DatabaseInternal> {
	[key: string]: any;
	[index: number]: any;

	public static defaultPath: string = Path.resolve('./data');

	/**
	 * @param options The options
	 */
	constructor(options: DatabaseOptions = {}) {
		const name: string = typeof options.name === 'string' ? options.name : 'default';
		const path: string = typeof options.path === 'string' ? options.path : LocalFile.defaultPath;
		const internal: DatabaseInternal = new DatabaseInternal(path, name);
		const serializerLegacy: SerializerLegacy = new SerializerLegacy();

		if (options.constructors instanceof Array) {
			for (const ctr of options.constructors) {
				internal.serializer.prototypes.add(ctr);
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

			for (const key in data) this[key] = data[key];
		}

		if (options.defaults instanceof Object) {
			const defaults: any = options.defaults;

			for (const key in defaults) if (!(key in this)) this[key] = defaults[key];
		}

		internal.data = internal.serializer.serialize(this);

		Timers.setInterval(() => this.watch(), 2500).unref();
		process.once('exit', () => this.watchSync());
		process.nextTick(() => this.watch());
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

		this.internal.time = new Date();
		this.internal.data = serialized;
	}

	private saveSync(serialized: string): void {
		if (!FileSystem.existsSync(this.internal.path)) {
			FileSystem.mkdirSync(this.internal.path, {recursive: true});
		}

		FileSystem.writeFileSync(this.internal.filePath, serialized);

		this.internal.time = new Date();
		this.internal.data = serialized;
	}

}
