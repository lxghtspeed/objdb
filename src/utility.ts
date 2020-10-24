import ZLib from 'zlib';
import Util from 'util';

export class Internal<T extends Object> {

    private static instances = new WeakMap<Internal<Object>, Object>();

	/**
	 * Initializes a new instance of the Internal class
	 * @param value the default internal object
	 */
	constructor(value: T) {
		Internal.instances.set(this, value);
	}

	/**
	 * Obtains the internal object of the current object
	 */
	protected get internal(): T {
		return <T> Internal.instances.get(this);
    }

}

export class Brotli {

    public static readonly compress = Util.promisify(ZLib.brotliCompress);
    
    public static readonly decompress = Util.promisify(ZLib.brotliDecompress);
    
}

/** @deprecated */
export class PrototypeList {

    private readonly prototypes: Map<string | object, object | string> = new Map();

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

        if (t !== 'function') {
            throw new TypeError('Expected constructor, got ' + t);
        }

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

        if (t !== 'function') {
            throw new TypeError('Expected constructor, got ' + t);
        }

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

export class VersionError extends Error {

	constructor(expected: string, got?: string) {
		super(`Expected version: ${expected}, got ${got || 'unknown version'} (incompatible)`);
	}

}
