import { PrototypeList } from "./utility";

export enum PrimitiveTypeId {
	undefined,
	null,
	boolean,
	number,
	string,
	bigint
}

export enum ContainerTypeId {
	object,
	map,
	set
}

export type Reference = number;

export interface Primitive extends Array<any> {
	[0]: PrimitiveTypeId;
	[1]?: string | boolean;
}

export interface ObjectType extends Array<any> {
	[0]: string;
	[1]: Container[];
	[2]?: string;
}

export interface Container extends Array<any> {
	[0]: ContainerTypeId;
}

export interface ObjectContainer extends Container {
	[0]: ContainerTypeId.object;
	[1]: string;
	[2]: Reference | Primitive;
}

export interface MapContainer extends Container {
	[0]: ContainerTypeId.map;
	[1]: Reference | Primitive;
	[2]: Reference | Primitive;
}

export interface SetContainer extends Container {
	[0]: ContainerTypeId.set;
	[1]: Reference | Primitive;
}

export interface Serialized {
	readonly version: string;
	value: Reference | Primitive;
	references: ObjectType[];
}

export class SerializationError extends Error {

	constructor(what: string) {
		super(`${what} is not serializable`);
	}

}

export class Serializer {

	public readonly prototypes: PrototypeList;

	public static readonly version = '1.0';

	constructor(constructors: Function[] = []) {
        this.prototypes = new PrototypeList([
            Object, Date, Map,
            Set, Buffer, Array,
            String, Boolean, Number,
            RegExp, ...constructors
        ]);
	}

	
	private static typeCheck(value?: any): PrimitiveTypeId | string {
		const t = typeof value;

		if (t === 'function') throw new SerializationError(t);

		if (t === 'symbol') throw new SerializationError(t);

		if (value instanceof WeakMap) throw new SerializationError('WeakMap');

		if (value instanceof WeakSet) throw new SerializationError('WeakSet');

		if (value === null) return PrimitiveTypeId.null;

		if (t === 'undefined') return PrimitiveTypeId.undefined;

		if (t === 'object') return value.constructor.name;

		return PrimitiveTypeId[t];
	}
	
	private static serialize(value: any, serialized: Serialized, references: Object[], isMain: boolean): void {
		
	}

	public serialize(value?: any): string {
		const references: Object[] = [];
		const serialized: Serialized = {
			version: Serializer.version,
			value: 0,
			references: []
		};

		Serializer.serialize(value, serialized, references, true);

		return JSON.stringify(serialized);
	}

}