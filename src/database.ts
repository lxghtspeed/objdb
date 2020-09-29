import FileSystem from 'fs';
import Timers from 'timers';
import Path from 'path';
import { promises as FileSystemAsync } from 'fs';
import { EventEmitter } from 'events';
import { Comparison, Internal } from './utility';
import { Serializer as SerializerLegacy } from './serialization/legacy';
import { Serializer } from './serialization';

class DatabaseInternal {

	public readonly filePath: string;

	public readonly path: string;

	public readonly serializerLegacy = new SerializerLegacy();
	
	public readonly serializer = new Serializer();

	public readonly watcher = new EventEmitter();

	public data!: any;

	public time = new Date();

	public maxTries = 5;

	public tries = 0;

	constructor(path: string, name: string) {
		this.path = Path.resolve(path);
		this.filePath = Path.join(this.path, name + '.json');
	}

	/**
	 * Obtains the datas stored in the database's file
	 */
	public async read(): Promise<any> {
		const rawData = (await FileSystemAsync.readFile(this.filePath)).toString();
		const data = this.serializer.deserialize(rawData);

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

	public static defaultPath = Path.resolve('./data');

	/**
	 * @param options The options
	 */
	constructor(options: DatabaseOptions = {}) {
		const name = typeof options.name === 'string' ? options.name : 'default';
		const path = typeof options.path === 'string' ? options.path : LocalFile.defaultPath;
		const internal = new DatabaseInternal(path, name);

		if (options.constructors instanceof Array) {
			for (const ctr of options.constructors) {
				internal.serializer.prototypes.add(ctr);
			}
		}

		super(internal);

		if (FileSystem.existsSync(internal.filePath)) {
			const rawData = FileSystem.readFileSync(internal.filePath).toString();
			const data = internal.serializer.deserialize(rawData);

			for (const key in data) this[key] = data[key];
		}

		if (options.defaults instanceof Object) {
			const defaults = options.defaults;

			for (const key in defaults) if (!(key in this)) this[key] = defaults[key];
		}

		internal.data = Comparison.clone(this);

		Timers.setInterval(() => this.watchFile(), 5000).unref();
		Timers.setInterval(() => this.watchInternal(), 2500).unref();
		process.once('exit', () => this.watchInternalSync());
		process.nextTick(() => this.watchInternal());
	}

	private async watchFile(): Promise<void> {
		if (!this.internal.exists()) {
			return;
		}

		if ((await this.internal.stats()).mtime <= this.internal.time) {
			return;
		}

		let data: any;

		try {
			data = await this.internal.read();
		} catch (e) {
			if (this.internal.tries < this.internal.maxTries) {
				this.internal.tries++;
				
				setTimeout(() => this.watchFile(), 100);
				return;
			}
			
			this.internal.tries = 0;

			await this.save();
			return;
		}

		this.internal.tries = 0;
		this.internal.time = new Date();
		const comparison = new Comparison(this.internal.data, data);

		if (comparison.keys === undefined) {
			return;
		}

		comparison.applyTo(this);
		this.internal.data = Comparison.clone(this);
		this.internal.watcher.emit('change', comparison.keys, comparison.values);
	}

	private async watchInternal(): Promise<void> {
		const comparison = new Comparison(this.internal.data, this);

		if (comparison.keys === undefined) {
			return;
		}

		this.internal.watcher.emit('change', comparison.keys, comparison.values);
		await this.watchFile();
		await this.save();
	}

	private watchInternalSync(): void {
		const comparison = new Comparison(this.internal.data, this);

		if (comparison.keys === undefined) {
			return;
		}

		this.internal.watcher.emit('change', comparison.keys, comparison.values);
		this.saveSync();
	}

	private async save(): Promise<void> {
		const serialized = this.internal.serializer.serialize(this);

		if (!FileSystem.existsSync(this.internal.path)) {
			await FileSystemAsync.mkdir(this.internal.path);
		}

		await FileSystemAsync.writeFile(this.internal.filePath, serialized);

		this.internal.time = new Date();
		this.internal.data = Comparison.clone(this);
	}

	private saveSync(): void {
		const serialized = this.internal.serializer.serialize(this);

		if (!FileSystem.existsSync(this.internal.path)) {
			FileSystem.mkdirSync(this.internal.path);
		}

		FileSystem.writeFileSync(this.internal.filePath, serialized);

		this.internal.time = new Date();
		this.internal.data = Comparison.clone(this);
	}

}
