import { EventEmitter } from 'events';
import FileSystem from 'fs';
import { promises as FileSystemAsync } from 'fs';
import Path from 'path';
import { Serializer } from './serialization';
import { Timeout, Timer } from './objdb.util';

export class Objdb {

    public static defaultPath = './data';

    public readonly target: Object;

    public readonly fullPath: string;

    public readonly serializer: Serializer;

    private lastSave: number

    public get constructors(): Function[] {
        return this.serializer.constructors;
    }

    public set constructors(value: Function[]) {
        this.serializer.constructors = value;
    }

    constructor(target: Object, file?: string, path?: string) {
        this.target = target;
        this.fullPath = Path.join(path ?? Objdb.defaultPath, (file ?? 'default') + '.json');
        this.serializer = new Serializer();
        this.lastSave = 0;

        this.load();
    }

    public load(): void {
        const raw = FileSystem.readFileSync(this.fullPath);
        const data = this.serializer.deserialize(raw.toString());

        Object.assign(this.target, data);
    }

    public async save(): Promise<void> {        
        if (this.lastSave + 1000 > Date.now()) {
            const lastSave = this.lastSave;
            
            await new Promise(r => new Timeout(r, 1000).start());

            if (this.lastSave != lastSave) {
                return;
            }
        }

        this.lastSave = Date.now();

        const data = this.serializer.serialize(this.target);
        
        await FileSystemAsync.writeFile(data, this.fullPath);
    }

    public forceSave(): void {
        this.lastSave = Date.now();

        const data = this.serializer.serialize(this.target);
        
        FileSystem.writeFileSync(data, this.fullPath);
    }

}

export class AutoSaver extends EventEmitter {

    public target: Objdb;

    private enabled: boolean;

    private timer: Timer;

    public get interval(): number {
        return this.timer.getInterval();
    }

    public set interval(value: number) {
        this.timer.setInterval(value);
    }

    constructor(target: Objdb, interval?: number) {
        super();
        this.target = target;
        this.enabled = false;
        this.timer = new Timer(this.onInterval, interval ?? 16000);

        this.enable();
    }

    private onExit = () => this.target.forceSave();

    private onInterval = () => this.target.save();

    public enable(): void {
        if (this.enabled) {
            return;
        }

        this.enabled = true;

        this.timer.start();
        process.on('exit', this.onExit);
    }

    public disable(): void {
        if (!this.enabled) {
            return;
        }

        this.enabled = false;

        this.timer.stop();
        process.removeListener('exit', this.onExit);
    }

}
