import { PrototypeList, VersionError } from "../utility";

enum PrimitiveType {
	undefined,
	null,
	boolean,
	number,
	string,
	bigint
}

enum ContainerType {
	object,
	map,
	set
}

type Reference = number;

interface Primitive extends Array<any> {
	[0]: PrimitiveType;
	[1]?: string | boolean;
}

interface ObjectPrimitive extends Array<any> {
	[0]: string;
	[1]:(ObjectContainer | MapContainer | SetContainer)[];
	[2]?: string;
	[3]?: string;
}

interface Container extends Array<any> {
	[0]: ContainerType;
}

interface ObjectContainer extends Container {
	[0]: ContainerType.object;
	[1]: string;
	[2]: Reference | Primitive;
}

interface MapContainer extends Container {
	[0]: ContainerType.map;
	[1]: Reference | Primitive;
	[2]: Reference | Primitive;
}

interface SetContainer extends Container {
	[0]: ContainerType.set;
	[1]: Reference | Primitive;
}

interface Serialized {
	readonly version: string;
	value: Reference | Primitive;
	references: ObjectPrimitive[];
}

export class SerializationError extends Error {

	constructor(what: string) {
		super(`${what} is not serializable`);
	}

}

export class Serializer {

	public readonly prototypes: PrototypeList;

	public static readonly version = '1.0';

	public static bufferFix: string[] = Object.getOwnPropertyNames(Buffer.prototype);

	constructor(constructors: Function[] = []) {
		this.prototypes = new PrototypeList([
			Object, Date, Map,
			Set, Buffer, Array,
			String, Boolean, Number,
			RegExp, ...constructors
		]);
	}

	/**
	 * Clones objects instances
	 * @param value The value to clone
	 * @returns A clone of the value
	 */
	public static clone(value: any, references: Map<any, any> = new Map()): any {
		if (!(value instanceof Object)) {
			return value;
		}

		if (typeof value === 'function' || typeof value === 'symbol') {
			return value;
		}

		if (references.has(value)) {
			return references.get(value);
		}

		const prototype: any = Object.getPrototypeOf(value);
		let clone: any = {};

		if (value instanceof Map) {
			clone = new Map();
		}
		
		if (value instanceof Set) {
			clone = new Set();
		}
		
		if (value instanceof Buffer) {
			clone = Buffer.from(value);
		}
		
		if (value instanceof Date) {
			clone = new Date(value);
		}

		if (value instanceof Array) {
			clone = [];
		}

		if (value instanceof String) {
			clone = new String();
		}

		if (value instanceof Number) {
			clone = new Number();
		}

		if (value instanceof Boolean) {
			clone = new Boolean();
		}

		references.set(value, clone);

		if (value instanceof Set) {
			for (const v of value) clone.add(Serializer.clone(v, references));
		}

		if (value instanceof Map) {
			for (const [k, v] of value) clone.set(Serializer.clone(k, references), Serializer.clone(v, references));
		}

		for (const key in value) clone[key] = Serializer.clone(value[key], references);

		return Object.setPrototypeOf(clone, prototype);
	}
	
	private static typeCheck(value?: any): PrimitiveType | string {
		if (value === null) {
			return PrimitiveType.null;
		}

		if (value === undefined) {
			return PrimitiveType.undefined;
		}

		if (value instanceof WeakMap) {
			throw new SerializationError('WeakMap');
		}

		if (value instanceof WeakSet) {
			throw new SerializationError('WeakSet');
		}

		const t = typeof value;

		if (t === 'object') {
			return value.constructor?.name || 'null';
		}

		if (t === 'function' || t === 'symbol') {
			throw new SerializationError(t);
		}

		return PrimitiveType[t];
	}
	
	private static serialize(value: any, serialized: Serialized, references: Object[]): Reference | Primitive {
		const type = this.typeCheck(value);
		
		if (typeof type === 'string') {
			for (const index in references) if (references[index] === value) return Number(index);

			const index = references.push(value) - 1;
			const ref: ObjectPrimitive = [type, []];
			
			serialized.references.push(ref);

			if (value instanceof Map) {
				value.forEach((v: any, k: any) => {
					const container: MapContainer = [ContainerType.map, 0, 0];
					container[1] = Serializer.serialize(k, serialized, references);
					container[2] = Serializer.serialize(v, serialized, references);

					ref[1].push(container);
				});
			}
			
			if (value instanceof Set) {
				value.forEach((v: any) => {
					const container: SetContainer = [ContainerType.set, 0];
					container[1] = Serializer.serialize(v, serialized, references);

					ref[1].push(container);
				});
			}
			
			if (value instanceof RegExp) {
				ref[2] = value.source;
				ref[3] = value.flags;
			}
			
			if (value instanceof Date) {
				ref[2] = value.valueOf().toString(36);
			}
			
			if (value instanceof Buffer) {
				ref[2] = value.toString('base64');
			}
			
			if (value instanceof Number || value instanceof String || value instanceof Boolean) {
				ref[2] = value.toString();
			}

			for (const key in value) {
				if (value instanceof Buffer || value instanceof String) {
					const index = Number(key);

					if (Math.floor(index) === index && index <= value.length) {
						continue;
					}

					if (isNaN(index) && Serializer.bufferFix.includes(key)) {
						continue;
					}
				}

				const container: ObjectContainer = [ContainerType.object, key, 0];
				container[2] = Serializer.serialize(value[key], serialized, references);

				ref[1].push(container);
			}

			return index;
		}

		const primitive: Primitive = [type]

		switch (type) {
			case PrimitiveType.boolean:
			case PrimitiveType.string:
				primitive[1] = value;
				break;

			case PrimitiveType.number:
				primitive[1] = value.toString();
				break;

			case PrimitiveType.bigint:
				primitive[1] = value.toString(36);
		}

		return primitive;
	}

	public serialize(value?: any): string {
		const references: Object[] = [];
		const serialized: Serialized = {
			version: Serializer.version,
			value: 0,
			references: []
		};

		serialized.value = Serializer.serialize(value, serialized, references);
		return JSON.stringify(serialized);
	}

	private static deserializePrimitive(primitive: Reference | Primitive, references: Object[]): any {
		if (typeof primitive === 'number') {
			return references[primitive];
		}

		switch (primitive[0]) {
			case PrimitiveType.undefined:
				return undefined;

			case PrimitiveType.null:
				return null;

			case PrimitiveType.bigint:
				return parseInt(<string> primitive[1], 36);

			case PrimitiveType.number:
				return Number(primitive[1]);

			case PrimitiveType.string:
				return primitive[1];
		}
	}

	private static deserialize(serialized: Serialized, references: Object[], prototypes: PrototypeList): any {
		// Create references
		for (const r of serialized.references) {
			const name = r[0];
			const prototype: any = name === 'null' ? null : (prototypes.get(r[0]) || Object.prototype);
			const test = Object.setPrototypeOf({}, prototype);

			if (test instanceof Map) {
				references.push(new Map());
				continue;
			}
			
			if (test instanceof Set) {
				references.push(new Set());
				continue;
			}
			
			if (test instanceof RegExp) {
				const source = r[2] || '';
				const flags = r[3];
				const regexp = new RegExp(source, flags);

				references.push(regexp);
				continue;
			}
			
			if (test instanceof Date) {
				const timestamp = parseInt(r[2] || '0', 36);
				const date = new Date(timestamp);

				references.push(date);
				continue;
			}
			
			if (test instanceof Buffer) {
				const text = r[2] || '';
				const buffer = Buffer.from(text, 'base64');

				references.push(buffer);
				continue;
			}
			
			if (test instanceof Array) {
				references.push([]);
				continue;
			}

			references.push({});
		}

		// Apply datas to references then apply prototypes
		for (const i in serialized.references) {
			const r = serialized.references[i]
			const reference: any = references[i];
			const name = r[0];
			const prototype: any = name === 'null' ? null : (prototypes.get(r[0]) || Object.prototype);

			for (const container of r[1]) {
				let key: any, value: any;

				switch (container[0]) {
					case ContainerType.object:
						key = container[1]
						value = Serializer.deserializePrimitive(container[2], references);
						reference[key] = value;
						break;

					case ContainerType.map:
						key = Serializer.deserializePrimitive(container[1], references);
						value = Serializer.deserializePrimitive(container[2], references);

						reference.set(key, value);
						break;

					case ContainerType.set:
						value = Serializer.deserializePrimitive(container[1], references);

						reference.add(value);
						break;
				}
			}

			Object.setPrototypeOf(reference, prototype);
		}

		return Serializer.deserializePrimitive(serialized.value, references);
	}

	public deserialize(data: string): any {
		const references: Object[] = [];
		const serialized: Serialized = JSON.parse(data);

		if (!serialized || serialized.version !== Serializer.version) {
			throw new VersionError(Serializer.version, serialized.version);
		}

		return Serializer.deserialize(serialized, references, this.prototypes);
	}

}