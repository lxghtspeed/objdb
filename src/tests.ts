import { Serializer } from "./serialization";

class Restorable extends Map<any, any> {

	public inf: number = Infinity;

	public nothing: null = null;

	public nothing2: undefined = undefined;

	public regexp: RegExp = /a+bc/ig;

	public now: Date = new Date();

}

export class TestZone {

	public static main(args: string[]): void {
		console.log('running test');
		console.log('args: ', args);

		const s = new Serializer([Restorable]);
		const o: Restorable = new Restorable();

		o.set(new Map([[Date.now(), 'test']]), new Set(['ended']));

		const x: string = s.serialize(o);
		const o2: Restorable = s.deserialize(x);

		console.log(o);
		console.log(JSON.parse(x));
		console.log(o2);
	}

}
