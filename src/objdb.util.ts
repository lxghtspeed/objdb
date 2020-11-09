import Timers from 'timers';

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

export class Timer {

    public callback: (...args: any[]) => any;

    private createdAt: number;

    private lastExec: number;

    private interval: number;

    private enabled: boolean;

    private timeout?: NodeJS.Timeout;

    constructor(callback: (...args: any[]) => any, interval: number) {
        this.callback = callback;
        this.createdAt = Date.now();
        this.lastExec = Date.now();
        this.interval = interval;
        this.enabled = false;
    }

    private readonly onInterval = (): void => {
        this.lastExec = Date.now();

        this.callback();
    
        const totalExecs = Math.floor((this.lastExec - this.createdAt) / this.interval);
        const nextExec = this.createdAt + (totalExecs + 1) * this.interval;
        
        this.timeout = Timers.setTimeout(this.onInterval, nextExec - Date.now());
    }

    public start(): void {
        if (this.enabled) {
            return;
        }

        this.enabled = true;
        this.createdAt = Date.now();
        this.timeout = Timers.setTimeout(this.onInterval, this.interval);
    }

    public stop(): void {
        if (!this.enabled) {
            return;
        }

        this.enabled = false;

        if (this.timeout) {
            Timers.clearTimeout(this.timeout);
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public getInterval(): number {
        return this.interval;
    }

    public setInterval(value: number): number {
        if (this.timeout) {
            Timers.clearTimeout(this.timeout);

            const totalExecs = Math.floor((this.lastExec - this.createdAt) / this.interval);
            const nextExec = this.createdAt + (totalExecs * this.interval) + value;
            
            this.timeout = Timers.setTimeout(this.onInterval, nextExec - Date.now());
        }

        this.interval = value;
        return value;
    }

}

export class Timeout {

    public callback: (...args: any[]) => any;

    private time: number;

    private enabled: boolean;

    private timeout?: NodeJS.Timeout;

    constructor(callback: (...args: any[]) => any, time: number) {
        this.callback = callback;
        this.time = time;
        this.enabled = false;
    }

    private onTimeout = (): void => {
        this.callback();
    }

    public start(): void {
        if (this.enabled) {
            return;
        }

        this.enabled = true;
        this.timeout = Timers.setTimeout(this.onTimeout, this.time);
    }

    public stop(): void {
        if (!this.enabled) {
            return;
        }

        this.enabled = false;

        if (this.timeout) {
            Timers.clearTimeout(this.timeout);
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

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
