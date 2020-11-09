import { PrototypeList } from './objdb.util';
import { SerializationError } from './serialization';

interface Element<T extends 'object' | 'bigint' | 'number' | 'boolean' | 'string' | 'undefined' | 'null'> extends Array<any> {
    [0]: T;
    [1]?: string;
}

interface ObjectElement extends Element<'object'> {
    [2]: (Element<any> | Container | KeyContainer)[];
    [3]?: string | number | boolean;
    [4]?: string;
}

interface Container {
    [0]: 'co';
    [1]: Element<any>;
    [2]: Element<any>;
}

interface KeyContainer {
    [0]: 'key';
    [1]: string;
    [2]: Element<any>;
}

export class SerializerLegacy {

    private static types = ['null', 'undefined', 'string', 'boolean', 'number', 'bigint', 'object'];
    
    public readonly prototypes: PrototypeList;

    constructor(constructors: Function[] = []) {
        this.prototypes = new PrototypeList([
            Object, Date, Map,
            Set, Buffer, Array,
            String, Boolean, Number,
            RegExp, ...constructors
        ]);
    }

    private static serialize(value: any): Element<'null' | 'undefined' | 'string' | 'boolean' | 'object' | 'bigint' | 'number'> {
        const t = typeof value;
        
        if (t === 'function') throw new SerializationError(t);

        if (t === 'symbol') throw new SerializationError(t);

        if (value instanceof WeakMap) throw new SerializationError('WeakMap');

        if (value instanceof WeakSet) throw new SerializationError('WeakSet');

        if (value === null) return ['null'];

        if (t === 'undefined') return ['undefined'];
        
        if (t === 'number') {
            return [t, value.toString()]
        } else if (t === 'boolean' || t === 'string') {
            return [t, value];
        } else if (t === 'bigint') {
            return [t, value.toString(36)];
        } else {
            const prototype = Object.getPrototypeOf(value);
            const ctor = prototype === null ? 'null' : prototype.constructor.name;
            const e: ObjectElement = ['object', ctor, []];
            const validIndex: string[] = [];

            if (value instanceof Date) {
                e[3] = value.valueOf().toString(36);
            } else if (value instanceof Buffer) {
                e[3] = value.toString('base64');

                for (let i = 0; i < value.length; i++) {
                    validIndex.push(i.toString());
                }
            } else if (value instanceof Number) {
                e[3] = value.toString()
            } else if (value instanceof String || value instanceof Boolean) {
                e[3] = value.valueOf()

                if (value instanceof String) {
                    for (let i = 0; i < value.length; i++) {
                        validIndex.push(i.toString());
                    }
                }
            } else if (value instanceof RegExp) {
                e[3] = value.source;
                e[4] = value.flags;
            } else if (value instanceof Map) {
                value.forEach((v: any, k: any) => {
                    const container: Container = ['co', ['null'], ['null']];
                    container[1] = SerializerLegacy.serialize(k);
                    container[2] = SerializerLegacy.serialize(v);

                    e[2].push(container);
                });
            } else if (value instanceof Set) {
                value.forEach((v: any) => {
                    e[2].push(SerializerLegacy.serialize(v));
                });
            } else if (value instanceof Array) {
                for (let i = 0; i < value.length; i++) {
                    if (!(<Object> value).hasOwnProperty(i)) {
                        break;
                    }

                    validIndex.push(i.toString());
                    e[2].push(SerializerLegacy.serialize(value[i]));
                }
            }

            for (const key of Object.keys(value)) {
                if (value instanceof Array || value instanceof Buffer || value instanceof String) {
                    if (validIndex.includes(key)) continue;
                }
                
                const container: KeyContainer = ['key', '', ['null']];
                container[1] = key;
                container[2] = SerializerLegacy.serialize(value[key]);
                
                e[2].push(container);
            }
            
            return e;
        }
    }

    /**
     * Serialize something to JSON
     * @param value the value to serialize
     */
    public serialize(value: any): string {
        return JSON.stringify(SerializerLegacy.serialize(value));
    }

    private static deserialize(e: Element<'null' | 'undefined' | 'string' | 'boolean' | 'object' | 'bigint' | 'number'>, prototypes: PrototypeList): any {
        const t = e[0];

        if (!SerializerLegacy.types.includes(t)) throw new Error(`Invalid type '${t}'`);

        if (t === 'null') {
            return null;
        } else if (t === 'bigint' || t === 'number' || t === 'string' || t === 'boolean') {
            const value = e[1];

            if (value === undefined) throw new Error('Invalid value for ' + t);

            switch (t) {
                case 'bigint': return BigInt(parseInt(value, 36));
                case 'number': return Number(value);
                case 'string': return value;
                case 'boolean': return typeof value == 'string' ? Boolean(value) : value;
            }
        } else if (t === 'object') {
            const ctrName = e[1];

            if (ctrName === undefined) throw new Error('Invalid constructor for object');

            let prototype: any = Object.prototype;

            if (ctrName === 'null') {
                prototype = null;
            } else if (prototypes.has(ctrName)) prototype = prototypes.get(ctrName);

            const x = Object.setPrototypeOf({}, prototype);

            if (x instanceof Map) {
                const o = new Map();
                
                e[2] && (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] === 'co') {
                        const x = <Container> c;
                        const key = SerializerLegacy.deserialize(x[1], prototypes);
                        const value = SerializerLegacy.deserialize(x[2], prototypes);
                  
                        o.set(key, value);
                    } else if (c[0] === 'key') {
                        const x = <KeyContainer> c;
                        const key = x[1];
                        const value = x[2];
                        (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                    }
                });
                Object.setPrototypeOf(o, prototype);
                
                return o;
            } else if (x instanceof Set) {
                const o = new Set();
                
                e[2] && (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] === 'key') {
                        const x = <KeyContainer> c;
                        const key = x[1];
                        const value = x[2];
                        (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                    } else o.add(SerializerLegacy.deserialize(<Element<any>> c, prototypes));
                });
                Object.setPrototypeOf(o, prototype);
                
                return o;
            } else if (x instanceof RegExp) {
                const source = e[3];
                const flags = e[4];

                const o: RegExp = new RegExp(source, flags);
                
                Object.setPrototypeOf(o, prototype);

                (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] !== 'key') return;
                    
                    const x = <KeyContainer> c;
                    const key = x[1];
                    const value = x[2];
                    (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                });

                return o;
            } else if (x instanceof String || x instanceof Boolean || x instanceof Number) {
                const v = e[3];

                const o: String | Boolean | Number = x instanceof String ? new String(v) : x instanceof Boolean ? new Boolean(v) : new Number(v);

                (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] !== 'key') return;
                    
                    const x = <KeyContainer> c;
                    const key = x[1];
                    const value = x[2];
                    (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                });
                Object.setPrototypeOf(o, prototype);

                return o;
            } else if (x instanceof Date) {
                const v = e[3];

                if (typeof v !== 'string') {
                    throw new Error('Invalid value for object Date');
                }

                const o: Date = new Date(parseInt(v, 36));
                
                (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] !== 'key') return;
                    
                    const x = <KeyContainer> c;
                    const key = x[1];
                    const value = x[2];
                    (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                });
                Object.setPrototypeOf(o, prototype);
                
                return o;
            } else if (x instanceof Buffer) {
                const v = e[3];
                
                if (typeof v !== 'string') {
                    throw new Error('Invalid value for object Buffer');
                }

                const o: Buffer = Buffer.from(v, 'base64');
                
                (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] !== 'key') return;
                    
                    const x = <KeyContainer> c;
                    const key = x[1];
                    const value = x[2];
                    (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                });
                
                Object.setPrototypeOf(o, prototype);
                
                return o;
            } else if (x instanceof Array) {
                const o: any[] = [];
                
                e[2] && (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] === 'key') {
                        const x = <KeyContainer> c;
                        const key = x[1];
                        const value = x[2];
                        (<any> o)[key] = SerializerLegacy.deserialize(value, prototypes);
                    } else o.push(SerializerLegacy.deserialize(<Element<any>> c, prototypes));
                });
                Object.setPrototypeOf(o, prototype);
                
                return o;
            } else {
                const o: any = {};
                
                (<ObjectElement> e)[2].forEach(c => {
                    if (c[0] !== 'key') return;
                    
                    const x = <KeyContainer> c;
                    const key = x[1];
                    const value = x[2];
                    o[key] = SerializerLegacy.deserialize(value, prototypes);
                });
                Object.setPrototypeOf(o, prototype);
                
                return o;
            }
        }
    }

    /**
     * Deserializes from JSON
     * @param data The serialized data to deserialize
     */
    public deserialize(data: string): any {
        const e: Element<any> = JSON.parse(data);

        return SerializerLegacy.deserialize(e, this.prototypes);
    }

}