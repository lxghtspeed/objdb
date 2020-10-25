import FileSystem from 'fs';
import Timers from 'timers';
import Path from 'path';
import { promises as FileSystemAsync } from 'fs';
import { Internal, VersionError } from './utility';
import { Serializer, SerializerLegacy } from './serialization';
import { EventEmitter } from 'events';

interface DatabaseOptions {
	/**
	 * The name of the database
	 * 
	 * will be stored in format: **path**\/**name**.json
	 * 
	 * default value: `"default"`
	 */
	name?: string;

	/**
	 * The path to folder where the database will be stored
	 * 
	 * default value: `"./data"` which is **Database.defaultPath**
	 */
	path?: string;

	/**
	 * The default values of the database
	 * 
	 * `symbol` `function` types are not supported
	 */
	defaults?: Record<string | number, any>;

	/**
	 * The constructors to use when restoring the prototypes
	 * 
	 * **`Object` `Array` `Map` `Set` `Date` `Buffer` `RegExp`
	 * `String` `Boolean` `Number`** are already added
	 */
	constructors?: Function[];

	/**
	 * A number representing the save interval in ms.
	 * Each saving operation will blocks the event loop for some milliseconds,
	 * it depends on the size of your datas, here is some benchmark:
	 * 
	 * Low-end: `791kb` took `130ms` to serialize `108ms` to deserialize
	 * 
	 * High-end: `791kb` took `19ms` to serialize `11ms` to deserialize
	 * 
	 * You can eventually call **.save()** or **.forceSave()** instead of using automatic saving
	 * 
	 * minimum: `1000`, never: `Infinity`, default: `8000`
	 */
	interval?: number;

	/**
	 * once the limit is reached the oldest backup will be deleted for each new backup
	 * 
	 * default: `6`
	 */
	maxBackups?: number;

	/**
	 * The interval in hours which a backup is created
	 * 
	 * minimum: `1`, never: `Infinity`, default: `8`
	 */
	backupInterval?: number;
}

class Backup {

	private readonly owner: Database;

	private readonly internal: DBInternal; 

	private readonly parent: BackupManager;

	public readonly createdAt: Date;

	public readonly name: string;

	public readonly fullPath: string;

	constructor(owner: Database, internal: DBInternal, parent: BackupManager, date: Date) {
		this.owner = owner;
		this.internal = internal;
		this.parent = parent;
		this.createdAt = date;
		this.name = `${internal.name}-${date.getTime().toString(36)}.bak`;
		this.fullPath = Path.join(this.internal.path, this.name);
	}

	public async delete(): Promise<void> {
		if (!FileSystem.existsSync(this.fullPath)) {
			return;
		}

		await FileSystemAsync.unlink(this.fullPath);

		const cache = this.parent.cache;
		
		this.parent.cache = cache.filter(b => b !== this);
	}

	public load(): void {
		if (!FileSystem.existsSync(this.fullPath)) {
			return;
		}

		const data = FileSystem.readFileSync(this.fullPath).toString();
		const objdb = this.internal.serializer.deserialize(data);
	
		for (const k in this.owner) {
			delete this.owner[k];
		}

		for (const k in objdb) {
			this.owner[k] = objdb[k];
		}
	}

	public save(): void {
		if (!FileSystem.existsSync(this.internal.path)) {
			FileSystem.mkdirSync(this.internal.path, { recursive: true });
		}

		FileSystem.writeFileSync(this.fullPath, this.internal.data);
	}

}

class BackupManager {

	private readonly owner: Database;

	private readonly internal: DBInternal;

	public cache: Backup[];

	public max: number;

	public interval: number;

	constructor(owner: Database, internal: DBInternal, max: number, interval: number) {
		this.owner = owner;
		this.internal = internal;
		this.cache = [];
		this.max = max;
		this.interval = interval * 3600000;

		if (FileSystem.existsSync(internal.path)) {
			const folder = FileSystem.readdirSync(internal.path);
			const name = this.internal.name + '-';

			for (const file of folder) {
				if (file.startsWith(name) && file.endsWith('.bak')) {
					const timecode = file.slice(name.length, -4);
					const timestamp = Number.parseInt(timecode, 36);
					const date = new Date(timestamp);
					const backup = new Backup(owner, internal, this, date);

					this.cache.push(backup);
				}
			}

			while (this.cache.length > this.max) {
				this.oldest?.delete();
			}

			this.cache = this.cache.sort((a, b) => {
				return a.createdAt.getTime() - b.createdAt.getTime();
			})
		}

		if (interval === Infinity) {
			return
		}

		if (!FileSystem.existsSync(internal.fullPath)) {
			owner.once('save', () => {
				const cb = this.backup.bind(this);
				const timer = Timers.setTimeout(cb, this.interval).unref();

				internal.timers.backup = timer;
			});
			return;
		}

		const latest = this.latest;

		if (!latest) {
			this.backup();
			return;
		}
		
		const cb = this.backup.bind(this);
		const time = this.interval - (Date.now() - latest.createdAt.getTime());
		const timer = Timers.setTimeout(cb, time).unref();

		this.internal.timers.backup = timer;
	}

	private backup(): void {
		this.create();

		const cb = this.backup.bind(this);
		const timer = Timers.setTimeout(cb, this.interval).unref();

		this.internal.timers.backup = timer;
	}

	public create(): Backup {
		const backup = new Backup(this.owner, this.internal, this, new Date());

		backup.save();
		this.cache.push(backup);
		
		if (this.cache.length > this.max) {
			this.oldest?.delete();
		}

		this.owner.emit('backup', backup);

		return backup;
	}

	public get oldest(): Backup | undefined {
		return this.cache[0];
	}

	public get latest(): Backup | undefined {
		return this.cache[this.cache.length - 1];
	}

}

class DBInternal {
	
	public readonly name: string;

	public readonly path: string;

	public readonly fullPath: string;

	public readonly serializer: Serializer;

	public readonly emitter: EventEmitter;

	public timers: Record<string, NodeJS.Timeout>;

	public data!: string;

	public lastSaveAttempt: number;

	public exitListener!: () => void;

	public backups!: BackupManager;

	public static readonly opened: Record<string, Database> = {};

	constructor(path: string, name: string, fullPath: string) {
		this.path = Path.resolve(path);
		this.name = name;
		this.fullPath = fullPath;
		this.serializer = new Serializer([ Database, LocalFile ]);
		this.emitter = new EventEmitter();
		this.timers = {};
		this.lastSaveAttempt = 0;
	}

}

/** A fix for legacy databases (moving from 1.5 to 1.6) */
class LocalFile {}

export class Database extends Internal<DBInternal> {

	[key: string]: any; [index: number]: any;

	public static defaultPath: string = './data';

	/**
	 * Opens a database or returns a reference if it is already opened
	 * @param options an object containing optional properties `name` `path` `defaults` `constructors` `interval` `backupInterval` `maxBackups`
	 */
	constructor({
		name = 'default',
		path = Database.defaultPath,
		defaults = {},
		constructors = [],
		interval = 8000,
		backupInterval = 8,
		maxBackups = 6,
	}: DatabaseOptions = {}) {
		if (interval < 1000) {
			throw new RangeError('the parameter "interval" is out of range');
		}

		if (backupInterval < 1000) {
			throw new RangeError('the parameter "interval" is out of range');
		}

		if (maxBackups < 0) {
			throw new RangeError('the parameter "maxBackups" is out of range');
		}

		const fullPath: string = Path.resolve(Path.join(path, name + '.json'));
		
		if (fullPath in DBInternal.opened) {
			return DBInternal.opened[fullPath];
		}

		const internal = new DBInternal(path, name, fullPath);
		const serializerLegacy = new SerializerLegacy([ Database, LocalFile ]);

		for (const ctr of constructors) {
			internal.serializer.constructors.push(ctr);
			serializerLegacy.prototypes.add(ctr);
		}

		super(internal);

		if (FileSystem.existsSync(fullPath)) {
			const data: string = FileSystem.readFileSync(fullPath).toString();
			let objdb: any;

			try {
				objdb = internal.serializer.deserialize(data);
			} catch (e) {
				if (!(e instanceof VersionError)) {
					throw e;
				}
				
				objdb = serializerLegacy.deserialize(data);
			}

			for (const key in objdb) {
				this[key] = objdb[key];
			}
		}

		for (const key in defaults) {
			if (!(key in this)) {
				this[key] = defaults[key];
			}
		}

		internal.data = internal.serializer.serialize(this);
		internal.backups = new BackupManager(this, internal, maxBackups, backupInterval);
		internal.exitListener = this.forceSave.bind(this);
		
		DBInternal.opened[fullPath] = this;

		if (interval < Infinity) {	
			const cb = this.save.bind(this);
			const timer = Timers.setInterval(cb, interval).unref();
			
			internal.timers.save = timer;
		}

		process.on('exit', internal.exitListener);
	}

	/**
	 * Closes this database then delete the json file if any and all it's backups
	 */
	public async delete(): Promise<void> {
		const { backups, fullPath } = this.internal;

		this.close();
		
		for (const backup of backups.cache) {
			await backup.delete();
		}

		if (!FileSystem.existsSync(fullPath)) {
			return;
		}

		await FileSystemAsync.unlink(fullPath);
	}

	/**
	 * @param ms the time to wait in millisecond
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(r => {
			Timers.setTimeout(r, ms);
		});
	}

	public get backups(): BackupManager {
		return this.internal.backups;
	}

	public emit(event: 'save'): boolean;
	public emit(event: 'backup', backup: Backup): boolean;

	public emit(event: string, ...args: any[]): boolean {
		return this.internal.emitter.emit(event, ...args);
	}

	public on(event: 'save', listener: () => any): this;
	public on(event: 'backup', listener: (backup: Backup) => any): this;

	public on(event: string, listener: (...args: any[]) => any): this {
		this.internal.emitter.on(event, listener);
		return this;
	}

	public once(event: 'save', listener: () => any): this;
	public once(event: 'backup', listener: (backup: Backup) => any): this;

	public once(event: string, listener: (...args: any[]) => any): this {
		this.internal.emitter.once(event, listener);
		return this;
	}

	/**
	 * Attempts to save, cancels the operation if no changes were found.
	 * 
	 * if the last save were in the last `1000ms` it postpones the operation after that `1000ms`.
	 * 
	 * Called on interval.
	 */
	public async save(): Promise<void> {
		let now = Date.now();
		
		const lastAttempt = this.internal.lastSaveAttempt;
		const cooldown = lastAttempt + 1000;

		if (cooldown > now) {
			await this.sleep(cooldown - now);

			if (lastAttempt !== this.internal.lastSaveAttempt) {
				return;
			}

			now = Date.now();
		}

		this.internal.lastSaveAttempt = now;
		
		const a: string = this.internal.data;
		const b: string = this.internal.serializer.serialize(this);

		if (a === b) {
			return;
		}

		if (!FileSystem.existsSync(this.internal.path)) {
			await FileSystemAsync.mkdir(this.internal.path, { recursive: true });
		}

		this.internal.data = b;

		await FileSystemAsync.writeFile(this.internal.fullPath, b);
		this.emit('save');
	}

	/**
	 * Synchronous version of **.save()**
	 * 
	 * Overrides the `1000ms` rule.
	 * 
	 * Called when the process exits.
	 */
	public forceSave(): void {
		this.internal.lastSaveAttempt = Date.now();

		const a: string = this.internal.data;
		const b: string = this.internal.serializer.serialize(this);

		if (a === b) {
			return;
		}

		if (!FileSystem.existsSync(this.internal.path)) {
			FileSystem.mkdirSync(this.internal.path, { recursive: true });
		}

		this.internal.data = b;

		FileSystem.writeFileSync(this.internal.fullPath, b);
		this.emit('save');
	}

	/**
	 * Closes this database
	 */
	public close(): void {
		const timers = this.internal.timers;

		for (const k in timers) {
			clearInterval(timers[k]);
		}

		this.forceSave();

		delete DBInternal.opened[this.internal.fullPath];

		process.removeListener('exit', this.internal.exitListener);
		Object.setPrototypeOf(this, Object.prototype);
	}

}
