import ZLib from 'zlib';
import Util from 'util';

const internals = new WeakMap<Internal<any> | typeof Internal, any>();

export class Internal<T> {

	/**
	 * Initializes a new instance of the Internal class
	 * @param value the default internal object
	 */
	constructor(value?: T) {
		internals.set(this, value ?? {});
	}

	/**
	 * Obtains the internal object of the current object
	 */
	protected get internal(): T {
		if (!internals.has(this)) internals.set(this, {});

		return internals.get(this);
	}

	/**
	 * Obtains the internal object of the current object (static)
	 */
	protected static get internal(): any {
		if (!internals.has(this)) internals.set(this, {});

		return internals.get(this);
	}

}

export class Brotli
{
	public static readonly compress = Util.promisify(ZLib.brotliCompress);
	public static readonly decompress = Util.promisify(ZLib.brotliDecompress);
}

export class PrototypeList {

    private readonly prototypes = new Map<string | object, object | string>();

    constructor(constructors: Function[]) {
        constructors.forEach(constructor => {
            this.prototypes.set(constructor.prototype, constructor.name);
            this.prototypes.set(constructor.name, constructor.prototype);
        });
    }

    /**
     * Checks if a prototype or it's name exists in the list
     * @param constructor The constructor name or the prototype itself
     */
    public has(constructor: string | Function): boolean {
        return this.prototypes.has(typeof constructor === 'string' ? constructor : constructor.prototype);
    }

    /**
     * Gets if a prototype or it's name exists in the list
     * @param constructor The constructor name or the prototype itself
     */
    public get(constructor: string): string | object | undefined {
        return this.prototypes.get(constructor);
    }

    /**
     * Adds a prototype to the list
     * @param constructor The constructor to add to the list
     */
    public add(constructor: Function): this {
        const t = typeof constructor;

        if (t !== 'function') throw new TypeError('Expected constructor, got ' + t);

        if (this.prototypes.has(constructor.name)) {
            const prototype = <object> this.prototypes.get(constructor.name);
            
            this.prototypes.delete(prototype);
            this.prototypes.delete(constructor.name);
        }

        this.prototypes.set(constructor.prototype, constructor.name);
        this.prototypes.set(constructor.name, constructor.prototype);
        
        return this;
    }

    /**
     * Deletes a prototype from the list
     * @param constructor The constructor to delete from the list
     */
    public delete(constructor: Function): true {
        const t = typeof constructor;

        if (t !== 'function') throw new TypeError('Expected constructor, got ' + t);

        this.prototypes.delete(constructor.name);
        this.prototypes.delete(constructor);
        
        return true;
    }

    /**
     * Loops through the list
     * @param callback the callback
     */
    public forEach(callback: (constructor: object, prototypes: PrototypeList) => any): void {
        this.prototypes.forEach(prototype => {
            if (typeof prototype === 'object') callback(prototype.constructor, this);
        });
    }

}

export class Version {

	private value: number[];

	/**
	 * @param version The version to compare from
	 */
	constructor(version: string) {
		this.value = version.split('.').map(n => parseInt(n, 10));
	}

	/**
	 * Compares this version with another
	 * @param version The version to compare with
	 * @returns Compatible ?
	 */
	public compatible(version: Version): boolean {
		for (let i = 0; i < this.value.length; i++) {
			if (this.value[i] !== version.value[i]) return i > 1;
		}

		return true;
	}

	/**
	 * Stringifies this object
	 */
	public toString() {
		return this.value.join('.');
	}

}

export interface Changes extends Map<any, true | Changes> {}

export class Comparison {

	public readonly from: any;
	public readonly to: any;
	public readonly keys: true | Changes | undefined;
	public readonly values: any;

	/**
	 * Compares two objects by getting differences from one to another
	 * @param from The object to compare from
	 * @param to The object to compare to
	 */
	constructor(from: any, to: any) {
		this.from = Comparison.clone(from);
		this.to = Comparison.clone(to);
		this.keys = Comparison.compare(this.from, this.to);
		this.values = Comparison.minify(this.to, this.keys);
	}

	/**
	 * Clones objects instances
	 * @param value The value to clone
	 * @returns A clone of the input value
	 */
	public static clone(value: any): any {
		if (!(value instanceof Object)) return value;

		if (typeof value === 'function' || typeof value === 'symbol') return value;

		const prototype = Object.getPrototypeOf(value);
		let clone: any;

		if (value instanceof Map) {
			const c = new Map();

			for (const [k, v] of value) c.set(Comparison.clone(k), Comparison.clone(v));

			clone = c;
		} else if (value instanceof Set) {
			const c = new Set();

			for (const flag of value) c.add(flag);
		} else if (value instanceof Buffer) {
			clone = Buffer.from(value);
		} else if (value instanceof Date) {
			clone = new Date(value);
		} else {
			clone = {};

			for (const key in value) clone[key] = Comparison.clone(value[key]);
		}

		return Object.setPrototypeOf(clone, prototype);
	}

	/**
	 * Applies to an object, the differences got from a comparison of objects
	 * @param keys The differences keys
	 * @param values The differences values
	 * @param to The object to be applied to
	 */
	public static applyTo(keys: true | Changes | undefined, values: any, to: any): any {
		if (keys === undefined || to === values) return to;

		if (keys === true) return Comparison.clone(values);

		switch (true) {
			case typeof to !== typeof values:
			case !(to instanceof Object && values instanceof Object):
			case Object.getPrototypeOf(values) !== Object.getPrototypeOf(to):
				return Comparison.clone(values);
		}

		if (to instanceof Map && values instanceof Map) {
			for (const [key, value] of keys) {
				if (value === true) {
					if (values.has(key)) {
						to.set(key, values.get(key));
					} else to.delete(key);
				} else to.set(key, Comparison.applyTo(value, values.get(key), to.get(key)));
			}
		} else if (to instanceof Set && values instanceof Set) {
			for (const [flag] of keys) {
				if (values.has(flag)) {
					to.add(flag);
				} else to.delete(flag);
			}
		} else if (to instanceof Date && values instanceof Date) {
			to = new Date(values);
		} else if (to instanceof Buffer && values instanceof Buffer) {
			to = new Buffer(values);
		} else {
			for (const [key, value] of keys) {
				if (value === true) {
					if (values.hasOwnProperty(key)) {
						to[key] = values[key];
					} else delete to[key];
				} else to[key] = Comparison.applyTo(value, values[key], to[key]);
			}
		}

		return to;
	}

	/**
	 * Removes from an object, the differences got from a comparison of objects
	 * @param keys The differences keys
	 * @param values The differences values
	 * @param to The object to be applied to
	 */
	public static removeFrom(keys: true | Changes | undefined, values: any, to: any): any {
		if (keys === undefined || to === values) return to;

		if (keys === true) return Comparison.clone(values);

		switch (true) {
			case typeof to !== typeof values:
			case !(to instanceof Object && values instanceof Object):
			case Object.getPrototypeOf(values) !== Object.getPrototypeOf(to):
				return Comparison.clone(values);
		}

		if (to instanceof Map && values instanceof Map) {
			for (const [key, value] of keys) {
				if (value === true) {
					to.delete(key);
				} else to.set(key, Comparison.removeFrom(value, values.get(key), to.get(key)));
			}
		} else if (to instanceof Set && values instanceof Set) {
			for (const [flag] of keys) to.delete(flag);
		} else if (to instanceof Buffer && values instanceof Buffer) {
			to = new Buffer(values);
		} else if (to instanceof Date && values instanceof Date) {
			to = new Date(values);
		} else {
			for (const [key, value] of keys) {
				if (value === true) {
					delete to[key];
				} else to[key] = Comparison.removeFrom(value, values[key], to[key]);
			}
		}

		return to;
	}

	/**
	 * Compares two objects by getting differences from one to another
	 * @package
	 * @param from The object to compare from
	 * @param to The object to compare to
	 */
	public static compare(from: any, to: any): true | Changes | undefined {
		if (from === to) return undefined;

		switch (true) {
			case typeof from !== typeof to:
			case !(to instanceof Object && from instanceof Object):
			case Object.getPrototypeOf(to) !== Object.getPrototypeOf(from):
				return true;
		}

		const changes: Changes = new Map();

		if (to instanceof Map && from instanceof Map) {
			for (const [k, v] of from) {
				if (to.has(k)) {
					const comparison = new Comparison(v, to.get(k));

					if (comparison.keys !== undefined && (comparison.keys === true || comparison.keys.size > 0)) {
						changes.set(k, comparison.keys);
					}
				} else changes.set(k, true);
			}

			for (const [k] of to) if (!from.has(k)) changes.set(k, true);
		} else if (to instanceof Set && from instanceof Set) {
			for (const flag of from) if (!to.has(flag)) changes.set(flag, true);

			for (const flag of to) if (!from.has(flag)) changes.set(flag, true);
		} else if (to instanceof Buffer && from instanceof Buffer) {
			return from.every((v, i) => to[i] === v) ? true : undefined;
		} else if (to instanceof Date && from instanceof Date) {
			return to.valueOf() === from.valueOf() ? true : undefined;
		} else {
			for (const key in from) {
				if (to.hasOwnProperty(key)) {
					const comparison = new Comparison(from[key], to[key]);

					if (comparison.keys !== undefined && (comparison.keys === true || comparison.keys.size > 0)) {
						changes.set(key, comparison.keys);
					}
				} else changes.set(key, true);
			}

			for (const key in to) if (!from.hasOwnProperty(key)) changes.set(key, true);
		}

		return changes.size > 0 ? changes : undefined;
	}

	/**
	 * Create an object containing only the differences values
	 * @param input The input to minify
	 * @param keys The differences keys
	 * @returns Minified input
	 */
	public static minify(input: any, keys: true | Changes | undefined): any {
		if (keys === true) return input;

		if (keys === undefined) return;

		let out: any;

		if (input instanceof Map) {
			out = new Map();

			for (const [key, value] of keys) {
				if (input.has(key)) {
					if (value === true) {
						out.set(key, input.get(key));
					} else out.set(key, Comparison.minify(input.get(key), value));
				}
			}
		} else if (input instanceof Set) {
			out = new Set();

			for (const [key] of keys) if (input.has(key)) out.add(key);
		} else {
			out = {};

			for (const [key, value] of keys) {
				if (input.hasOwnProperty(key)) {
					if (value === true) {
						out[key] = input[key];
					} else out[key] = Comparison.minify(input[key], value);
				}
			}

			Object.setPrototypeOf(out, Object.getPrototypeOf(input));
		}

		return out;
	}

	/**
	 * Applies the differences to an object
	 * @param to The object to be applied to
	 */
	public applyTo(to: any): any {
		return Comparison.applyTo(this.keys, this.values, to);
	}

	/**
	 * Removes the differences from an object
	 * @param from The object to be applied to
	 */
	removeFrom(from: any): any {
		return Comparison.removeFrom(this.keys, this.values, from);
	}

}
