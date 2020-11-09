import { VersionError } from './objdb.util';

enum PrimitiveType {
    undefined,
    null,
    boolean,
    number,
    string,
    bigint
}

enum ContainerType {
    Object,
    Map,
    Set
}

type Reference = number;

interface Primitive extends Array<any> {
    [0]: PrimitiveType;
    [1]?: string | boolean;
}

interface ObjectPrimitive extends Array<any> {
    [0]: string;
    [1]: (ObjectContainer | MapContainer | SetContainer)[];
    [2]?: string;
    [3]?: string;
}

interface Container extends Array<any> {
    [0]: ContainerType;
}

interface ObjectContainer extends Container {
    [0]: ContainerType.Object;
    [1]: string;
    [2]: Reference | Primitive;
}

interface MapContainer extends Container {
    [0]: ContainerType.Map;
    [1]: Reference | Primitive;
    [2]: Reference | Primitive;
}

interface SetContainer extends Container {
    [0]: ContainerType.Set;
    [1]: Reference | Primitive;
}

interface Serialized {
    version: string;
    value: Reference | Primitive;
    references: ObjectPrimitive[];
}

interface Options {
    value: any;
    serialized: Serialized;
    names: string[];
}

export class SerializationError extends Error {

    constructor(what: string) {
        super(`${what} is not serializable`);
    }

}

export class Serializer {

    public constructors: Function[];

    public static defaultConstructors: Function[] = [
        Object, Array, Map,
        Set, Buffer, Date, RegExp,
        String, Boolean, Number,
    ]

    public static readonly version: string = '1.0';

    private static readonly bufferFix: string[] = Object.keys(Buffer.prototype);

    private static antiSpam: string[] = [];

    private static warn(message: string): void {
        if (Serializer.antiSpam.includes(message)) {
            return;
        }

        Serializer.antiSpam.push(message);
        console.warn('[objdb/serializer] WARN: ' + message)
    }

    constructor(constructors: Function[] = []) {
        this.constructors = [ ...Serializer.defaultConstructors, ...constructors ];
    }

    /**
     * Clones objects instances
     * @param value The value to clone
     * @returns A clone of the value
     */
    public static clone(value: any, references: Map<Object, Object> = new Map()): any {
        if (!(value instanceof Object)) {
            return value;
        }

        if (typeof value === 'function') {
            return value;
        }

        if (references.has(value)) {
            return references.get(value);
        }

        const prototype: object | null = Object.getPrototypeOf(value);
        let clone: any = Object.create(null);

        if (value instanceof Map) {
            clone = new Map();
        }
        
        if (value instanceof Set) {
            clone = new Set();
        }

        if (value instanceof RegExp) {
            clone = new RegExp(value);
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
            for (const v of value) {
                clone.add(Serializer.clone(v, references));
            }
        }

        if (value instanceof Map) {
            for (const [k, v] of value) {
                clone.set(Serializer.clone(k, references), Serializer.clone(v, references));
            }
        }

        for (const key in value) {
            clone[key] = Serializer.clone(value[key], references);
        }

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
            return value.constructor?.name ?? 'null';
        }

        if (t === 'function' || t === 'symbol') {
            throw new SerializationError(t);
        }

        return PrimitiveType[t];
    }
    
    private static serialize(o: Options, references: Object[] = []): Reference | Primitive {
        const { value, serialized, names } = o;
        const type: string | PrimitiveType = this.typeCheck(value);

        if (typeof type === 'string') {
            let index: number = references.indexOf(value);

            if (index >= 0) {
                return index;
            }

            if (!names.includes(type)) {
                Serializer.warn(`"${type}" is not added to the constructors list, it will result into a thrown error at the next start if you don't add it.`);
            }

            index = references.push(value) - 1;
            
            const content: (ObjectContainer | MapContainer | SetContainer)[] = [];
            const ref: ObjectPrimitive = [ type, content ];
            
            serialized.references.push(ref);

            if (value instanceof Map) {
                for (const [k, v] of value) {
                    try {
                        const container: MapContainer = [ ContainerType.Map, 0, 0 ];
                        
                        container[1] = Serializer.serialize({
                            value: k,
                            serialized, names
                        }, references);

                        container[2] = Serializer.serialize({
                            value: v,
                            serialized, names
                        }, references);

                        content.push(container);
                    } catch (e) {
                        if (e instanceof SerializationError) {
                            Serializer.warn(e.message);
                        }
                    }
                }
            }
            
            if (value instanceof Set) {
                for (const v of value) {
                    try {
                        const container: SetContainer = [ ContainerType.Set, 0 ];
                    
                        container[1] = Serializer.serialize({
                            value: v,
                            serialized, names
                        }, references);

                        content.push(container);
                    } catch (e) {
                        if (e instanceof SerializationError) {
                            Serializer.warn(e.message);
                        }
                    }
                }
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

                    if (value instanceof Buffer && Serializer.bufferFix.includes(key)) {
                        continue;
                    }
                }

                try {
                    const container: ObjectContainer = [ ContainerType.Object, key, 0 ];
                    
                    container[2] = Serializer.serialize({
                        value: value[key],
                        serialized, names
                    }, references);

                    content.push(container);
                } catch (e) {
                    if (e instanceof SerializationError) {
                        Serializer.warn(e.message);
                    }
                }
            }

            return index;
        }

        const primitive: Primitive = [ type ]

        switch (type) {
            case PrimitiveType.boolean:
            case PrimitiveType.string:
                primitive[1] = value;
                break;

            case PrimitiveType.number:
            case PrimitiveType.bigint:
                primitive[1] = value.toString();
        }

        return primitive;
    }

    public serialize(value?: any): string {
        const serialized: Serialized = {
            version: Serializer.version,
            value: 0,
            references: []
        };

        serialized.value = Serializer.serialize({
            value, serialized,
            names: this.constructors.map(c => c.name)
        });
        
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
                return BigInt(primitive[1]);

            case PrimitiveType.number:
                return Number(primitive[1]);
                
            case PrimitiveType.boolean:
            case PrimitiveType.string:
                return primitive[1];
        }
    }

    private static deserialize(serialized: Serialized, constructors: Function[]): any {
        const references: Object[] = [];
        const refctr: Function[] = [];

        // Create references
        for (const i in serialized.references) {
            const r = serialized.references[i];
            const name: string = r[0];

            if (name === 'null') {
                references.push(Object.create(null));
                continue;
            }

            const constructor = constructors.find(c => c.name === name);

            if (!constructor) {
                throw new Error('Constructor not found "' + name + '"');
            }

            const test: any = Object.create(constructor.prototype);
            refctr[i] = constructor;

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
            const r: ObjectPrimitive = serialized.references[i]
            const reference: any = references[i];
            const constructor: Function = refctr[i];

            for (const container of r[1]) {
                let key: any, value: any;

                switch (container[0]) {
                    case ContainerType.Object:
                        key = container[1]
                        value = Serializer.deserializePrimitive(container[2], references);

                        reference[key] = value;
                        break;

                    case ContainerType.Map:
                        key = Serializer.deserializePrimitive(container[1], references);
                        value = Serializer.deserializePrimitive(container[2], references);

                        reference.set(key, value);
                        break;

                    case ContainerType.Set:
                        value = Serializer.deserializePrimitive(container[1], references);

                        reference.add(value);
                        break;
                }
            }

            if (constructor) {
                Object.setPrototypeOf(reference, constructor.prototype);
            }
        }

        return Serializer.deserializePrimitive(serialized.value, references);
    }

    public deserialize(data: string): any {
        const serialized: Serialized = JSON.parse(data);

        if (!serialized || serialized.version !== Serializer.version) {
            throw new VersionError(Serializer.version, serialized.version);
        }

        return Serializer.deserialize(serialized, this.constructors);
    }

}
