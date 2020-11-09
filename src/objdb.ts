import FileSystem from 'fs';
import Path from 'path';
import { Serializer } from './objdb.serialization';

export { Serializer } from './objdb.serialization';

export class Objdb {

    public static defaultPath = './data';

    public readonly target: Object;

    public readonly fullPath: string;

    public serializer: Serializer;

    public get constructors(): Function[] {
        return this.serializer.constructors;
    }

    public set constructors(value: Function[]) {
        this.serializer.constructors = value;
    }

    constructor(target: Object, file: string, path?: string) {
        this.target = target;
        this.fullPath = Path.join(path ?? Objdb.defaultPath, file);
        this.serializer = new Serializer();

        this.load();
    }

    public load(): void {
        const raw = FileSystem.readFileSync(this.fullPath);
        const data = this.serializer.deserialize(raw.toString());

        Object.assign(this.target, data);
    }

    public save(): void {
        const data = this.serializer.serialize(this.target);
        FileSystem.writeFileSync(data, this.fullPath);
    }

}
