import V8 from 'v8';
import { EventEmitter } from 'events';
import { Server, Socket } from 'net';
import { Brotli } from './utility';

class Event {

	public readonly name: string;
	public readonly args: any[];

	/**
	 * Creates a new instance of serializable Event
	 * @param name Event name
	 * @param args Event arguments
	 */
	constructor(name: string, ...args: any[]) {
		if (typeof name !== 'string') throw new TypeError('string expected at argument "name"');

		this.name = name;
		this.args = args;
	}

	/**
	 * Serializes this Event
	 */
	public async serialize(): Promise<string> {
		const buffer = V8.serialize(this);

		return (await Brotli.compress(buffer)).toString('base64');
	}

	/**
	 * Deserializes a serialized Event
	 * @param serialized The serialized data to parse
	 */
	public static async deserialize(serialized: string): Promise<Event> {
		const buffer = Buffer.from(serialized, 'base64');
		const deserialized = V8.deserialize(await Brotli.decompress(buffer));

		switch (false) {
			case deserialized instanceof Object:
			case typeof deserialized.name === 'string':
			case deserialized.args instanceof Array:
				throw new Error('Invalid serialized Event');
		}

		return Object.setPrototypeOf({ ...deserialized }, Event.prototype);
	}
}

export class SocketEmitter extends EventEmitter {

	public readonly socket: Socket;

	constructor(socket = new Socket()) {
		super();
		let body = '';
		this.socket = socket;
		socket.on('connect', () => {
			body = '';
			super.emit('connect');
		})
		.on('close', hadError => super.emit('close', hadError))
		.on('timeout', () => super.emit('timeout'))
		.on('error', error => super.emit('error', error))
		.on('data', async buffer => {
			body += buffer;

			if (body.includes(('\n'))) {
				const packets = body.split('\n');
				body = <string> packets.pop();
				const events = Promise.all(packets.map(packet => Event.deserialize(packet).catch(() => {
					socket.destroy();
					super.emit('error', new Error('Invalid data received'));
				})));

				for (const event of await events) if (event !== undefined) super.emit(event.name, ...event.args);
			}
		});
	}

	/**
	 * Listens to an event
	 * @param event The event name
	 * @param listener The listener
	 */
	public on(event: string, listener: (...args: any[]) => void): this;
	public on(event: 'connect' | 'timeout', listener: () => void): this;
	public on(event: 'close', listener: (hadError: boolean) => void): this;
	public on(event: 'error', listener: (error: Error) => void): this;
	public on(event: 'data', listener: (buffer: Buffer) => void): this;

	public on(event: string, listener: (...args: any[]) => void): this {
		super.on(event, listener);
		return this;
	}

	/**
	 * Emits an event to the remote side of the socket
	 * @param event The event name
	 * @param args The arguments passed to the event
	 */
	public emit(event: string, ...args: any[]): boolean {
		if (!this.socket.writable) throw new Error('Socket is not writable');

		new Promise(async () => {
			let serialized;

			try {
				serialized = await new Event(event, ...args).serialize();
			} catch (e) {
				throw new Error(`Unable to send packet due to: ${e.message}`);
			}

			this.socket.write(`${serialized}\n`);
		});

		return true;
	}

	/**
	 * Emits an event remotely and promises a response
	 * @param query The query name
	 * @param args The arguments passed to the remote query handler
	 */
	public query(query: string, ...args: any[]): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = parseInt(process.hrtime().join(''), 10);

			const onResolve = (resolvedId: number, resolvedValue: any) => {
				if (id === resolvedId) {
					this.removeListener('resolve', onResolve);
					this.removeListener('reject', onReject);
					resolve(resolvedValue);
				}
			};

			const onReject = (rejectedId: number, reason: any) => {
				if (id === rejectedId) {
					this.removeListener('resolve', onResolve);
					this.removeListener('reject', onReject);
					reject(reason);
				}
			};

			this.on('resolve', onResolve);
			this.on('reject', onReject);
			this.emit(query, id, ...args);
		});
	}

	/**
	 * Replies a positive response (Resolve)
	 * @param id The query id
	 * @param value The arguments to send as response
	 */
	public resolve(id: number, value: any): this {
		this.emit('resolve', id, value);
		return this;
	}

	/**
	 * Replies a negative response (Reject)
	 * @param id The query id
	 * @param reason The reason of the rejection to send as response
	 */
	public reject(id: number, reason: any): this {
		this.emit('reject', id, reason);
		return this;
	}

}

export class ServerEmitter extends EventEmitter {

	public readonly sockets: Set<SocketEmitter> = new Set();
	public readonly server: Server = new Server();

	constructor() {
		super();
		this.server.on('error', error => this.emit('error', error))
		.on('connection', socket => {
			const s = new SocketEmitter(socket);
			this.sockets.add(s);

			for (const event of ['close', 'timeout', 'error', 'end']) {
				socket.on(event, () => this.sockets.delete(s));
			}

			this.emit('connection', s);
		})
		.on('close', () => this.emit('close'))
		.on('listening', () => this.emit('listening'));
	}

	/**
	 * Listens to an event
	 * @param event The event name
	 * @param listener The listener
	 */
	public on(event: string, listener: (...args: any[]) => void): this;
	public on(event: 'connection', listener: (socket: Socket) => void): this;
	public on(event: 'close' | 'listening', listener: () => void): this;

	public on(event: string, listener: (...args: any[]) => void): this {
		super.on(event, listener);
		return this;
	}

	/**
	 * Emits to multiple sockets at once
	 * @param sockets The list of the sockets to emit something
	 * @param event The event name to emit
	 * @param args The arguments passed to the event
	 */
	public async emitTo(sockets: SocketEmitter[] = [], event: string, ...args: any[]): Promise<void> {
		const serializedEvent = await new Event(event, ...args).serialize();
		sockets.forEach(socket => socket.socket.write(`${serializedEvent}\n`));
	}

	/**
	 * Emits to all connected sockets
	 * @param event The event name to emit
	 * @param args The arguments passed to the event
	 */
	public async broadcast(event: string, ...args: any[]) {
		const serializedEvent = await new Event(event, ...args).serialize();
		this.sockets.forEach(socket => socket.socket.write(`${serializedEvent}\n`));
	}

}