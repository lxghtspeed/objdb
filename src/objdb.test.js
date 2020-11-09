import { Database } from './objdb';
import { Serializer } from './objdb.serialization';

class Restorable extends Map<any, any> {

    public inf: number = Infinity;

    public nothing: null = null;

    public nothing2: undefined = undefined;

    public regexp: RegExp = /a+bc/ig;

    public now: Date = new Date();

    public boolean: boolean = true;

    public string: string = 'test';

    public circular: Restorable = this;

}

export class TestZone {

    public static main(args: string[]): void {
        console.log('testing...');

        if (args[0] === '--test-serialization') {
            TestZone.serialization();
            return;
        }

        if (args[0] === '--test-db') {
            TestZone.database();
            return;
        }

        console.error('test not found.')
    }

    /**
     * We expect that both values **o** and **o2** gets the same values.
     */
    public static serialization(): void {
        let start: number;

        const s = new Serializer([ Restorable ]);
        const o: Restorable = new Restorable();

        o.set(new Map([
            [ Date.now(), 'test' ]
        ]), new Set([ 'ended' ]));

        start = process.uptime();

        const x: string = s.serialize(o);
        const serializeTime = (process.uptime() - start) * 1000;

        start = process.uptime();

        const o2: Restorable = s.deserialize(x);
        const deserializeTime = (process.uptime() - start) * 1000;

        console.log(o);
        console.log('-------------');
        console.log(o2);
        console.log('-------------');
        console.log(`${x.length} bytes took ${serializeTime.toFixed(2)}ms to serialize, ${deserializeTime.toFixed(2)}ms to deserialize`);
    }

    /**
     * We expect a warning message about **Restorable** not added
     * and the console logging "saved" before exit
     */
    public static async database(): Promise<void> {
        const db = new Database({ interval: Infinity });

        db.on('save', () => console.log('saved'));

        db.test = new Restorable();
    }

}
